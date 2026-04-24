import { supabase } from '@/lib/supabase';

export const WORKING_DATA_TABLE = 'working_data';
export const FEEDBACK_TABLE = WORKING_DATA_TABLE;

type FeedbackSaveInput = {
  record_id?: string;
  source?: string;
  Name?: string;
  'Mobile Number'?: string;
  'Store Location'?: string;
  'Staff Behavior'?: string | number;
  'Staff Service'?: string | number;
  'Satisfaction Level'?: string | number;
  'Price Challenge'?: string | boolean;
  'Bill Received'?: string | boolean;
  'Your Complaint'?: string;
  'Your Feedback'?: string;
  'Improvement Feedback'?: string;
  'Product Unavailable'?: string;
  'Receipt Compliance'?: string;
  'Assigned To'?: string;
  Mode?: string;
  Remarks?: string;
  'Updated By'?: string;
  'Type Complaint'?: string;
  'Type of Complaint'?: string;
  Status?: string;
  name?: string;
  mobile?: string;
  mobileNumber?: string;
  storeLocation?: string;
  staffBehavior?: string | number;
  staffService?: string | number;
  storeSatisfaction?: string | number;
  priceChallengeOk?: boolean | string;
  billReceived?: boolean | string;
  complaint?: string;
  feedback?: string;
  suggestions?: string;
  productUnavailable?: string;
  noPurchaseWithoutBill?: string;
  assignedTo?: string;
  mode?: string;
  remarks?: string;
  updatedBy?: string;
  type?: string;
  status?: string;
};

type FeedbackUpdateInput = Partial<{
  Name: string;
  'Mobile Number': string;
  'Store Location': string;
  Status: string;
  'Assigned To': string;
  Mode: string;
  Remarks: string;
  'Updated By': string;
  'Type Complaint': string;
  'Type of Complaint': string;
  status: string;
  assignedTo: string;
  mode: string;
  remarks: string;
  updatedBy: string;
  type: string;
}>;

type ErrorLike = {
  message?: string;
  error_description?: string;
  hint?: string;
  error?: string;
};

function getErrorMessage(result: unknown, fallback: string) {
  if (result && typeof result === 'object') {
    const parsed = result as ErrorLike;
    return (
      parsed.message ||
      parsed.error_description ||
      parsed.hint ||
      parsed.error ||
      fallback
    );
  }
  return fallback;
}

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function parseRating(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.min(5, Math.round(value)));
  }

  const raw = cleanText(value);
  if (!raw) return fallback;

  const direct = Number(raw);
  if (!Number.isNaN(direct)) {
    return Math.max(1, Math.min(5, Math.round(direct)));
  }

  const digits = raw.match(/\d+/);
  if (!digits) return fallback;
  return Math.max(1, Math.min(5, Number(digits[0])));
}

function parseBoolean(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value;

  const raw = cleanText(value).toLowerCase();
  if (!raw) return fallback;
  if (['true', 't', 'yes', 'y', '1'].includes(raw)) return true;
  if (['false', 'f', 'no', 'n', '0'].includes(raw)) return false;

  return fallback;
}

