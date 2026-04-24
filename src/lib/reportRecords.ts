import { supabase, supabasePublic } from '@/lib/supabase';
import { isHistoricalStatus, toCanonicalFeedbackStatus } from '@/lib/feedbackFlow';
import type { Feedback } from '@/types/feedback';
import type { SupabaseClient } from '@supabase/supabase-js';

const WORKING_DATA_SCHEMA = 'public';
const WORKING_DATA_TABLE = 'working_data';
const MIGRATION_DATA_TABLE = 'migration_data';

export type ReportSource = 'working' | 'migration';

export type MigrationRow = {
  id?: string;
  record_id?: string;
  external_id?: string;
  created_at?: string;
  updated_at?: string;
  Timestamp?: string;
  name?: string;
  Name?: string;
  mobile?: string | number;
  'Mobile Number'?: string | number;
  store_location?: string;
  'Store Location'?: string;
  staff_behavior?: string | number;
  'Staff Behavior'?: string | number;
  staff_service?: string | number;
  'Staff Service'?: string | number;
  store_satisfaction?: string | number;
  staff_satisfied?: string;
  'Satisfaction Level'?: string | number;
  bill_received?: string | boolean;
  'Bill Received'?: string;
  complaint?: string;
  'Your Complaint'?: string;
  feedback?: string;
  'Your Feedback'?: string;
  type?: string;
  'Type Complaint'?: string;
  status?: string;
  Status?: string;
  user_name?: string;
  'Assigned To'?: string;
  mode?: string;
  Mode?: string;
  updated_by?: string;
  'Updated By'?: string;
  product_unavailable?: string;
  'Product Unavailable'?: string;
  resolved_at?: string;
  closed_at?: string;
  archived_at?: string;
};

export type ReportRecord = {
  recordId: string;
  source: ReportSource;
  name: string;
  mobile: string;
  status: string;
  store: string;
  assignedTo: string;
  updatedBy: string;
  mode: string;
  complaint: string;
  feedback: string;
  complaintType: string;
  productUnavailable: string;
  billReceived: string;
  staffSatisfied: string;
  staffBehavior: number;
  staffService: number;
  createdAt: string;
  updatedAt: string;
};

export function normalizeValue(value: unknown) {
  return String(value || '').trim();
}

export function normalizeKey(value: unknown) {
  return normalizeValue(value).toLowerCase();
}

const WORKING_QUEUE_STATUS_KEYS = new Set([
  'pending',
  'complaint',
  'in process',
  'in progress',
]);

