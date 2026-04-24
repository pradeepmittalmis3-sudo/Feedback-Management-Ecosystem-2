import { useQuery } from '@tanstack/react-query';
import { AUTO_REFRESH_MS } from '@/lib/autoRefresh';
import { supabase } from '@/lib/supabase';

export type MigrationDashboardFilters = {
  startDate: string;
  endDate: string;
  store: string;
  status: string;
  assignedTo: string;
  updatedBy: string;
};

export type DashboardSummary = {
  total_entries: number;
  feedback: number;
  complaints: number;
  resolved: number;
  pending: number;
  low_ratings: number;
  price_challenge: number;
  bill_received: number;
};

export type StatusBreakdownRow = {
  status: string;
  total: number;
  percentage: number;
};

export type TypeBreakdownRow = {
  type_complaint: string;
  total: number;
  complaint_count: number;
  feedback_count: number;
};

export type StoreReportRow = {
  store_location: string;
  total_records: number;
  complaint_count: number;
  feedback_count: number;
  pending_count: number;
  resolved_count: number;
  avg_overall_rating: number | null;
};

export type ComplaintVsFeedbackRow = {
  label: string;
  total: number;
};

export type PendingComplaintRow = {
  db_id: string;
  record_id: string;
  created_at_ist: string;
  store_location: string;
  status: string;
  assigned_to: string;
  type_complaint: string;
  complaint: string | null;
  mobile: string | null;
  remarks: string | null;
};

export type TopComplaintStoreRow = {
  store_location: string;
  total_complaints: number;
  pending_count: number;
  resolved_count: number;
};

export type ComplaintReport = {
  complaint_vs_feedback: ComplaintVsFeedbackRow[];
  pending_complaints: PendingComplaintRow[];
  top_complaint_stores: TopComplaintStoreRow[];
};

export type AssignedReportRow = {
  assigned_to: string;
  total: number;
  pending_count: number;
  resolved_count: number;
  complaint_count: number;
};

export type UpdatedByReportRow = {
  updated_by: string;
  total: number;
  pending_count: number;
  resolved_count: number;
  complaint_count: number;
};

export type ModeReportRow = {
  mode: string;
  total: number;
  complaint_count: number;
  feedback_count: number;
};

export type RatingSummary = {
  avg_staff_behavior: number | null;
  avg_staff_service: number | null;
  avg_satisfaction_level: number | null;
  avg_overall_rating: number | null;
  low_rating_count: number;
};

export type LowRatingRecordRow = {
  db_id: string;
  record_id: string;
  created_at_ist: string;
  customer_name: string | null;
  mobile: string | null;
  store_location: string;
  status: string;
  assigned_to: string;
  updated_by: string;
  staff_behavior: number | null;
  staff_service: number | null;
  satisfaction_level: number | null;
  overall_rating: number | null;
  complaint: string | null;
  remarks: string | null;
};

export type LatestRemarkRow = {
  db_id: string;
  record_id: string;
  created_at_ist: string;
  updated_at_ist: string;
  store_location: string;
  status: string;
  assigned_to: string;
  updated_by: string;
  remarks: string | null;
};

export type DailyTrendRow = {
  entry_date: string;
  total: number;
  complaints: number;
  feedback: number;
  resolved: number;
  pending: number;
};

export type MonthlyTrendRow = {
  month_date: string;
  entry_month: string;
  total: number;
  complaints: number;
  feedback: number;
  resolved: number;
  pending: number;
};

export type StoreStatusMatrixRow = {
  store_location: string;
  status: string;
  total: number;
};

export type AssignedStatusMatrixRow = {
  assigned_to: string;
  status: string;
  total: number;
};

export type FilterOptions = {
  stores: string[];
  statuses: string[];
  assigned_to: string[];
  updated_by: string[];
};

export type MigrationFeedbackDashboard = {
  summary: DashboardSummary;
  status_breakdown: StatusBreakdownRow[];
  type_breakdown: TypeBreakdownRow[];
  store_report: StoreReportRow[];
  complaint_report: ComplaintReport;
  assigned_report: AssignedReportRow[];
  updated_by_report: UpdatedByReportRow[];
  mode_report: ModeReportRow[];
  rating_summary: RatingSummary;
  low_rating_records: LowRatingRecordRow[];
  latest_remarks: LatestRemarkRow[];
  daily_trend: DailyTrendRow[];
  monthly_trend: MonthlyTrendRow[];
  store_status_matrix: StoreStatusMatrixRow[];
  assigned_status_matrix: AssignedStatusMatrixRow[];
  filter_options: FilterOptions;
};