function toYesNo(value: unknown, fallback = true) {
  return parseBoolean(value, fallback) ? 'YES' : 'NO';
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function resolveFeedbackType(input: FeedbackSaveInput, status: string) {
  const explicit = cleanText(input['Type Complaint'] ?? input['Type of Complaint'] ?? input.type);
  if (explicit) return explicit;

  const complaint = cleanText(input['Your Complaint'] ?? input.complaint);
  if (complaint || status.toLowerCase() === 'complaint') return 'Complaint';

  return 'Feedback';
}

export function buildFeedbackPayload(data: FeedbackSaveInput) {
  const mobile = cleanText(data['Mobile Number'] ?? data.mobileNumber ?? data.mobile);
  const timestamp = new Date().toISOString();
  const providedRecordId = cleanText(data.record_id);
  const name = cleanText(data.Name ?? data.name);
  const storeLocation = cleanText(data['Store Location'] ?? data.storeLocation);
  const status = cleanText(data.Status ?? data.status) || 'Pending';
  const staffBehavior = parseRating(data['Staff Behavior'] ?? data.staffBehavior);
  const staffService = parseRating(data['Staff Service'] ?? data.staffService);
  const storeSatisfaction = parseRating(
    data['Satisfaction Level'] ?? data.storeSatisfaction,
    Math.max(1, Math.round(((staffBehavior || 3) + (staffService || 3)) / 2))
  );

  if (!name) throw new Error('Name is required.');
  if (!/^[6-9]\d{9}$/.test(mobile)) throw new Error('Enter a valid 10-digit mobile number.');
  if (!storeLocation) throw new Error('Store location is required.');
  if (!staffBehavior) throw new Error('Staff behavior rating is required.');
  if (!staffService) throw new Error('Staff service rating is required.');
  if (!storeSatisfaction) throw new Error('Store satisfaction rating is required.');

  return {
    ...(providedRecordId ? { record_id: providedRecordId } : {}),
    Timestamp: timestamp,
    Name: name,
    'Mobile Number': mobile,
    'Store Location': storeLocation,
    'Staff Behavior': staffBehavior,
    'Staff Service': staffService,
    'Satisfaction Level': storeSatisfaction,
    'Price Challenge': toYesNo(data['Price Challenge'] ?? data.priceChallengeOk, true),
    'Bill Received': toYesNo(data['Bill Received'] ?? data.billReceived, true),
    'Your Complaint': cleanText(data['Your Complaint'] ?? data.complaint) || null,
    'Your Feedback': cleanText(data['Your Feedback'] ?? data.feedback) || null,
    'Improvement Feedback': cleanText(data['Improvement Feedback'] ?? data.suggestions) || null,
    'Product Unavailable': cleanText(data['Product Unavailable'] ?? data.productUnavailable) || null,
    'Receipt Compliance': cleanText(data['Receipt Compliance'] ?? data.noPurchaseWithoutBill) || null,
    'Type of Complaint': resolveFeedbackType(data, status),
    Status: status,
    'Assigned To': cleanText(data['Assigned To'] ?? data.assignedTo) || null,
    Mode: cleanText(data.Mode ?? data.mode) || null,
    Remarks: cleanText(data.Remarks ?? data.remarks) || null,
    'Updated By': cleanText(data['Updated By'] ?? data.updatedBy) || null,
  };
}

function buildFeedbackUpdatePayload(data: FeedbackUpdateInput) {
  const status = data.Status ?? data.status;
  const payload: Record<string, unknown> = {};

  if (data.Name !== undefined) payload.Name = cleanText(data.Name);
  if (data['Mobile Number'] !== undefined) payload['Mobile Number'] = cleanText(data['Mobile Number']);
  if (data['Store Location'] !== undefined) payload['Store Location'] = cleanText(data['Store Location']);
  if (status !== undefined) payload.Status = cleanText(status);
  if (data['Assigned To'] !== undefined || data.assignedTo !== undefined) {
    payload['Assigned To'] = cleanText(data['Assigned To'] ?? data.assignedTo);
  }
  if (data.Mode !== undefined || data.mode !== undefined) {
    payload.Mode = cleanText(data.Mode ?? data.mode);
  }
  if (data.Remarks !== undefined || data.remarks !== undefined) {
    payload.Remarks = cleanText(data.Remarks ?? data.remarks);
  }
  if (data['Updated By'] !== undefined || data.updatedBy !== undefined) {
    payload['Updated By'] = cleanText(data['Updated By'] ?? data.updatedBy);
  }
  if (
    data['Type Complaint'] !== undefined ||
    data['Type of Complaint'] !== undefined ||
    data.type !== undefined
  ) {
    payload['Type of Complaint'] = cleanText(data['Type Complaint'] ?? data['Type of Complaint'] ?? data.type);
  }

  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

async function updateByColumn(column: 'record_id' | 'id', value: string, payload: Record<string, unknown>) {
  if (column === 'id' && !isUuid(value)) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from(FEEDBACK_TABLE)
    .update(payload)
    .eq(column, value)
    .select('*')
    .limit(1);

  return { data: data || [], error };
}

export async function saveFeedback(data: FeedbackSaveInput) {
  const payload = buildFeedbackPayload(data);

  const { data: result, error } = await supabase
    .from(FEEDBACK_TABLE)
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(getErrorMessage(error, 'Insert failed'));
  }

  return result;
}

export async function updateFeedback(recordId: string, updateData: FeedbackUpdateInput) {
  const safeRecordId = cleanText(recordId);
  if (!safeRecordId) throw new Error('Missing feedback record id.');

  const payload = buildFeedbackUpdatePayload(updateData);
  if (Object.keys(payload).length === 0) throw new Error('No update payload provided.');

  const attempts: Array<'id' | 'record_id'> = ['id', 'record_id'];
  let lastError: unknown = null;

  for (const column of attempts) {
    const { data, error } = await updateByColumn(column, safeRecordId, payload);
    if (error) {
      lastError = error;
      continue;
    }

    if (data.length > 0) {
      return data[0];
    }
  }

  throw new Error(getErrorMessage(lastError, `Update failed. Feedback record not found for id '${safeRecordId}'`));
}