function normalizeQueueStatus(value: unknown) {
  return normalizeKey(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Mirrors Resolved/Closed page source behavior: include every non-working-queue entry.
export function isResolvedOrClosedSourceEntry(value: unknown) {
  return !WORKING_QUEUE_STATUS_KEYS.has(normalizeQueueStatus(value));
}

export function parseRating(value: unknown) {
  if (typeof value === 'number') return value;
  const text = normalizeValue(value);
  if (!text) return 0;
  const direct = Number(text);
  if (!Number.isNaN(direct)) return direct;
  const digits = text.match(/\d+/);
  return digits ? Number(digits[0]) : 0;
}

export function normalizeStatus(value: unknown) {
  const canonical = normalizeValue(toCanonicalFeedbackStatus(value));
  return canonical || 'Unknown';
}

export function resolveRecordId(primary?: unknown, secondary?: unknown) {
  const primaryValue = normalizeValue(primary);
  if (primaryValue) return primaryValue;

  const secondaryValue = normalizeValue(secondary);
  if (secondaryValue) return secondaryValue;

  return '';
}

export function csvEscape(value: unknown) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('\n') || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toWorkingRecord(row: Feedback): ReportRecord {
  const createdAt = normalizeValue(row.createdAt) || new Date().toISOString();
  const updatedAt = normalizeValue(row.updatedAt) || createdAt;
  const mobile = normalizeValue(row.mobile);
  const dbRecordId = resolveRecordId(row._id, row.externalId);
  return {
    recordId: dbRecordId,
    source: 'working',
    name: normalizeValue(row.name),
    mobile,
    status: normalizeStatus(row.status),
    store: normalizeValue(row.storeLocation) || 'Unknown',
    assignedTo: normalizeValue(row.assignedTo || row.userName) || 'Unassigned',
    updatedBy: normalizeValue(row.updatedBy) || 'Unassigned',
    mode: normalizeValue(row.mode) || 'Unknown',
    complaint: normalizeValue(row.complaint),
    feedback: normalizeValue(row.feedback),
    complaintType: normalizeValue(row.type) || 'Unspecified',
    productUnavailable: normalizeValue(row.productUnavailable),
    billReceived: normalizeValue(row.billReceived),
    staffSatisfied: normalizeValue(row.staffSatisfied),
    staffBehavior: parseRating(row.staffBehavior),
    staffService: parseRating(row.staffService),
    createdAt,
    updatedAt,
  };
}

export function toMigrationRecord(row: MigrationRow): ReportRecord {
  const createdAt = normalizeValue(row.Timestamp ?? row.created_at) || new Date().toISOString();
  const updatedAt = normalizeValue(row.updated_at ?? row.closed_at ?? row.resolved_at ?? row.archived_at) || createdAt;
  const mobile = normalizeValue(row['Mobile Number'] ?? row.mobile);
  const dbRecordId = resolveRecordId(row.id, row.record_id || row.external_id);
  return {
    recordId: dbRecordId,
    source: 'migration',
    name: normalizeValue(row.Name ?? row.name),
    mobile,
    status: normalizeStatus(row.Status ?? row.status),
    store: normalizeValue(row['Store Location'] ?? row.store_location) || 'Unknown',
    assignedTo: normalizeValue(row['Assigned To'] ?? row.user_name) || 'Unassigned',
    updatedBy: normalizeValue(row['Updated By'] ?? row.updated_by) || 'Unassigned',
    mode: normalizeValue(row.Mode ?? row.mode) || 'Unknown',
    complaint: normalizeValue(row['Your Complaint'] ?? row.complaint),
    feedback: normalizeValue(row['Your Feedback'] ?? row.feedback),
    complaintType: normalizeValue(row['Type Complaint'] ?? row.type) || 'Unspecified',
    productUnavailable: normalizeValue(row['Product Unavailable'] ?? row.product_unavailable),
    billReceived: normalizeValue(row['Bill Received'] ?? row.bill_received),
    staffSatisfied: normalizeValue(row['Satisfaction Level'] ?? row.staff_satisfied ?? row.store_satisfaction),
    staffBehavior: parseRating(row['Staff Behavior'] ?? row.staff_behavior),
    staffService: parseRating(row['Staff Service'] ?? row.staff_service),
    createdAt,
    updatedAt,
  };
}

export function toResolvedClosedWorkingRecord(row: MigrationRow): ReportRecord {
  const createdAt = normalizeValue(row.Timestamp ?? row.created_at) || new Date().toISOString();
  const updatedAt = normalizeValue(row.updated_at ?? row.closed_at ?? row.resolved_at ?? row.archived_at) || createdAt;
  const mobile = normalizeValue(row['Mobile Number'] ?? row.mobile);
  const dbRecordId = resolveRecordId(row.id, row.record_id || row.external_id);
  return {
    recordId: dbRecordId,
    source: 'working',
    name: normalizeValue(row.Name ?? row.name),
    mobile,
    status: normalizeStatus(row.Status ?? row.status),
    store: normalizeValue(row['Store Location'] ?? row.store_location) || 'Unknown',
    assignedTo: normalizeValue(row['Assigned To'] ?? row.user_name) || 'Unassigned',
    updatedBy: normalizeValue(row['Updated By'] ?? row.updated_by) || 'Unassigned',
    mode: normalizeValue(row.Mode ?? row.mode) || 'Unknown',
    complaint: normalizeValue(row['Your Complaint'] ?? row.complaint),
    feedback: normalizeValue(row['Your Feedback'] ?? row.feedback),
    complaintType: normalizeValue(row['Type of Complaint'] ?? row['Type Complaint'] ?? row.type) || 'Unspecified',
    productUnavailable: normalizeValue(row['Product Unavailable'] ?? row.product_unavailable),
    billReceived: normalizeValue(row['Bill Received'] ?? row.bill_received),
    staffSatisfied: normalizeValue(row['Satisfaction Level'] ?? row.staff_satisfied ?? row.store_satisfaction),
    staffBehavior: parseRating(row['Staff Behavior'] ?? row.staff_behavior),
    staffService: parseRating(row['Staff Service'] ?? row.staff_service),
    createdAt,
    updatedAt,
  };
}

async function loadPagedRows(
  tableOrView: string,
  useLegacySchema = false,
  client: SupabaseClient = supabase
) {
  const pageSize = 1000;
  const records: MigrationRow[] = [];
  let from = 0;

  while (true) {
    const query = useLegacySchema
      ? client.schema(WORKING_DATA_SCHEMA).from(tableOrView)
      : client.from(tableOrView);

    const { data, error } = await query
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    records.push(...(data as MigrationRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return records;
}

export async function fetchMigrationReportRows() {
  try {
    return await loadPagedRows(MIGRATION_DATA_TABLE, true, supabase);
  } catch {
    const rows = await loadPagedRows(WORKING_DATA_TABLE, true, supabase);
    return rows.filter(row =>
      isHistoricalStatus(row.status ?? row.Status) ||
      Boolean(row.resolved_at || row.closed_at || row.archived_at)
    );
  }
}

export async function fetchResolvedClosedWorkingRows() {
  try {
    const rows = await loadPagedRows(WORKING_DATA_TABLE, true, supabase);
    const filtered = rows.filter(row => isResolvedOrClosedSourceEntry(row.status ?? row.Status));
    if (filtered.length > 0) return filtered;
  } catch {
    // Fall through to anon/public client below.
  }

  const publicRows = await loadPagedRows(WORKING_DATA_TABLE, true, supabasePublic);
  return publicRows.filter(row => isResolvedOrClosedSourceEntry(row.status ?? row.Status));
}

export async function fetchReportingSourceRows() {
  const [migrationRows, resolvedClosedWorkingRows] = await Promise.all([
    fetchMigrationReportRows(),
    fetchResolvedClosedWorkingRows(),
  ]);

  return { migrationRows, resolvedClosedWorkingRows };
}
