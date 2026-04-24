import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feedback, FeedbackFilters, FeedbackStatus } from '@/types/feedback';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';
import {
  isResolvedStatus,
  toCanonicalFeedbackStatus,
} from '@/lib/feedbackFlow';
import {
  AUTO_REFRESH_QUERY_OPTIONS,
  WORKING_AUTO_REFRESH_QUERY_OPTIONS,
} from '@/lib/autoRefresh';

type FeedbackDataSource = 'working' | 'migration';

interface FeedbackContextType {
  feedbacks: Feedback[];
  filters: FeedbackFilters;
  setFilters: (filters: Partial<FeedbackFilters>) => void;
  filteredFeedbacks: Feedback[];
  updateStatus: (id: string, status: FeedbackStatus, adminNotes?: string) => void;
  updateAssignment: (id: string, userName: string) => void;
  updateFeedback: (id: string, updates: Partial<Pick<Feedback, 'status' | 'assignedTo' | 'mode' | 'remarks' | 'updatedBy' | 'statusNotes' | 'type'>>) => Promise<void>;
  stats: {
    total: number;
    feedbacks: number;
    avgRating: number;
    complaints: number;
    pending: number;
    solved: number;
    stores: number;
  };
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

const defaultFilters: FeedbackFilters = {
  store: 'All',
  status: 'All',
  dateFrom: '',
  dateTo: '',
  search: '',
  ratingMin: 0,
};

const WORKING_DATA_SCHEMA = 'public';
const WORKING_DATA_TABLE = 'working_data';
const HISTORY_SEPARATOR = '\n\n-----\n\n';
const FEEDBACK_QUERY_STALE_TIME = 1000 * 60 * 5;
const DEFAULT_UPDATE_API_URL = 'http://localhost:3000/api/update';
const WORKING_DATA_API_PAGE_SIZE = 500;
const WORKING_DATA_API_MAX_PAGES = 200;

const isLoopbackHost = (host: string) => {
  const key = String(host || '').trim().toLowerCase();
  return key === 'localhost' || key === '127.0.0.1' || key === '::1' || key === '[::1]';
};

const isLoopbackUrl = (url: string) => {
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return false;
  }
};

const parseHistoryField = (history: unknown, fieldLabel: string) => {
  const raw = String(history || '').trim();
  if (!raw) return '';
  const entries = raw
    .split(HISTORY_SEPARATOR)
    .map(entry => entry.trim())
    .filter(Boolean);
  const latest = entries[entries.length - 1] || raw;
  const match = latest.match(new RegExp(`${fieldLabel}:\\s*([^|\\n]+)`, 'i'));
  return match?.[1]?.trim() || '';
};

const toDisplayValue = (value: unknown) => {
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  return value === null || value === undefined ? '' : String(value);
};

const parseRatingValue = (val: any, fallback = 0) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const matched = val.match(/\d+/);
    return matched ? parseInt(matched[0], 10) : fallback;
  }
  return fallback;
};

const normalizeTypeKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizeStoreKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

const WORKING_QUEUE_STATUS_KEYS = new Set([
  'new',
  'active',
  'pending',
  'complaint',
  'feedback',
  'in process',
  'in progress',
  'channel partner store',
  'channel partner',
]);

const normalizeQueueStatus = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isWorkingQueueStatus = (value: unknown) =>
  WORKING_QUEUE_STATUS_KEYS.has(normalizeQueueStatus(value));

const resolveUpdateApiUrl = () => {
  const configured = String(import.meta.env.VITE_UPDATE_API_URL || '').trim();
  const inBrowser = typeof window !== 'undefined';
  const runningOnLoopback = inBrowser ? isLoopbackHost(window.location.hostname) : true;

  // In deployed frontends, never auto-fallback to localhost.
  if (!runningOnLoopback && !configured) return null;
  if (!runningOnLoopback && configured && isLoopbackUrl(configured)) return null;

  return configured || DEFAULT_UPDATE_API_URL;
};

const getWorkingDataApiUrl = () => {
  const updateApiUrl = resolveUpdateApiUrl();
  if (!updateApiUrl) return null;
  return updateApiUrl.replace(/\/update\/?$/, '/working-data');
};

