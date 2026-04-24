import { useEffect, useMemo, useState } from 'react';
import { useFeedback } from '@/contexts/FeedbackContext';
import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS, FeedbackStatus, STATUS_OPTIONS } from '@/types/feedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Star,
  Eye,
  User,
  Phone,
  MapPin,
  Activity,
  Heart,
  Sparkles,
  PackageCheck,
  ThumbsUp,
  AlertTriangle,
  PackageX,
  Clock,
  Tag,
  PenSquare,
  UserCheck,
  Plus,
} from 'lucide-react';
import type { Feedback } from '@/types/feedback';

const DEFAULT_ASSIGNED_TO_OPTIONS = ['Store Manager', 'Team HO', 'Pradeep Sir'];
const DEFAULT_MODE_OPTIONS = ['Regular', 'Improvement', 'Urgent'];
const DEFAULT_UPDATED_BY_OPTIONS = ['Simran', 'Prerna', 'Meenakshi'];
const DEFAULT_TYPE_COMPLAINT_OPTIONS = ['Pending', 'Feedback', 'Complaint'];

const STORAGE_KEYS = {
  status: 'feedback-records.status-options',
  typeComplaint: 'feedback-records.type-complaint-options',
  assignedTo: 'feedback-records.assigned-to-options',
  mode: 'feedback-records.mode-options',
  updatedBy: 'feedback-records.updated-by-options',
};

const HISTORY_SEPARATOR = '\n\n-----\n\n';

function getUniqueOptions(values: string[]) {
  return Array.from(new Set(values.map(v => String(v || '').trim()).filter(Boolean)));
}

function normalizeOptionKey(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isPlaceholderOption(value: unknown) {
  const key = normalizeOptionKey(value);
  return key === 'none' || key === 'no user';
}

function stripPlaceholderOptions(values: string[]) {
  return values.filter(value => !isPlaceholderOption(value));
}

function sanitizeOptionalSelection(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  return isPlaceholderOption(text) ? '' : text;
}

function loadStoredOptions(key: string, defaults: string[]) {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults;
    const normalized = getUniqueOptions(parsed);
    return normalized.length > 0 ? normalized : defaults;
  } catch {
    return defaults;
  }
}

function withCurrentOption(options: string[], currentValue?: string) {
  const current = String(currentValue || '').trim();
  if (!current) return options;
  return options.some(o => o.toLowerCase() === current.toLowerCase()) ? options : [current, ...options];
}

function splitHistoryEntries(raw: string) {
  const value = String(raw || '').trim();
  if (!value) return [] as string[];
  if (!value.includes('-----')) return [value];
  return value
    .split(HISTORY_SEPARATOR)
    .map(entry => entry.trim())
    .filter(Boolean);
}

function extractLatestNote(raw: string) {
  const entries = splitHistoryEntries(raw);
  const latest = entries[entries.length - 1] || '';
  if (!latest) return '';
  const lines = latest.split('\n');
  const noteIndex = lines.findIndex(line => line.trim().toLowerCase().startsWith('note:'));
  if (noteIndex === -1) return latest;
  return lines
    .slice(noteIndex)
    .join(' ')
    .replace(/^note:\s*/i, '')
    .trim();
}

function resolveTypeOfComplaint(record: Pick<Feedback, 'type' | 'complaint' | 'status'>) {
  const rawType = String(record.type || '').trim();
  if (rawType) return rawType;

  const status = String(record.status || '').trim().toLowerCase();
  const hasComplaintText = Boolean(String(record.complaint || '').trim());

  if (status === 'complaint' || hasComplaintText) {
    return 'Complaint';
  }
  return 'Feedback';
}

function isUuidRecordId(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function formatRecordId(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (isUuidRecordId(text)) return `${text.split('-')[0]}-`;
  if (text.length <= 12) return text;
  return `${text.slice(0, 12)}...`;
}

function buildHistoryEntry(args: {
  status: string;
  assignedTo: string;
  mode: string;
  typeComplaint: string;
  updatedBy: string;
  note: string;
}) {
  const now = new Date().toLocaleString('en-IN', { hour12: false });
  const safeNote = args.note.trim() || 'No note provided';
  return `[${now}] Updated By: ${args.updatedBy || 'Unknown'} | Status: ${args.status || '-'} | Assigned To: ${args.assignedTo || 'Unassigned'} | Mode: ${args.mode || '-'} | Type of Complaint: ${args.typeComplaint || '-'}\nNote: ${safeNote}`;
}

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex gap-[2px]">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= value ? 'fill-warning text-warning drop-shadow-sm' : 'text-muted/40'}`} />
      ))}
    </div>
  );
}