const EMPTY_DASHBOARD: MigrationFeedbackDashboard = {
  summary: {
    total_entries: 0,
    feedback: 0,
    complaints: 0,
    resolved: 0,
    pending: 0,
    low_ratings: 0,
    price_challenge: 0,
    bill_received: 0,
  },
  status_breakdown: [],
  type_breakdown: [],
  store_report: [],
  complaint_report: {
    complaint_vs_feedback: [],
    pending_complaints: [],
    top_complaint_stores: [],
  },
  assigned_report: [],
  updated_by_report: [],
  mode_report: [],
  rating_summary: {
    avg_staff_behavior: null,
    avg_staff_service: null,
    avg_satisfaction_level: null,
    avg_overall_rating: null,
    low_rating_count: 0,
  },
  low_rating_records: [],
  latest_remarks: [],
  daily_trend: [],
  monthly_trend: [],
  store_status_matrix: [],
  assigned_status_matrix: [],
  filter_options: {
    stores: [],
    statuses: [],
    assigned_to: [],
    updated_by: [],
  },
};

function normalizeArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeFilterValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'All') return null;
  return trimmed;
}

function normalizeDashboardPayload(payload: unknown): MigrationFeedbackDashboard {
  if (!payload || typeof payload !== 'object') return EMPTY_DASHBOARD;
  const source = payload as Partial<MigrationFeedbackDashboard>;

  return {
    ...EMPTY_DASHBOARD,
    ...source,
    summary: { ...EMPTY_DASHBOARD.summary, ...(source.summary || {}) },
    complaint_report: {
      ...EMPTY_DASHBOARD.complaint_report,
      ...(source.complaint_report || {}),
      complaint_vs_feedback: normalizeArray<ComplaintVsFeedbackRow>(source.complaint_report?.complaint_vs_feedback),
      pending_complaints: normalizeArray<PendingComplaintRow>(source.complaint_report?.pending_complaints),
      top_complaint_stores: normalizeArray<TopComplaintStoreRow>(source.complaint_report?.top_complaint_stores),
    },
    rating_summary: { ...EMPTY_DASHBOARD.rating_summary, ...(source.rating_summary || {}) },
    filter_options: {
      ...EMPTY_DASHBOARD.filter_options,
      ...(source.filter_options || {}),
      stores: normalizeArray<string>(source.filter_options?.stores),
      statuses: normalizeArray<string>(source.filter_options?.statuses),
      assigned_to: normalizeArray<string>(source.filter_options?.assigned_to),
      updated_by: normalizeArray<string>(source.filter_options?.updated_by),
    },
    status_breakdown: normalizeArray<StatusBreakdownRow>(source.status_breakdown),
    type_breakdown: normalizeArray<TypeBreakdownRow>(source.type_breakdown),
    store_report: normalizeArray<StoreReportRow>(source.store_report),
    assigned_report: normalizeArray<AssignedReportRow>(source.assigned_report),
    updated_by_report: normalizeArray<UpdatedByReportRow>(source.updated_by_report),
    mode_report: normalizeArray<ModeReportRow>(source.mode_report),
    low_rating_records: normalizeArray<LowRatingRecordRow>(source.low_rating_records),
    latest_remarks: normalizeArray<LatestRemarkRow>(source.latest_remarks),
    daily_trend: normalizeArray<DailyTrendRow>(source.daily_trend),
    monthly_trend: normalizeArray<MonthlyTrendRow>(source.monthly_trend),
    store_status_matrix: normalizeArray<StoreStatusMatrixRow>(source.store_status_matrix),
    assigned_status_matrix: normalizeArray<AssignedStatusMatrixRow>(source.assigned_status_matrix),
  };
}

type RpcErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function isMissingDashboardRpcError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const source = error as RpcErrorLike;
  const code = String(source.code || '').toUpperCase();
  const message = String(source.message || '').toLowerCase();
  const details = String(source.details || '').toLowerCase();
  const hint = String(source.hint || '').toLowerCase();

  if (code === 'PGRST202') return true;
  if (message.includes('could not find the function')) return true;
  if (message.includes('get_migration_feedback_dashboard') && message.includes('not found')) return true;
  if (details.includes('get_migration_feedback_dashboard') && details.includes('not found')) return true;
  if (hint.includes('get_migration_feedback_dashboard')) return true;

  return false;
}

async function fetchMigrationFeedbackDashboard(filters: MigrationDashboardFilters) {
  const { data, error } = await supabase.rpc('get_migration_feedback_dashboard', {
    p_start_date: filters.startDate || null,
    p_end_date: filters.endDate || null,
    p_store: normalizeFilterValue(filters.store),
    p_status: normalizeFilterValue(filters.status),
    p_assigned_to: normalizeFilterValue(filters.assignedTo),
    p_updated_by: normalizeFilterValue(filters.updatedBy),
  });

  if (error) throw error;
  return normalizeDashboardPayload(data);
}

export function useMigrationFeedbackDashboard(filters: MigrationDashboardFilters) {
  return useQuery({
    queryKey: ['reports', 'migration-feedback-dashboard', filters],
    queryFn: () => fetchMigrationFeedbackDashboard(filters),
    staleTime: 1000 * 60,
    refetchInterval: query => {
      if (AUTO_REFRESH_MS <= 0) return false;
      if (isMissingDashboardRpcError(query.state.error)) return false;
      return AUTO_REFRESH_MS;
    },
    refetchIntervalInBackground: AUTO_REFRESH_MS > 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      if (isMissingDashboardRpcError(error)) return false;
      return failureCount < 2;
    },
  });
}