export function FeedbackProvider({
  children,
  initialFilterStatus = 'All',
  source = 'working',
}: {
  children: React.ReactNode;
  initialFilterStatus?: FeedbackStatus | 'All';
  source?: FeedbackDataSource;
}) {
  const queryClient = useQueryClient();
  const [filters, setFiltersState] = useState<FeedbackFilters>({ ...defaultFilters, status: initialFilterStatus });
  const feedbackQueryKey = ['feedbacks', source] as const;
  const isMigrationSource = source === 'migration';
  const isWorkingSource = source === 'working';
  const refreshAllFeedbackViews = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['feedbacks'] });
    queryClient.refetchQueries({ queryKey: ['feedbacks'], type: 'active' });
  }, [queryClient]);

  // Supabase is the source of truth for both active work and historical records.
  useEffect(() => {
    const channelName = `feedbacks-realtime-${source}-${Math.random().toString(36).slice(2, 10)}`;
    const realtimeTable = WORKING_DATA_TABLE;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: realtimeTable },
        () => {
          refreshAllFeedbackViews();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshAllFeedbackViews, source]);

  const { data: feedbacks = [] } = useQuery({
    queryKey: feedbackQueryKey,
    queryFn: async () => {
      try {
        const fetchWorkingDataRows = async () => {
          const fetchFromSupabase = async () => {
            const { data, error: supabaseError } = await supabase
              .schema(WORKING_DATA_SCHEMA)
              .from(WORKING_DATA_TABLE)
              .select('*');

            if (supabaseError) throw supabaseError;
            return data || [];
          };

          // Resolved/Closed view must always read complete DB rows, not queue API slices.
          if (isMigrationSource) {
            return fetchFromSupabase();
          }

          const workingDataApiUrl = getWorkingDataApiUrl();

          try {
            if (!workingDataApiUrl) {
              throw new Error('Working data backend API is not configured for this environment.');
            }

            const allRows: any[] = [];
            let page = 1;

            while (page <= WORKING_DATA_API_MAX_PAGES) {
              const url = new URL(workingDataApiUrl);
              url.searchParams.set('page', String(page));
              url.searchParams.set('pageSize', String(WORKING_DATA_API_PAGE_SIZE));

              const response = await fetch(url.toString(), { cache: 'no-store' });
              const payload = await response.json();

              if (!response.ok || !payload?.success || !Array.isArray(payload?.data)) {
                throw new Error(payload?.error || `HTTP ${response.status}`);
              }

              allRows.push(...payload.data);

              const hasMore = Boolean(payload?.pagination?.hasMore);
              if (!hasMore) {
                break;
              }

              page += 1;
            }

            return allRows;
          } catch {
            return fetchFromSupabase();
          }
        };

        const finalData = await fetchWorkingDataRows();

        // Render only rows with persistent server-side identifiers.
        const mapped = finalData
          .map((row: any) => {
          const historyValue =
            row['Remarks'] || row.remarks || row.status_notes || row.admin_notes || '';
          const historyAssignedTo = parseHistoryField(historyValue, 'Assigned To');
          const historyMode = parseHistoryField(historyValue, 'Mode');
          const historyUpdatedBy = parseHistoryField(historyValue, 'Updated By');
          const historyStatus = parseHistoryField(historyValue, 'Status');
          const historyType = parseHistoryField(historyValue, 'Type of Complaint');
          const complaintValue =
            row['Your Complaint'] || row.your_complaint || row.complaint || '';
          const dbRecordId = String(
            row.id ??
            row['id'] ??
            row.record_id ??
            row['record_id'] ??
            row.external_id ??
            ''
          ).trim();
          if (!dbRecordId) return null;

          const statusValue = String(
            toCanonicalFeedbackStatus(
              row['Status'] || row.status || historyStatus || '',
              'Pending'
            ) || 'Pending'
          ).trim();
          const rawType = String(
            row['Type Complaint'] || row['Type of Complaint'] || row.type || row.Type || historyType || ''
          ).trim();

          // Trust explicit Type of Complaint from source if present.
          const resolvedType = rawType || (String(complaintValue || '').trim() ? 'Complaint' : 'Feedback');

          return {
            _id: dbRecordId,
            name: row['Name'] || row.name || '',
            mobile: row['Mobile Number'] || row.mobile_number || row.mobile || '',
            storeLocation: row['Store Location'] || row.store_location || row.storeLocation || 'Unknown',
            staffBehavior: parseRatingValue(
              row['Staff Behavior'] || row.staff_behaviour || row.staff_behavior || row.staffBehavior
            ),
            staffService: parseRatingValue(row['Staff Service'] || row.staff_service || row.staffService),
            staffSatisfied: toDisplayValue(
              row['Satisfaction Level'] ?? row.staff_satisfied ?? row.store_satisfaction ?? row['Staff Satisfied'] ?? ''
            ),
            priceChallenge: toDisplayValue(
              row['Price Challenge'] ?? row['Price challenge'] ?? row.price_challenge_ok ?? row.price_challenge ?? ''
            ),
            billReceived: toDisplayValue(row['Bill Received'] ?? row.bill_received ?? ''),
            feedback: row['Your Feedback'] || row.your_feedback || row.feedback || '',
            suggestions:
              row['Improvement Feedback'] || row.suggestions || row.your_suggestions || row['Your Suggestions'] || '',
            productUnavailable: row['Product Unavailable'] || row.product_unavailable || '',
            billCompliance:
              row['Receipt Compliance'] || row.no_purchase_without_bill || row['No purchase without bill'] || '',
            complaint: complaintValue,
            type: resolvedType,
            userName: row['Assigned To'] || row.user_name || row.User || historyAssignedTo || '',
            externalId: dbRecordId,
            source: row.source || 'app',
            status: (statusValue as FeedbackStatus) || 'Pending',
            statusNotes: historyValue,
            assignedTo:
              row['Assigned To'] || row.user_name || row.User || row.assignedTo || historyAssignedTo || '',
            mode: row['Mode'] || row.mode || historyMode || '',
            remarks: row['Remarks'] || row.remarks || historyValue || '',
            updatedBy: row['Updated By'] || row.updated_by || row.updatedBy || historyUpdatedBy || '',
            improvementFeedback:
              row['Improvement Feedback'] || row.suggestions || row.your_suggestions || row['Your Suggestions'] || row.improvementFeedback || '',
            resolvedAt: row.resolved_at || row.resolvedAt || '',
            closedAt: row.closed_at || row.closedAt || '',
            archivedAt: row.archived_at || row.archivedAt || '',
            createdAt: row['Timestamp'] || row.created_at || row.timestamp || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString(),
          };
          })
          .filter((record): record is Feedback => Boolean(record));

        const shouldRemainInWorkingQueue = (record: Feedback) =>
          isWorkingQueueStatus(record.status);

        const sourceScoped = isWorkingSource
          ? mapped.filter(record => shouldRemainInWorkingQueue(record))
          : mapped.filter(record => !shouldRemainInWorkingQueue(record));
        return sourceScoped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } catch (error: any) {
        const contextLabel = isWorkingSource ? 'Working Data' : 'Migration Data';
        toast.error(`Failed to load ${contextLabel}: ${error.message}`);
        throw error;
      }
    },
    staleTime: FEEDBACK_QUERY_STALE_TIME,
    ...(isWorkingSource ? WORKING_AUTO_REFRESH_QUERY_OPTIONS : AUTO_REFRESH_QUERY_OPTIONS),
  });

  const setFilters = useCallback((partial: Partial<FeedbackFilters>) => {
    setFiltersState(prev => ({ ...prev, ...partial }));
  }, []);

  const { role, profileName, allowedStores, storeAccess } = useAuth();
  const normalizedAllowedStores = useMemo(
    () => new Set((allowedStores || []).map(store => normalizeStoreKey(store)).filter(Boolean)),
    [allowedStores]
  );

  const resolveUpdateTarget = useCallback((id: string) => {
    const currentRecord = feedbacks.find(f => f._id === id);
    const updateId = String(currentRecord?._id || id || '').trim();
    const trackingRecordId = String(currentRecord?._id || id || '').trim();
    return { currentRecord, updateId, trackingRecordId };
  }, [feedbacks]);

  const asText = (value: unknown) => {
    const normalized = String(value ?? '').trim();
    return normalized || undefined;
  };

  const tryBackendUpdateByRecordId = async (
    id: string,
    recordId: string,
    updateData: Record<string, any>,
    sourceRecord?: Feedback,
  ) => {
    const updateApiUrl = resolveUpdateApiUrl();
    const safeId = String(id || '').trim();
    const safeRecordId = String(recordId || '').trim() || undefined;

    if (!safeId) {
      return {
        updated: false,
        error: new Error('Cannot update this row because it has no persistent DB ID.'),
        };
    }

    if (!updateApiUrl) {
      return {
        updated: false,
        error: new Error('Update backend API is not configured in this deployed environment.'),
      };
    }

    const nextStatus = asText(updateData.Status) ?? asText(sourceRecord?.status) ?? 'Pending';
    const nextAssignedTo =
      asText(updateData['Assigned To']) ??
      asText(sourceRecord?.assignedTo) ??
      asText(sourceRecord?.userName) ??
      '';
    const nextMode = asText(updateData.Mode) ?? asText(sourceRecord?.mode) ?? '';
    const nextRemarks =
      updateData.Remarks !== undefined
        ? String(updateData.Remarks ?? '')
        : String(sourceRecord?.remarks ?? sourceRecord?.statusNotes ?? '');
    const nextUpdatedBy =
      asText(updateData['Updated By']) ??
      asText(sourceRecord?.updatedBy) ??
      asText(profileName) ??
      '';

    const fullSnapshot = {
      id: safeId,
      ...(safeRecordId ? { record_id: safeRecordId } : {}),
      Status: nextStatus,
      'Assigned To': nextAssignedTo,
      Mode: nextMode,
      Remarks: nextRemarks,
      'Updated By': nextUpdatedBy,
      Timestamp: asText(sourceRecord?.createdAt),
      Name: asText(sourceRecord?.name),
      'Mobile Number': asText(sourceRecord?.mobile),
      'Store Location': asText(sourceRecord?.storeLocation),
      'Staff Behavior': sourceRecord?.staffBehavior ?? undefined,
      'Staff Service': sourceRecord?.staffService ?? undefined,
      'Satisfaction Level': asText(sourceRecord?.staffSatisfied),
      'Price Challenge': asText(sourceRecord?.priceChallenge),
      'Bill Received': asText(sourceRecord?.billReceived),
      'Your Feedback': asText(sourceRecord?.feedback),
      'Improvement Feedback': asText(sourceRecord?.improvementFeedback ?? sourceRecord?.suggestions),
      'Product Unavailable': asText(sourceRecord?.productUnavailable),
      'Receipt Compliance': asText(sourceRecord?.billCompliance),
      'Your Complaint': asText(sourceRecord?.complaint),
      'Type of Complaint':
        asText(updateData['Type of Complaint']) ??
        asText(updateData['Type Complaint']) ??
        asText(updateData.type) ??
        asText(sourceRecord?.type),
    };
    const payload = Object.fromEntries(
      Object.entries(fullSnapshot).filter(([, value]) => value !== undefined)
    );

    try {
      const res = await fetch(updateApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      let result: any = null;

      try {
        result = raw ? JSON.parse(raw) : null;
      } catch {
        result = { success: false, error: raw || `HTTP ${res.status}` };
      }

      if (!res.ok || !result?.success) {
        return { updated: false, error: new Error(result?.error || 'Backend update failed.') };
      }

      return { updated: true, data: result?.data || result };
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.toLowerCase().includes('failed to fetch')) {
        return {
          updated: false,
          error: new Error(`Cannot connect to backend at ${updateApiUrl}. Start backend server on port 3000.`),
        };
      }
      return { updated: false, error };
    }
  };

  const tryUpdateByRecordId = async (
    id: string,
    recordId: string,
    updateData: Record<string, any>,
    sourceRecord?: Feedback,
  ) => {
    if (isMigrationSource) {
      return { updated: false, error: new Error('Migration Data is read-only and intended for reporting only.') };
    }

    return tryBackendUpdateByRecordId(id, recordId, updateData, sourceRecord);
  };

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(fb => {
      const enforceStoreScope = role !== 'superadmin' && normalizedAllowedStores.size > 0;
      if (enforceStoreScope && !normalizedAllowedStores.has(normalizeStoreKey(fb.storeLocation))) {
        return false;
      }

      // 1. Role-based visibility
      if (role === 'user') {
        const owner = String(fb.assignedTo || fb.userName || '').trim().toLowerCase();
        const updater = String(fb.updatedBy || '').trim().toLowerCase();
        const me = String(profileName || '').trim().toLowerCase();
        const isUnassigned = !owner;
        const isMine =
          (owner && (owner === me || owner.includes(me) || me.includes(owner))) ||
          (updater && (updater === me || updater.includes(me) || me.includes(updater)));

        if (!isUnassigned && !isMine) return false;
      }

      // 2. Pending filter logic: treat pending as explicit pending status OR unassigned records.
      const isUnassigned = !(fb.assignedTo || fb.userName || '').trim();
      if (filters.status === 'Pending') {
        const isPending = fb.status === 'Pending' || isUnassigned;
        if (!isPending) return false;
      }

      if (filters.store !== 'All' && fb.storeLocation !== filters.store) return false;
      if (filters.status !== 'All' && filters.status !== 'Pending' && fb.status !== filters.status) return false;
      if (filters.dateFrom && new Date(fb.createdAt) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(fb.createdAt) > new Date(filters.dateTo + 'T23:59:59')) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!fb.name.toLowerCase().includes(q) && !fb.mobile.includes(q)) return false;
      }
      if (filters.ratingMin > 0) {
        const avg = (fb.staffBehavior + fb.staffService) / 2;
        if (avg < filters.ratingMin) return false;
      }
      return true;
    });
  }, [feedbacks, filters, normalizedAllowedStores, profileName, role]);

  const mutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string, status: FeedbackStatus, notes?: string }) => {
      const { currentRecord, updateId, trackingRecordId } = resolveUpdateTarget(id);

      const { updated, error } = await tryUpdateByRecordId(updateId, trackingRecordId, {
        Status: status,
        Remarks: notes,
        'Updated By': profileName || undefined,
      }, currentRecord);

      if (!updated) {
        throw new Error(error?.message || `Status update failed for id '${updateId}'`);
      }

      return { success: true };
    },
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: feedbackQueryKey });
      const previousFeedbacks = queryClient.getQueryData<Feedback[]>(feedbackQueryKey);

      queryClient.setQueryData<Feedback[]>(feedbackQueryKey, prev =>
        prev?.map(fb => (fb._id === newStatus.id) ? {
          ...fb,
          status: newStatus.status,
          remarks: newStatus.notes !== undefined ? newStatus.notes : fb.remarks,
          statusNotes: newStatus.notes !== undefined ? newStatus.notes : fb.statusNotes,
          updatedAt: new Date().toISOString()
        } : fb)
      );

      return { previousFeedbacks };
    },
    onError: (err: any, newStatus, context) => {
      queryClient.setQueryData(feedbackQueryKey, context?.previousFeedbacks);
      toast.error(err?.message || 'Failed to update status');
    },
    onSettled: () => {
      refreshAllFeedbackViews();
    }
  });

  const updateStatus = useCallback(async (id: string, status: FeedbackStatus, notes?: string) => {
    if (isMigrationSource) {
      toast.info('Migration Data is report-only. Live updates are available under Working Data.');
      return;
    }

    if (role !== 'superadmin' && storeAccess === 'viewer') {
      toast.error('Read-only access: viewer can only view store data');
      return;
    }

    // Permission Check: Only Super Admin OR Assigned User can update
    const target = feedbacks.find(f => f._id === id);
    if (target && role !== 'superadmin' && normalizedAllowedStores.size > 0) {
      const isInScope = normalizedAllowedStores.has(normalizeStoreKey(target.storeLocation));
      if (!isInScope) {
        toast.error('Access denied: this record is outside your assigned store scope');
        return;
      }
    }
    const assignedOwner = target?.assignedTo || target?.userName;
    const isOwner = target && assignedOwner === profileName;

    if (role !== 'superadmin' && (role !== 'user' || !isOwner)) {
      toast.error("Security Alert: Only Super Admin or Assigned Staff can update this record");
      return;
    }
    mutation.mutate({ id, status, notes });
  }, [feedbacks, isMigrationSource, mutation, normalizedAllowedStores, profileName, role, storeAccess]);

  const assignMutation = useMutation({
    mutationFn: async ({ id, userName }: { id: string; userName: string }) => {
      const { currentRecord, updateId, trackingRecordId } = resolveUpdateTarget(id);

      const { updated, error } = await tryUpdateByRecordId(updateId, trackingRecordId, {
        'Assigned To': userName,
      }, currentRecord);
      if (!updated) throw new Error(error?.message || `Assignment target not found for id '${updateId}'`);
    },
    onSuccess: () => {
      refreshAllFeedbackViews();
      toast.success("Assignment updated");
    },
    onError: () => toast.error("Failed to assign user"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Feedback> }) => {
      const nextRemarks = updates.statusNotes ?? updates.remarks;
      const { currentRecord, updateId, trackingRecordId } = resolveUpdateTarget(id);
      const nextStatus = updates.status || currentRecord?.status;

      const { updated, error } = await tryUpdateByRecordId(updateId, trackingRecordId, {
        Status: nextStatus,
        'Assigned To': updates.assignedTo,
        Mode: updates.mode,
        Remarks: nextRemarks,
        'Updated By': updates.updatedBy,
        'Type of Complaint': updates.type,
        'Type Complaint': updates.type,
      }, currentRecord);

      if (!updated) {
        throw new Error(error?.message || `Update failed for id '${updateId}'`);
      }

      return { success: true };
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: feedbackQueryKey });
      const previousFeedbacks = queryClient.getQueryData<Feedback[]>(feedbackQueryKey);

      queryClient.setQueryData<Feedback[]>(feedbackQueryKey, prev =>
        prev?.map(fb => (fb._id === id) ? {
          ...fb,
          ...updates,
          assignedTo: updates.assignedTo ?? fb.assignedTo,
          mode: updates.mode ?? fb.mode,
          remarks: updates.remarks ?? fb.remarks,
          updatedBy: updates.updatedBy ?? fb.updatedBy,
          type: updates.type ?? fb.type,
          status: updates.status ?? fb.status,
          statusNotes: updates.statusNotes ?? fb.statusNotes,
          updatedAt: new Date().toISOString(),
        } : fb)
      );

      return { previousFeedbacks };
    },
    onError: (err: any, newData, context) => {
      queryClient.setQueryData(feedbackQueryKey, context?.previousFeedbacks);
      toast.error(err?.message || 'Failed to update feedback');
    },
    onSettled: () => {
      refreshAllFeedbackViews();
    }
  });

  const updateFeedback = useCallback(async (id: string, updates: Partial<Pick<Feedback, 'status' | 'assignedTo' | 'mode' | 'remarks' | 'updatedBy' | 'statusNotes' | 'type'>>) => {
    if (isMigrationSource) {
      toast.info('Migration Data is report-only. Live updates are available under Working Data.');
      return;
    }

    if (role !== 'superadmin' && storeAccess === 'viewer') {
      toast.error('Read-only access: viewer can only view store data');
      return;
    }

    const target = feedbacks.find(f => f._id === id);
    if (target && role !== 'superadmin' && normalizedAllowedStores.size > 0) {
      const isInScope = normalizedAllowedStores.has(normalizeStoreKey(target.storeLocation));
      if (!isInScope) {
        toast.error('Access denied: this record is outside your assigned store scope');
        return;
      }
    }
    await updateMutation.mutateAsync({ id, updates });
  }, [feedbacks, isMigrationSource, normalizedAllowedStores, role, storeAccess, updateMutation]);

  const updateAssignment = useCallback(async (id: string, userName: string) => {
    if (isMigrationSource) {
      toast.info('Migration Data is report-only. Live updates are available under Working Data.');
      return;
    }
    if (role !== 'superadmin') {
      toast.error("Strict Restriction: Only Super Admin can change assignments");
      return;
    }
    assignMutation.mutate({ id, userName });
  }, [assignMutation, isMigrationSource, role]);

  const stats = useMemo(() => {
    const list = filteredFeedbacks;
    const total = list.length;
    const allRatings = list.flatMap(f => {
      const scores = [f.staffBehavior, f.staffService].filter(s => s > 0);
      return scores.length > 0 ? [scores.reduce((a, b) => a + b, 0) / scores.length] : [];
    });
    const avgRating = allRatings.length ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0;
    const feedbacks = list.filter(f => normalizeTypeKey(f.type) === 'feedback').length;
    const complaints = list.filter(f => normalizeTypeKey(f.type) === 'complaint').length;
    const pending = list.filter(f => f.status === 'Pending').length;
    const solved = list.filter(f => isResolvedStatus(f.status)).length;
    const stores = new Set(list.map(f => f.storeLocation)).size;
    return { total, feedbacks, avgRating: Math.round(avgRating * 10) / 10, complaints, pending, solved, stores };
  }, [filteredFeedbacks]);

  return (
    <FeedbackContext.Provider value={{ feedbacks, filters, setFilters, filteredFeedbacks, updateStatus, updateAssignment, updateFeedback, stats }}>
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used within FeedbackProvider');
  return context;
}
