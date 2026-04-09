import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feedback, FeedbackFilters, FeedbackStatus } from '@/types/feedback';
import { generateMockFeedbacks } from '@/lib/mock-data';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface FeedbackContextType {
  feedbacks: Feedback[];
  filters: FeedbackFilters;
  setFilters: (filters: Partial<FeedbackFilters>) => void;
  filteredFeedbacks: Feedback[];
  updateStatus: (id: string, status: FeedbackStatus, adminNotes?: string) => void;
  updateAssignment: (id: string, userName: string) => void;
  stats: {
    total: number;
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

export function FeedbackProvider({ children, initialFilterStatus = 'All' }: { children: React.ReactNode, initialFilterStatus?: FeedbackStatus | 'All' }) {
  const queryClient = useQueryClient();
  const [filters, setFiltersState] = useState<FeedbackFilters>({ ...defaultFilters, status: initialFilterStatus });

  // Real-time Supabase Subscription
  useMemo(() => {
    const channel = supabase
      .channel('feedbacks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedbacks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['feedbacks'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ['feedbacks'],
    queryFn: async () => {
      // Helper to parse ratings like "5-Excellent"
      const parseRating = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const matched = val.match(/\d+/);
          return matched ? parseInt(matched[0], 10) : 0;
        }
        return 0;
      };

      try {
        // 1. Try fetching from Supabase
        const { data: supabaseData, error: supabaseError } = await supabase
          .from('feedbacks')
          .select('*')
          .order('timestamp', { ascending: false });

        let finalData = supabaseData || [];

        // 2. Fallback to Google Sheets if Supabase is empty or failed
        if (finalData.length === 0) {
          const sheetUrl = import.meta.env.VITE_GOOGLE_SHEET_API_URL;
          if (sheetUrl) {
            const sheetResponse = await fetch(`${sheetUrl}?action=GET_ALL`);
            const sheetJson = await sheetResponse.json();
            if (sheetJson.success && Array.isArray(sheetJson.data)) {
              finalData = sheetJson.data;
            }
          }
        }

        return finalData.map((row: any) => ({
          _id: (row.id || row._id || Math.random().toString(36).substr(2, 9)).toString(),
          name: row.name || row.Name || '',
          mobile: row.mobile_number || row['Mobile Number'] || row.mobile || '',
          storeLocation: row.store_location || row['Store Location'] || row.storeLocation || 'Unknown',
          staffBehavior: parseRating(row.staff_behaviour || row['Staff Behaviour'] || row.staffBehavior),
          staffService: parseRating(row.staff_service || row['Staff Service'] || row.staffService),
          staffSatisfied: row.staff_satisfied || row['Staff Satisfied'] || '',
          priceChallenge: row.price_challenge || row['Price challenge'] || '',
          billReceived: row.bill_received || row['Bill Received'] || '',
          feedback: row.your_feedback || row['Your Feedback'] || row.feedback || '',
          suggestions: row.your_suggestions || row['Your Suggestions'] || '',
          productUnavailable: row.product_unavailable || row['Product Unavailable'] || '',
          billCompliance: row.no_purchase_without_bill || row['No purchase without bill'] || '',
          complaint: row.your_complaint || row['Your Complaint'] || '',
          type: row.type || row.Type || '',
          userName: row.user_name || row.User || '',
          externalId: row.external_id || row._id || '',
          status: (row.status || row.Status as FeedbackStatus) || 'Feedback',
          statusNotes: row.admin_notes || row['Admin Notes'] || '',
          createdAt: row.timestamp || row.Timestamp || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString(),
        })) as Feedback[];
      } catch (error: any) {
        toast.error("Failed to sync data: " + error.message);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const setFilters = useCallback((partial: Partial<FeedbackFilters>) => {
    setFiltersState(prev => ({ ...prev, ...partial }));
  }, []);

  const { role, profileName } = useAuth();
  const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(fb => {
      // 1. Role-based visibility
      if (role === 'user') {
        if (fb.userName !== profileName) return false;
      }

      // 2. Pending filter logic...
      if (filters.status === 'Pending' || filters.status === 'All') {
        const isPending = fb.createdAt && (!fb.userName || fb.userName.trim() === '');
        // If we want ONLY pending for the task view:
        if (filters.status === 'Pending' && !isPending) return false;
      }

      if (filters.store !== 'All' && fb.storeLocation !== filters.store) return false;
      if (filters.status !== 'All' && fb.status !== filters.status) return false;
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
  }, [feedbacks, filters]);

  const mutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string, status: FeedbackStatus, notes?: string }) => {
      let supabaseUpdated = false;
      let sheetUpdated = false;
      let supabaseErrMsg = '';
      let sheetErrMsg = '';

      // 1. Update Supabase (instant dashboard sync)
      try {
        const payload = { status, admin_notes: notes, updated_at: new Date().toISOString() };
        let updateData: any[] | null = null;

        if (isUuid(id)) {
          const { data, error } = await supabase
            .from('feedbacks')
            .update(payload)
            .eq('id', id)
            .select('id');
          if (error) throw error;
          updateData = data;
        }

        if (!updateData || updateData.length === 0) {
          const { data, error } = await supabase
            .from('feedbacks')
            .update(payload)
            .eq('external_id', id)
            .select('id');
          if (error) throw error;
          updateData = data;
        }

        supabaseUpdated = !!updateData && updateData.length > 0;
      } catch (error: any) {
        supabaseErrMsg = error?.message || 'Supabase update failed';
      }

      // 2. Update Google Sheet (backup / permanent record)
      const sheetUrl = import.meta.env.VITE_GOOGLE_SHEET_API_URL;
      if (sheetUrl) {
        try {
          const res = await fetch(sheetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'UPDATE_STATUS', id, status, adminNotes: notes })
          });
          const data = await res.json();
          if (!res.ok || !data?.success) {
            throw new Error(data?.error || 'Google Sheets update failed');
          }
          sheetUpdated = true;
        } catch (err) {
          sheetErrMsg = (err as any)?.message || 'Google Sheets update failed';
          console.error("Failed to sync status to Google Sheets.", err);
        }
      }

      if (!supabaseUpdated && !sheetUpdated) {
        throw new Error(`Status update failed. ${supabaseErrMsg || ''} ${sheetErrMsg || ''}`.trim());
      }

      return { success: true };
    },
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: ['feedbacks'] });
      const previousFeedbacks = queryClient.getQueryData<Feedback[]>(['feedbacks']);
      
      queryClient.setQueryData<Feedback[]>(['feedbacks'], prev => 
        prev?.map(fb => (fb._id === newStatus.id || fb.externalId === newStatus.id) ? { 
          ...fb, 
          status: newStatus.status, 
          statusNotes: newStatus.notes !== undefined ? newStatus.notes : fb.statusNotes,
          updatedAt: new Date().toISOString()
        } : fb)
      );
      
      return { previousFeedbacks };
    },
    onError: (err: any, newStatus, context) => {
      queryClient.setQueryData(['feedbacks'], context?.previousFeedbacks);
      toast.error(err?.message || 'Failed to update status');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feedbacks'] });
    }
  });

  const updateStatus = useCallback(async (id: string, status: FeedbackStatus, notes?: string) => {
    // Permission Check: Only Super Admin OR Assigned User can update
    const target = feedbacks.find(f => f._id === id || f.externalId === id);
    const isOwner = target && target.userName === profileName;
    
    if (role !== 'superadmin' && (role !== 'user' || !isOwner)) {
      toast.error("Security Alert: Only Super Admin or Assigned Staff can update this record");
      return;
    }
    mutation.mutate({ id, status, notes });
  }, [mutation, role, feedbacks, profileName]);

  const assignMutation = useMutation({
    mutationFn: async ({ id, userName }: { id: string; userName: string }) => {
      let updated = false;

      if (isUuid(id)) {
        const { data, error } = await supabase
          .from('feedbacks')
          .update({ user_name: userName })
          .eq('id', id)
          .select('id');
        if (error) throw error;
        updated = !!data && data.length > 0;
      }

      if (!updated) {
        const { data, error } = await supabase
          .from('feedbacks')
          .update({ user_name: userName })
          .eq('external_id', id)
          .select('id');
        if (error) throw error;
        updated = !!data && data.length > 0;
      }

      if (!updated) throw new Error('Assignment target not found');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedbacks'] });
      toast.success("Assignment updated");
    },
    onError: () => toast.error("Failed to assign user"),
  });

  const updateAssignment = useCallback(async (id: string, userName: string) => {
    if (role !== 'superadmin') {
      toast.error("Strict Restriction: Only Super Admin can change assignments");
      return;
    }
    assignMutation.mutate({ id, userName });
  }, [assignMutation, role]);

  const stats = useMemo(() => {
    const list = filteredFeedbacks;
    const total = list.length;
    const allRatings = list.flatMap(f => {
      const scores = [f.staffBehavior, f.staffService].filter(s => s > 0);
      return scores.length > 0 ? [scores.reduce((a, b) => a + b, 0) / scores.length] : [];
    });
    const avgRating = allRatings.length ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0;
    const complaints = list.filter(f => f.status === 'Complaint').length;
    const pending = list.filter(f => f.status === 'Pending').length;
    const solved = list.filter(f => f.status === 'Solved').length;
    const stores = new Set(list.map(f => f.storeLocation)).size;
    return { total, avgRating: Math.round(avgRating * 10) / 10, complaints, pending, solved, stores };
  }, [filteredFeedbacks]);

  return (
    <FeedbackContext.Provider value={{ feedbacks, filters, setFilters, filteredFeedbacks, updateStatus, updateAssignment, stats }}>
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used within FeedbackProvider');
  return context;
}
