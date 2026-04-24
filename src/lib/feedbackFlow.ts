import type { FeedbackStatus } from '@/types/feedback';

const STATUS_ALIAS_MAP: Record<string, FeedbackStatus> = {
  'new': 'New',
  'active': 'Active',
  'in progress': 'In Progress',
  'in process': 'In Progress',
  'pending': 'Pending',
  'complaint': 'Complaint',
  'feedback': 'Feedback',
  'solved': 'Solved',
  'resolved': 'Resolved',
  'closed': 'Closed',
  'archived': 'Archived',
  'fake': 'Fake',
  'channel partner store': 'Channel Partner Store',
  'channel partner': 'Channel Partner',
};

export const WORKING_STATUS_KEYS = new Set([
  'new',
  'active',
  'in progress',
  'in_progress',
  'pending',
  'complaint',
  'feedback',
  'channel partner store',
  'channel partner',
]);

export const HISTORICAL_STATUS_KEYS = new Set([
  'solved',
  'resolved',
  'closed',
  'archived',
  'fake',
]);

export const RESOLVED_STATUS_KEYS = new Set([
  'solved',
  'resolved',
  'closed',
  'archived',
]);

export function normalizeStatusKey(value: unknown) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[|/]+/g, ' ')
    .replace(/\brecords?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';

  if (normalized.includes('resolved') && normalized.includes('closed')) {
    return 'resolved';
  }

  if (normalized === 'in process') {
    return 'in progress';
  }

  return normalized;
}

export function toCanonicalFeedbackStatus(value: unknown, fallback?: FeedbackStatus): FeedbackStatus | string {
  const raw = String(value || '').trim();
  const key = normalizeStatusKey(raw);

  if (!key) return fallback || '';

  const mapped = STATUS_ALIAS_MAP[key];
  if (mapped) return mapped;

  if (key.startsWith('resolved')) return 'Resolved';
  if (key.startsWith('closed')) return 'Closed';
  if (key.startsWith('archived')) return 'Archived';
  if (key.startsWith('solved')) return 'Solved';

  return raw;
}

export function isWorkingStatus(value: unknown) {
  const key = normalizeStatusKey(value);
  return !key || WORKING_STATUS_KEYS.has(key);
}

export function isHistoricalStatus(value: unknown) {
  return HISTORICAL_STATUS_KEYS.has(normalizeStatusKey(value));
}

export function isResolvedStatus(value: unknown) {
  return RESOLVED_STATUS_KEYS.has(normalizeStatusKey(value));
}

export function getResolutionTimestampPatch(status: FeedbackStatus | string) {
  const key = normalizeStatusKey(status);
  const now = new Date().toISOString();

  if (key === 'closed') {
    return { resolved_at: now, closed_at: now };
  }

  if (key === 'archived') {
    return { resolved_at: now, archived_at: now };
  }

  if (key === 'solved' || key === 'resolved') {
    return { resolved_at: now };
  }

  return {};
}