export default function FeedbackTable({
  readOnly = false,
  records,
  title,
}: {
  readOnly?: boolean;
  records?: Feedback[];
  title?: string;
}) {
  const { filteredFeedbacks, filters, updateFeedback } = useFeedback();
  const tableFeedbacks = records ?? filteredFeedbacks;

  const [statusOptions, setStatusOptions] = useState<string[]>(() =>
    loadStoredOptions(STORAGE_KEYS.status, getUniqueOptions(STATUS_OPTIONS))
  );
  const [typeComplaintOptions, setTypeComplaintOptions] = useState<string[]>(() =>
    loadStoredOptions(STORAGE_KEYS.typeComplaint, DEFAULT_TYPE_COMPLAINT_OPTIONS)
  );
  const [assignedToOptions, setAssignedToOptions] = useState<string[]>(() =>
    stripPlaceholderOptions(loadStoredOptions(STORAGE_KEYS.assignedTo, DEFAULT_ASSIGNED_TO_OPTIONS))
  );
  const [modeOptions, setModeOptions] = useState<string[]>(() =>
    stripPlaceholderOptions(loadStoredOptions(STORAGE_KEYS.mode, DEFAULT_MODE_OPTIONS))
  );
  const [updatedByOptions, setUpdatedByOptions] = useState<string[]>(() =>
    stripPlaceholderOptions(loadStoredOptions(STORAGE_KEYS.updatedBy, DEFAULT_UPDATED_BY_OPTIONS))
  );
  const [detail, setDetail] = useState<Feedback | null>(null);
  const [editStatus, setEditStatus] = useState<string>('Pending');
  const [editTypeComplaint, setEditTypeComplaint] = useState<string>('Feedback');
  const [editAssignedTo, setEditAssignedTo] = useState<string>('');
  const [editMode, setEditMode] = useState<string>('');
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [editUpdatedBy, setEditUpdatedBy] = useState<string>('');
  const [historyText, setHistoryText] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(tableFeedbacks.length / itemsPerPage);

  const currentFeedbacks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return tableFeedbacks.slice(start, start + itemsPerPage);
  }, [tableFeedbacks, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.dateFrom, filters.dateTo, filters.search, filters.status, filters.store, tableFeedbacks.length]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.status, JSON.stringify(statusOptions));
  }, [statusOptions]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.typeComplaint, JSON.stringify(typeComplaintOptions));
  }, [typeComplaintOptions]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.assignedTo, JSON.stringify(assignedToOptions));
  }, [assignedToOptions]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.mode, JSON.stringify(modeOptions));
  }, [modeOptions]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.updatedBy, JSON.stringify(updatedByOptions));
  }, [updatedByOptions]);

  const tableTitle = useMemo(() => {
    if (title) return title;
    if (filters.status === 'Pending') return 'Pending Feedback Records';
    if (filters.status === 'All') return 'Feedback Records';
    return `${filters.status} Feedback Records`;
  }, [filters.status, title]);

  const openDetail = (fb: Feedback) => {
    setDetail(fb);
    setIsSaving(false);
    setEditStatus(String(fb.status || 'Pending'));
    setEditTypeComplaint(resolveTypeOfComplaint(fb));
    setEditAssignedTo(sanitizeOptionalSelection(fb.assignedTo || fb.userName));
    setEditMode(sanitizeOptionalSelection(fb.mode));
    setHistoryText(String(fb.remarks || fb.statusNotes || ''));
    setEditRemarks('');
    setEditUpdatedBy(sanitizeOptionalSelection(fb.updatedBy));
  };

  const saveDetail = async () => {
    if (!detail || isSaving) return;
    const selectedStatus = (editStatus || '').trim() || String(detail.status || 'Pending');
    const safeAssignedTo = sanitizeOptionalSelection(editAssignedTo);
    const safeMode = sanitizeOptionalSelection(editMode);
    let safeTypeComplaint = (editTypeComplaint || resolveTypeOfComplaint({
      type: detail.type,
      complaint: detail.complaint,
      status: selectedStatus as FeedbackStatus,
    })).trim();
    const safeUpdatedBy = sanitizeOptionalSelection(editUpdatedBy);
    const safeStatus = selectedStatus;
    const previousStatus = String(detail.status || 'Pending').trim();
    const previousTypeComplaint = resolveTypeOfComplaint(detail).trim();
    const previousAssignedTo = String(detail.assignedTo || detail.userName || '').trim();
    const previousMode = String(detail.mode || '').trim();
    const previousUpdatedBy = String(detail.updatedBy || '').trim();
    const noteText = editRemarks.trim();

    const metaChanged =
      safeStatus !== previousStatus ||
      safeTypeComplaint !== previousTypeComplaint ||
      safeAssignedTo !== previousAssignedTo ||
      safeMode !== previousMode ||
      safeUpdatedBy !== previousUpdatedBy;

    const baseHistory = historyText.trim();
    let nextHistory = baseHistory;

    if (noteText || metaChanged) {
      const newEntry = buildHistoryEntry({
        status: safeStatus,
        assignedTo: safeAssignedTo,
        mode: safeMode,
        typeComplaint: safeTypeComplaint,
        updatedBy: safeUpdatedBy,
        note: noteText,
      });
      nextHistory = baseHistory ? `${baseHistory}${HISTORY_SEPARATOR}${newEntry}` : newEntry;
    }

    if (safeStatus && !statusOptions.some(v => v.toLowerCase() === safeStatus.toLowerCase())) {
      setStatusOptions(prev => [...prev, safeStatus]);
    }
    if (safeTypeComplaint && !typeComplaintOptions.some(v => v.toLowerCase() === safeTypeComplaint.toLowerCase())) {
      setTypeComplaintOptions(prev => [...prev, safeTypeComplaint]);
    }
    if (
      safeAssignedTo &&
      !isPlaceholderOption(safeAssignedTo) &&
      !assignedToOptions.some(v => v.toLowerCase() === safeAssignedTo.toLowerCase())
    ) {
      setAssignedToOptions(prev => [...prev, safeAssignedTo]);
    }
    if (
      safeMode &&
      !isPlaceholderOption(safeMode) &&
      !modeOptions.some(v => v.toLowerCase() === safeMode.toLowerCase())
    ) {
      setModeOptions(prev => [...prev, safeMode]);
    }
    if (
      safeUpdatedBy &&
      !isPlaceholderOption(safeUpdatedBy) &&
      !updatedByOptions.some(v => v.toLowerCase() === safeUpdatedBy.toLowerCase())
    ) {
      setUpdatedByOptions(prev => [...prev, safeUpdatedBy]);
    }

    if (!metaChanged && !noteText) {
      setDetail(null);
      return;
    }

    setIsSaving(true);
    try {
      await updateFeedback(detail._id, {
        status: safeStatus as FeedbackStatus,
        type: safeTypeComplaint,
        assignedTo: safeAssignedTo,
        mode: safeMode,
        remarks: nextHistory,
        updatedBy: safeUpdatedBy,
        statusNotes: nextHistory,
      });
      setHistoryText(nextHistory);
      setDetail(null);
    } catch {
      // Error toast is handled in FeedbackContext mutation.
    } finally {
      setIsSaving(false);
    }
  };

  const modalStatusOptions = withCurrentOption(statusOptions, editStatus);
  const modalTypeComplaintOptions = withCurrentOption(typeComplaintOptions, editTypeComplaint);
  const modalAssignedToOptions = withCurrentOption(assignedToOptions, editAssignedTo);
  const modalModeOptions = withCurrentOption(modeOptions, editMode);
  const modalUpdatedByOptions = withCurrentOption(updatedByOptions, editUpdatedBy);
  const historyEntries = useMemo(
    () => splitHistoryEntries(historyText).slice().reverse(),
    [historyText]
  );

  const addNewOption = (
    label: string,
    options: string[],
    setOptions: React.Dispatch<React.SetStateAction<string[]>>,
    onSelect: (value: string) => void,
    currentValue: string,
    onRemoveSelected: () => void
  ) => {
    const rawValue = window.prompt(
      `Add new option for ${label}\nTip: Type -Name to remove directly`,
      ''
    );
    if (rawValue === null) return;
    const typedValue = rawValue.trim();
    const removeViaPrefix = typedValue.startsWith('-');
    const nextValue = removeViaPrefix ? typedValue.slice(1).trim() : typedValue;
    if (!nextValue) return;

    if (isPlaceholderOption(nextValue)) {
      onRemoveSelected();
      return;
    }

    const existing = options.find(option => option.toLowerCase() === nextValue.toLowerCase());

    if (removeViaPrefix) {
      if (!existing) {
        window.alert(`"${nextValue}" not found in ${label} list.`);
        return;
      }
      if (options.length <= 1) {
        window.alert(`At least one option is required for ${label}.`);
        return;
      }

      setOptions(prev => prev.filter(option => option.toLowerCase() !== existing.toLowerCase()));
      if (String(currentValue || '').trim().toLowerCase() === existing.toLowerCase()) {
        onRemoveSelected();
      }
      return;
    }

    if (existing) {
      const shouldRemove = window.confirm(
        `"${existing}" already exists in ${label}.\n\nOK = Remove it from list\nCancel = Keep as is`
      );

      if (!shouldRemove) {
        onSelect(existing);
        return;
      }

      if (options.length <= 1) {
        window.alert(`At least one option is required for ${label}.`);
        onSelect(existing);
        return;
      }

      setOptions(prev => prev.filter(option => option.toLowerCase() !== existing.toLowerCase()));
      if (String(currentValue || '').trim().toLowerCase() === existing.toLowerCase()) {
        onRemoveSelected();
      }
      return;
    }

    setOptions(prev => getUniqueOptions([...prev, nextValue]));
    onSelect(nextValue);
  };

  return (
    <>
    <div className="w-full space-y-4 animate-fade-in relative z-0">
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
          {tableTitle}
          <Badge variant="secondary" className="px-2 py-0.5 text-xs font-normal bg-primary/10 text-primary">
            {tableFeedbacks.length} Total
          </Badge>
        </h3>
      </div>

      <div className="bg-card/50 backdrop-blur-xl border border-border/40 shadow-xl shadow-black/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto w-full pb-4">
          <table className="w-max min-w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary/5 border-b border-primary/10 whitespace-nowrap">
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary/70" /> Timestamp</div></th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase">ID</th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-primary/70" /> Name</div></th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-primary/70" /> Mobile Number</div></th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary/70" /> Store Location</div></th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-primary/70" /> Staff Behavior</div></th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-primary/70" /> Staff Service</div></th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary/70" /> Satisfaction Level</div></th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-primary/70" /> Price Challenge</div></th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><PackageCheck className="w-3.5 h-3.5 text-primary/70" /> Bill Received</div></th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><ThumbsUp className="w-3.5 h-3.5 text-primary/70" /> Your Feedback</div></th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase">Improvement Feedback</th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><PackageX className="w-3.5 h-3.5 text-primary/70" /> Product Unavailable</div></th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase">Receipt Compliance</th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase"><div className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-primary/70" /> Your Complaint</div></th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase">Type of Complaint</th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase">Status</th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase">Assigned To</th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase">Mode</th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase">
                  <div className="flex items-center gap-1.5"><PenSquare className="w-3.5 h-3.5 text-primary/70" /> Remarks</div>
                </th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase">
                  <div className="flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-primary/70" /> Updated By</div>
                </th>
                <th className="py-4 px-4 font-semibold text-[13px] text-foreground/80 tracking-wide uppercase sticky right-0 bg-background/80 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {currentFeedbacks.map((fb) => {
                const rowStatus = String(fb.status || 'Pending');
                const rowAssignedTo = sanitizeOptionalSelection(fb.assignedTo || fb.userName);
                const rowMode = sanitizeOptionalSelection(fb.mode);
                const rowUpdatedBy = sanitizeOptionalSelection(fb.updatedBy);
                const rowTypeComplaint = resolveTypeOfComplaint(fb);
                const rowRecordId = String(fb._id || '').trim();

                return (
                  <tr
                    key={fb._id}
                    className="group hover:bg-primary/[0.03] transition-colors duration-200 whitespace-nowrap"
                  >
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{new Date(fb.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-3 px-4" title={rowRecordId || '-'}>
                      <div className="leading-tight">
                        <span className="text-[11px] font-mono text-foreground/90">{formatRecordId(rowRecordId)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 flex items-center justify-center text-xs font-bold text-primary">
                          {fb.name.charAt(0)}
                        </div>
                        <span className="text-sm font-semibold">{fb.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[13px] font-mono text-muted-foreground">{fb.mobile}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-secondary/50 text-[13px] font-medium border border-border/50">
                        {fb.storeLocation}
                      </span>
                    </td>
                    <td className="py-3 px-4"><RatingStars value={fb.staffBehavior} /></td>
                    <td className="py-3 px-4"><RatingStars value={fb.staffService} /></td>
                    <td className="py-3 px-4 text-xs">{fb.staffSatisfied || '-'}</td>
                    <td className="py-3 px-4 text-xs">{fb.priceChallenge || '-'}</td>
                    <td className="py-3 px-4 text-xs">{fb.billReceived || '-'}</td>
                    <td className="py-3 px-4 max-w-[170px] truncate text-xs">{fb.feedback || '-'}</td>
                    <td className="py-3 px-4 max-w-[170px] truncate text-xs">{fb.improvementFeedback || fb.suggestions || '-'}</td>
                    <td className="py-3 px-4 max-w-[170px] truncate text-xs">{fb.productUnavailable || '-'}</td>
                    <td className="py-3 px-4 text-xs">{fb.billCompliance || '-'}</td>
                    <td className="py-3 px-4 max-w-[170px] truncate text-xs">{fb.complaint || '-'}</td>
                    <td className="py-3 px-4 text-xs">{rowTypeComplaint || '-'}</td>
                    <td className="py-3 px-4 text-xs">
                      <Badge variant="secondary" className={`text-xs font-medium ${STATUS_COLORS[rowStatus as FeedbackStatus] || ''}`}>
                        {rowStatus}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs">{rowAssignedTo || 'Unassigned'}</td>
                    <td className="py-3 px-4 text-xs">{rowMode || '-'}</td>
                    <td className="py-3 px-4 max-w-[220px] truncate text-xs">{extractLatestNote(fb.remarks || fb.statusNotes || '') || '-'}</td>
                    <td className="py-3 px-4 text-xs">{rowUpdatedBy || '-'}</td>
                    <td className="py-3 px-4 text-right sticky right-0 bg-background group-hover:bg-muted/30 transition-colors shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] border-l border-border/20 z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                        onClick={() => openDetail(fb)}
                        title={readOnly ? 'View' : 'View/Edit'}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {currentFeedbacks.length === 0 && (
                <tr>
                  <td colSpan={22} className="py-12 text-center text-muted-foreground">
                    No feedback records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/40 bg-card/30">
            <span className="text-xs text-muted-foreground">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, tableFeedbacks.length)} of {tableFeedbacks.length} entries
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                &lt;
              </Button>
              <div className="flex items-center gap-1 px-2">
                <span className="text-sm font-semibold">{currentPage} / {totalPages}</span>
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                &gt;
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
    <Dialog open={!!detail} onOpenChange={(open) => !open && !isSaving && setDetail(null)}>
      <DialogContent className="max-w-3xl border-border/50 shadow-2xl backdrop-blur-3xl overflow-hidden p-0 z-[9999]">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary to-accent" />
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
              <User className="w-4 h-4" />
            </div>
            {(detail && resolveTypeOfComplaint(detail).toLowerCase() === 'complaint') ? 'Complaint Details' : 'Feedback Details'} ({detail?.name})
          </DialogTitle>
          <DialogDescription className="sr-only">
            Feedback details and update form
          </DialogDescription>
        </DialogHeader>

        {detail && (
          <div className="px-6 pb-6 space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-secondary/30 p-4 rounded-xl border border-border/40 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div><span className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold tracking-wider">Name</span> <span className="font-semibold text-sm">{detail.name}</span></div>
              <div><span className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold tracking-wider">Mobile</span> <span className="font-mono text-sm tracking-wide">{detail.mobile}</span></div>
              <div><span className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold tracking-wider">Store</span> <Badge variant="outline" className="text-xs bg-background">{detail.storeLocation}</Badge></div>
              <div><span className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold tracking-wider">Submission</span> <span className="text-sm font-medium">{new Date(detail.createdAt).toLocaleString('en-IN')}</span></div>
              <div title={detail._id}><span className="text-[10px] text-muted-foreground block mb-1 uppercase font-bold tracking-wider">ID</span> <span className="font-mono text-[11px] tracking-wide break-all">{detail._id || '-'}</span></div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> Ratings & Service</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                    <p className="text-xs text-muted-foreground">Staff Behaviour</p>
                    <RatingStars value={detail.staffBehavior} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                    <p className="text-xs text-muted-foreground">Staff Service</p>
                    <RatingStars value={detail.staffService} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                    <p className="text-xs text-muted-foreground">Overall Satisfaction</p>
                    <span className="text-sm font-bold text-primary">{detail.staffSatisfied || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                    <p className="text-xs text-muted-foreground">Price Challenge</p>
                    <span className="text-sm font-bold text-accent">{detail.priceChallenge || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><PackageCheck className="w-3.5 h-3.5" /> Purchase Details</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                    <p className="text-xs text-muted-foreground">Bill Received</p>
                    <Badge variant={(String(detail.billReceived || '').toUpperCase() === 'YES') ? 'default' : 'destructive'} className={(String(detail.billReceived || '').toUpperCase() === 'YES') ? 'bg-success h-5' : 'h-5'}>
                      {detail.billReceived || 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                    <p className="text-xs text-muted-foreground">Bill Compliance</p>
                    <span className="text-sm font-medium">{detail.billCompliance || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><ThumbsUp className="w-3.5 h-3.5" /> Verbatim Feedback</h4>
              <div className="grid md:grid-cols-2 gap-4">
                {detail.feedback && (
                  <div className="border border-primary/10 rounded-xl overflow-hidden">
                    <div className="bg-primary/5 px-3 py-1.5 border-b border-primary/10"><p className="text-[10px] font-bold text-primary uppercase tracking-wider">Your Feedback</p></div>
                    <div className="p-3 bg-background/50 text-sm italic">"{detail.feedback}"</div>
                  </div>
                )}
                {(detail.improvementFeedback || detail.suggestions) && (
                  <div className="border border-success/10 rounded-xl overflow-hidden">
                    <div className="bg-success/5 px-3 py-1.5 border-b border-success/10"><p className="text-[10px] font-bold text-success uppercase tracking-wider">Improvement Feedback</p></div>
                    <div className="p-3 bg-background/50 text-sm italic">"{detail.improvementFeedback || detail.suggestions}"</div>
                  </div>
                )}
                {detail.complaint && (
                  <div className="border border-destructive/10 rounded-xl overflow-hidden md:col-span-2">
                    <div className="bg-destructive/5 px-3 py-1.5 border-b border-destructive/10"><p className="text-[10px] font-bold text-destructive uppercase tracking-wider">Your Complaint</p></div>
                    <div className="p-3 bg-background/50 text-sm font-medium text-destructive">{detail.complaint}</div>
                  </div>
                )}
                {detail.productUnavailable && (
                  <div className="border border-warning/10 rounded-xl overflow-hidden md:col-span-2">
                    <div className="bg-warning/5 px-3 py-1.5 border-b border-warning/10"><p className="text-[10px] font-bold text-warning uppercase tracking-wider">Product Unavailable Details</p></div>
                    <div className="p-3 bg-background/50 text-sm">{detail.productUnavailable}</div>
                  </div>
                )}
              </div>
            </div>

            {!readOnly && (
              <div className="pt-6 border-t border-border/50 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Administrative Resolution</p>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/[0.18] p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2 min-h-[30px]">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-[1.15] min-h-[24px] flex items-start pr-1">Type of Complaint</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => addNewOption('Type of Complaint', typeComplaintOptions, setTypeComplaintOptions, setEditTypeComplaint, editTypeComplaint, () => setEditTypeComplaint('Feedback'))}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    <Select value={editTypeComplaint || 'Feedback'} onValueChange={setEditTypeComplaint}>
                      <SelectTrigger className="h-9 text-xs font-medium border-border/60 bg-background shadow-sm">
                        <SelectValue placeholder="Type of Complaint" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {modalTypeComplaintOptions.map(option => (
                          <SelectItem key={option} value={option} className="text-xs">{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2 min-h-[30px]">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-[1.15] min-h-[24px] flex items-start pr-1">Assign To</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => addNewOption('Assign To', assignedToOptions, setAssignedToOptions, setEditAssignedTo, editAssignedTo, () => setEditAssignedTo(''))}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    <Select value={editAssignedTo || undefined} onValueChange={setEditAssignedTo}>
                      <SelectTrigger className="h-9 text-xs font-medium border-border/60 bg-background shadow-sm">
                        <SelectValue placeholder="Assign To" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {modalAssignedToOptions.map(option => (
                          <SelectItem key={option} value={option} className="text-xs">{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2 min-h-[30px]">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-[1.15] min-h-[24px] flex items-start pr-1">Mark As</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => addNewOption('Mark As', statusOptions, setStatusOptions, setEditStatus, editStatus, () => setEditStatus('Pending'))}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    <Select value={editStatus || 'Pending'} onValueChange={setEditStatus}>
                      <SelectTrigger className={`h-9 text-xs font-semibold border-border/60 bg-background shadow-sm ${STATUS_COLORS[(editStatus || 'Pending') as FeedbackStatus] || ''}`}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {modalStatusOptions.map(s => (
                          <SelectItem key={s} value={s} className="text-xs font-medium">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2 min-h-[30px]">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-[1.15] min-h-[24px] flex items-start pr-1">Mode</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => addNewOption('Mode', modeOptions, setModeOptions, setEditMode, editMode, () => setEditMode(''))}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    <Select value={editMode || undefined} onValueChange={setEditMode}>
                      <SelectTrigger className="h-9 text-xs font-medium border-border/60 bg-background shadow-sm">
                        <SelectValue placeholder="Mode" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {modalModeOptions.map(option => (
                          <SelectItem key={option} value={option} className="text-xs">{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2 min-h-[30px]">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-[1.15] min-h-[24px] flex items-start pr-1">Updated By</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => addNewOption('Updated By', updatedByOptions, setUpdatedByOptions, setEditUpdatedBy, editUpdatedBy, () => setEditUpdatedBy(''))}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    <Select value={editUpdatedBy || undefined} onValueChange={setEditUpdatedBy}>
                      <SelectTrigger className="h-9 text-xs font-medium border-border/60 bg-background shadow-sm">
                        <SelectValue placeholder="Updated By" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {modalUpdatedByOptions.map(option => (
                          <SelectItem key={option} value={option} className="text-xs">{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Add New Note</span>
                    <Textarea
                      value={editRemarks}
                      onChange={(e) => setEditRemarks(e.target.value)}
                      placeholder="Write a new follow-up note for this update..."
                      rows={3}
                      className="resize-none text-sm bg-background border-border/60 focus-visible:ring-primary/40"
                    />
                  </div>

                </div>
              </div>
            )}

            <div className={`space-y-2 ${readOnly ? 'pt-2' : 'pt-1'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Update History</span>
                <span className="text-[10px] text-muted-foreground">{historyEntries.length} entries</span>
              </div>
              {historyEntries.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border/60 bg-background divide-y divide-border/50">
                  {historyEntries.map((entry, idx) => (
                    <div key={`${idx}-${entry.slice(0, 20)}`} className="p-2.5">
                      <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/85">{entry}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                  No update history yet.
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border/40 flex items-center justify-between">
          <Button variant="outline" className="font-semibold" onClick={() => setDetail(null)} disabled={isSaving}>
            {readOnly ? 'Close' : 'Discard'}
          </Button>
          {!readOnly && (
            <Button onClick={saveDetail} className="shadow-lg shadow-primary/25 font-bold px-8" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save & Sync'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
