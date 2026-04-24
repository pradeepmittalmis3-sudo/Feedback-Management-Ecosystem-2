const SPREADSHEET_ID = '1YlAVAjRxiIH8Ly7laUawgLh7bnpKnLCN8ixP5_VTNVA';
const FEEDBACK_SHEET = 'Sheet1';
const USER_SHEET = 'User Master';

// Supabase Configuration for Lightning Sync
const SUPABASE_URL = 'https://oujvzujravxmzhqfqmah.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nEg8nPVzNRtynmd4fewr0g_AMzSmHJl';

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function isSheetTrulyEmpty(sheet) {
  return sheet.getLastRow() === 0 || sheet.getLastColumn() === 0;
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function getRowsAsObjects(sheet) {
  if (isSheetTrulyEmpty(sheet)) return [];
  const values = sheet.getDataRange().getValues();
  if (!values || values.length === 0) return [];
  const headers = values[0].map((h) => String(h || '').trim());
  const rows = values.slice(1);
  return rows.map((row) => {
    const obj = {};
    headers.forEach((header, idx) => {
      if (header) obj[header] = row[idx];
    });
    return obj;
  });
}

function ensureHeaders(sheet, requiredHeaders) {
  if (isSheetTrulyEmpty(sheet)) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders.slice();
  }

  const values = sheet.getDataRange().getValues();
  let headers = values.length > 0 ? values[0].map((h) => String(h || '').trim()) : [];

  const hasRealHeader = headers.some((h) => h !== '');
  if (!hasRealHeader) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders.slice();
  }

  let nextCol = Math.max(headers.length, 1) + 1;
  requiredHeaders.forEach((header) => {
    if (headers.indexOf(header) === -1) {
      sheet.getRange(1, nextCol).setValue(header);
      headers.push(header);
      nextCol += 1;
    }
  });

  return headers;
}

function findHeaderIndex(headers, names) {
  for (let i = 0; i < names.length; i++) {
    const idx = headers.indexOf(names[i]);
    if (idx !== -1) return idx;
  }
  return -1;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function upsertUser(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, USER_SHEET);
  const headers = ensureHeaders(sheet, ['id', 'name', 'email', 'department', 'status', 'role', 'active', 'permissions', 'store_access', 'allowed_stores', 'updated_at', 'created_at']);

  const id = String(payload.id || '').trim();
  const email = normalizeEmail(payload.email);
  if (!id && !email) {
    throw new Error("Missing 'id' or 'email' for user upsert.");
  }

  const allValues = sheet.getDataRange().getValues();
  const rows = allValues.slice(1);
  const idCol = findHeaderIndex(headers, ['id', 'Id', 'ID']);
  const emailCol = findHeaderIndex(headers, ['email', 'Email', 'Email ID', 'email_id']);

  let targetRowNumber = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowId = String(rows[i][idCol] || '').trim();
    const rowEmail = normalizeEmail(rows[i][emailCol]);
    if ((id && rowId === id) || (email && rowEmail === email)) {
      targetRowNumber = i + 2; // +2 because headers are in row 1
      break;
    }
  }

  const now = new Date().toISOString();
  const userData = {
    id: id || Utilities.getUuid(),
    name: String(payload.name || payload.full_name || '').trim(),
    email: email,
    department: String(payload.department || 'Staff').trim(),
    status: String(payload.status || 'Pending').trim(),
    role: String(payload.role || '').trim(),
    active: payload.active === true || String(payload.active || '').toUpperCase() === 'TRUE',
    permissions: typeof payload.permissions === 'object' ? JSON.stringify(payload.permissions) : String(payload.permissions || ''),
    store_access: String(payload.store_access || payload.storeAccess || payload['Store Access'] || '').trim(),
    allowed_stores: String(payload.allowed_stores || payload.allowedStores || payload['Allowed Stores'] || '').trim(),
    updated_at: now,
    created_at: now,
  };

  if (targetRowNumber === -1) {
    const newRow = headers.map((h) => (userData[h] !== undefined ? userData[h] : ''));
    sheet.appendRow(newRow);
    return { mode: 'created', id: userData.id };
  }

  const currentValues = sheet.getRange(targetRowNumber, 1, 1, headers.length).getValues()[0];
  const merged = {};
  headers.forEach((h, idx) => {
    merged[h] = currentValues[idx];
  });

  if (id) merged.id = userData.id;
  if (userData.name) merged.name = userData.name;
  if (email) merged.email = email;
  if (userData.department) merged.department = userData.department;
  if (payload.status !== undefined) merged.status = userData.status;
  if (payload.role !== undefined) merged.role = userData.role;
  if (payload.active !== undefined) merged.active = userData.active;
  if (payload.permissions !== undefined) merged.permissions = userData.permissions;
  if (payload.store_access !== undefined || payload.storeAccess !== undefined || payload['Store Access'] !== undefined) {
    merged.store_access = userData.store_access;
  }
  if (payload.allowed_stores !== undefined || payload.allowedStores !== undefined || payload['Allowed Stores'] !== undefined) {
    merged.allowed_stores = userData.allowed_stores;
  }
  merged.updated_at = now;

  const updatedRow = headers.map((h) => (merged[h] !== undefined ? merged[h] : ''));
  sheet.getRange(targetRowNumber, 1, 1, headers.length).setValues([updatedRow]);

  return { mode: 'updated', id: merged.id || id };
}

function safeJsonParse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch (error) {
    return null;
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeText(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function toIsoTimestamp(value, fallbackIso) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }

  const raw = normalizeText(value);
  if (!raw) return fallbackIso || new Date().toISOString();

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return fallbackIso || new Date().toISOString();
}

function parseRatingValue(value, fallback) {
  if (typeof value === 'number' && isFinite(value)) {
    const rounded = Math.round(value);
    if (rounded < 1) return 1;
    if (rounded > 5) return 5;
    return rounded;
  }

  const raw = normalizeText(value);
  if (!raw) return fallback;
  const direct = Number(raw);
  if (!isNaN(direct)) {
    const roundedDirect = Math.round(direct);
    if (roundedDirect < 1) return 1;
    if (roundedDirect > 5) return 5;
    return roundedDirect;
  }

  const digits = raw.match(/\d+/);
  if (!digits) return fallback;
  const parsed = Number(digits[0]);
  if (parsed < 1) return 1;
  if (parsed > 5) return 5;
  return parsed;
}

function parseBooleanValue(value, fallback) {
  if (typeof value === 'boolean') return value;
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return fallback;
  if (['true', 't', 'yes', 'y', '1'].indexOf(raw) !== -1) return true;
  if (['false', 'f', 'no', 'n', '0'].indexOf(raw) !== -1) return false;
  return fallback;
}

function buildLegacyCompositeId(row) {
  const timestampRaw = row.Timestamp || row.timestamp || row.created_at;
  const mobileRaw = row['Mobile Number'] || row.mobile_number || row.mobile;
  const timestamp = toIsoTimestamp(timestampRaw, '');
  const mobile = normalizeText(mobileRaw);
  if (!timestamp && !mobile) return '';
  return timestamp + '-' + mobile;
}

function resolveLegacyRowId(row) {
  const candidates = [
    normalizeText(row.record_id || row['record_id']),
    normalizeText(row._id),
    normalizeText(row.id),
    normalizeText(row.external_id || row['external_id']),
  ];
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i]) return candidates[i];
  }
  return buildLegacyCompositeId(row);
}

function resolveSheetRecordId(row) {
  const explicitCandidates = [
    normalizeText(row.record_id || row['record_id']),
    normalizeText(row.id),
    normalizeText(row._id),
    normalizeText(row.external_id || row['external_id']),
  ];

  for (var i = 0; i < explicitCandidates.length; i++) {
    if (isUuid(explicitCandidates[i])) return explicitCandidates[i];
  }

  return '';
}

function resolveCanonicalUuid(row, requestedId) {
  const rowUuid = resolveSheetRecordId(row);
  if (rowUuid) return rowUuid;

  const requested = normalizeText(requestedId);
  if (isUuid(requested)) return requested;

  return Utilities.getUuid();
}

function getFeedbackRowsWithMeta() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, FEEDBACK_SHEET);
  if (isSheetTrulyEmpty(sheet)) {
    return { sheet: sheet, headers: [], rows: [] };
  }

  const values = sheet.getDataRange().getValues();
  if (!values || values.length === 0) {
    return { sheet: sheet, headers: [], rows: [] };
  }

  const headers = values[0].map((h) => String(h || '').trim());
  const rows = values.slice(1).map((rowValues, idx) => {
    const obj = {};
    headers.forEach((header, colIdx) => {
      if (header) obj[header] = rowValues[colIdx];
    });
    obj.__rowNumber = idx + 2;
    return obj;
  });

  return { sheet: sheet, headers: headers, rows: rows };
}

function writeSheetRecordId(sheet, rowNumber, recordId) {
  if (!sheet || !rowNumber || rowNumber < 2 || !recordId) return;
  const headers = ensureHeaders(sheet, ['record_id']);
  const idx = findHeaderIndex(headers, ['record_id']);
  if (idx === -1) return;
  sheet.getRange(rowNumber, idx + 1).setValue(recordId);
}

function buildWorkingDataPayloadFromSheetRow(row, opts) {
  const now = (opts && opts.updatedAt) || new Date().toISOString();
  const createdAt = toIsoTimestamp(row.Timestamp || row.timestamp || row.created_at, now);
  const mobile = normalizeText(row['Mobile Number'] || row.mobile_number || row.mobile);
  const requestedId = normalizeText(opts && opts.recordId);
  const recordId = resolveCanonicalUuid(row, requestedId);
  const legacyRowId = resolveLegacyRowId(row);
  const requestedLegacyId = requestedId && requestedId !== recordId ? requestedId : '';
  const legacyReference = requestedLegacyId || (legacyRowId && legacyRowId !== recordId ? legacyRowId : '');
  let externalId = normalizeText(row.external_id || row['external_id']);
  if (!externalId || externalId === recordId) {
    externalId = legacyReference || recordId;
  }
  const complaint = normalizeText(row['Your Complaint'] || row.complaint || row.your_complaint);
  const remarks = normalizeText(row['Remarks'] || row.remarks || row['Admin Notes'] || row.admin_notes);
  const staffBehavior = parseRatingValue(
    row['Staff Behaviour'] || row['Staff Behavior'] || row.staff_behaviour || row.staff_behavior,
    3
  );
  const staffService = parseRatingValue(
    row['Staff Service'] || row.staff_service,
    3
  );
  const storeSatisfaction = parseRatingValue(
    row['Satisfaction Level'] || row['Staff Satisfied'] || row.staff_satisfied || row.store_satisfaction,
    Math.max(1, Math.round((staffBehavior + staffService) / 2))
  );
  const status = normalizeText(row['Status'] || row.status) || 'Pending';

  return {
    record_id: recordId || null,
    external_id: externalId || null,
    source: normalizeText(row.source) || 'sheet',
    name: normalizeText(row['Name'] || row.name) || 'Unknown',
    mobile: mobile || '',
    store_location: normalizeText(row['Store Location'] || row.store_location || row.storeLocation) || 'Unknown',
    staff_behavior: staffBehavior,
    staff_service: staffService,
    store_satisfaction: storeSatisfaction,
    price_challenge_ok: parseBooleanValue(
      row['Price Challenge'] || row['Price challenge'] || row.price_challenge || row.price_challenge_ok,
      true
    ),
    bill_received: parseBooleanValue(row['Bill Received'] || row.bill_received, true),
    complaint: complaint || null,
    feedback: normalizeText(row['Your Feedback'] || row.feedback || row.your_feedback) || null,
    suggestions: normalizeText(row['Improvement Feedback'] || row['Your Suggestions'] || row.suggestions || row.your_suggestions) || null,
    product_unavailable: normalizeText(row['Product Unavailable'] || row.product_unavailable) || null,
    no_purchase_without_bill: normalizeText(row['Receipt Compliance'] || row['No purchase without bill'] || row.no_purchase_without_bill) || null,
    status: status,
    status_notes: remarks || null,
    user_name: normalizeText(row['Assigned To'] || row.user_name || row.User) || null,
    mode: normalizeText(row['Mode'] || row.mode) || null,
    remarks: remarks || null,
    updated_by: normalizeText(row['Updated By'] || row.updated_by) || null,
    type: normalizeText(row['Type Complaint'] || row['Type of Complaint'] || row.type || row.Type || (complaint ? 'Complaint' : 'Feedback')) || null,
    created_at: createdAt,
    updated_at: now,
  };
}

function patchWorkingDataByColumn(column, recordId, updatePayload) {
  if (column === 'id' && !isUuid(recordId)) {
    return { updated: false, data: [], error: null };
  }

  const filter = column + '=eq.' + encodeURIComponent(recordId);
  const url = SUPABASE_URL + '/rest/v1/working_data?' + filter;
  const response = UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      Prefer: 'return=representation',
    },
    payload: JSON.stringify(updatePayload),
  });

  const statusCode = response.getResponseCode();
  const rawBody = response.getContentText() || '';
  const parsedBody = safeJsonParse(rawBody);

  if (statusCode >= 200 && statusCode < 300) {
    const rows = Array.isArray(parsedBody) ? parsedBody : [];
    return { updated: rows.length > 0, data: rows, error: null };
  }

  const errorText = (parsedBody && (parsedBody.message || parsedBody.error_description || parsedBody.hint))
    || rawBody
    || ('Supabase update failed with status ' + statusCode);
  return { updated: false, data: [], error: new Error(errorText) };
}

function insertWorkingDataRow(payload) {
  const url = SUPABASE_URL + '/rest/v1/working_data';
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      Prefer: 'return=representation',
    },
    payload: JSON.stringify(payload),
  });

  const statusCode = response.getResponseCode();
  const rawBody = response.getContentText() || '';
  const parsedBody = safeJsonParse(rawBody);
  if (statusCode >= 200 && statusCode < 300) {
    const rows = Array.isArray(parsedBody) ? parsedBody : [];
    return { inserted: true, data: rows, error: null };
  }

  const errorText = (parsedBody && (parsedBody.message || parsedBody.error_description || parsedBody.hint))
    || rawBody
    || ('Supabase insert failed with status ' + statusCode);
  return { inserted: false, data: [], error: new Error(errorText) };
}

function findSheetRowByRecordId(recordId) {
  const target = normalizeText(recordId);
  if (!target) return null;

  const context = getFeedbackRowsWithMeta();
  const rows = context.rows;

  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const explicitIdCandidates = [
      normalizeText(row.record_id || row['record_id']),
      normalizeText(row._id),
      normalizeText(row.id),
      normalizeText(row.external_id || row['external_id']),
    ];

    for (var j = 0; j < explicitIdCandidates.length; j++) {
      if (explicitIdCandidates[j] && explicitIdCandidates[j] === target) {
        return { row: row, rowNumber: row.__rowNumber, sheet: context.sheet };
      }
    }

    const legacyCompositeId = buildLegacyCompositeId(row);
    if (legacyCompositeId && legacyCompositeId === target) {
      return { row: row, rowNumber: row.__rowNumber, sheet: context.sheet };
    }
  }

  return null;
}

function hydrateWorkingDataRecordFromSheet(recordId) {
  const match = findSheetRowByRecordId(recordId);
  if (!match) {
    return { inserted: false, mode: 'not_found_in_sheet', error: null };
  }

  const payload = buildWorkingDataPayloadFromSheetRow(match.row, { recordId: normalizeText(recordId) });
  writeSheetRecordId(match.sheet, match.rowNumber, payload.record_id);

  const patchAttempts = [
    { column: 'record_id', value: normalizeText(payload.record_id) },
    { column: 'external_id', value: normalizeText(recordId) },
    { column: 'external_id', value: normalizeText(payload.external_id) },
  ];

  for (var i = 0; i < patchAttempts.length; i++) {
    const attempt = patchAttempts[i];
    if (!attempt.value) continue;

    const patchResult = patchWorkingDataByColumn(attempt.column, attempt.value, payload);
    if (patchResult.error) {
      return { inserted: false, mode: 'patch_error', error: patchResult.error };
    }
    if (patchResult.updated) {
      return { inserted: true, mode: 'updated_existing', data: patchResult.data, error: null };
    }
  }

  const insertResult = insertWorkingDataRow(payload);
  if (insertResult.error) {
    return { inserted: false, mode: 'insert_error', error: insertResult.error };
  }
  return { inserted: true, mode: 'inserted_new', data: insertResult.data, error: null };
}

function syncWorkingDataFromSheet() {
  const context = getFeedbackRowsWithMeta();
  const sheet = context.sheet;
  const rows = context.rows;

  const summary = {
    total: rows.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const payload = buildWorkingDataPayloadFromSheetRow(row, {});
    const recordId = normalizeText(payload.record_id);
    if (!recordId) {
      summary.skipped += 1;
      continue;
    }

    writeSheetRecordId(sheet, row.__rowNumber, recordId);

    const patchResult = patchWorkingDataByColumn('record_id', recordId, payload);
    if (patchResult.error) {
      summary.failed += 1;
      if (summary.errors.length < 5) summary.errors.push('record_id=' + recordId + ' patch: ' + patchResult.error.message);
      continue;
    }
    if (patchResult.updated) {
      summary.updated += 1;
      continue;
    }

    const insertResult = insertWorkingDataRow(payload);
    if (insertResult.error) {
      summary.failed += 1;
      if (summary.errors.length < 5) summary.errors.push('record_id=' + recordId + ' insert: ' + insertResult.error.message);
      continue;
    }

    summary.inserted += 1;
  }

  return summary;
}

function updateFeedbackStatus(payload) {
  const recordId = String(payload.record_id || payload.id || '').trim();
  if (!recordId) throw new Error("Missing 'record_id' for UPDATE_STATUS.");

  const status = payload.status !== undefined ? String(payload.status || '').trim() : undefined;
  const assignedTo = payload.assignedTo !== undefined ? String(payload.assignedTo || '').trim() : undefined;
  const mode = payload.mode !== undefined ? String(payload.mode || '').trim() : undefined;
  const remarks = payload.remarks !== undefined ? String(payload.remarks || '') : undefined;
  const updatedBy = payload.updatedBy !== undefined ? String(payload.updatedBy || '').trim() : undefined;
  const typeComplaint =
    payload.typeComplaint !== undefined
      ? String(payload.typeComplaint || '').trim()
      : payload.type !== undefined
      ? String(payload.type || '').trim()
      : payload['Type of Complaint'] !== undefined
      ? String(payload['Type of Complaint'] || '').trim()
      : payload['Type Complaint'] !== undefined
      ? String(payload['Type Complaint'] || '').trim()
      : undefined;

  if (status === undefined && assignedTo === undefined && mode === undefined && remarks === undefined && updatedBy === undefined && typeComplaint === undefined) {
    throw new Error("Missing update values for UPDATE_STATUS. Send at least one of: status, assignedTo, mode, remarks, updatedBy, typeComplaint.");
  }

  const updatePayload = {};

  if (status !== undefined) updatePayload.status = status;
  if (typeComplaint !== undefined) {
    updatePayload.type = typeComplaint;
  }
  if (assignedTo !== undefined) updatePayload.user_name = assignedTo;
  if (mode !== undefined) updatePayload.mode = mode;
  if (remarks !== undefined) updatePayload.remarks = remarks;
  if (updatedBy !== undefined) updatePayload.updated_by = updatedBy;

  const result = patchWorkingDataByColumn('record_id', recordId, updatePayload);
  if (result.error) {
    throw result.error;
  }

  if (!result.updated) {
    throw new Error("Feedback record not found for record_id '" + recordId + "'");
  }

  return { updated: true, id: recordId, data: result.data };
}

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'GET_ALL').toUpperCase();
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (action === 'PING') {
      return jsonResponse({ success: true, message: 'API Active' });
    }

    if (action === 'GET_USERS') {
      const userSheet = getOrCreateSheet(ss, USER_SHEET);
      ensureHeaders(userSheet, ['id', 'name', 'email', 'department', 'status', 'role', 'active', 'permissions', 'store_access', 'allowed_stores', 'updated_at', 'created_at']);
      const users = getRowsAsObjects(userSheet);
      return jsonResponse({ success: true, data: users });
    }

    // GET_ALL / default: feedback payload for dashboard
    const feedbackSheet = getOrCreateSheet(ss, FEEDBACK_SHEET);
    const feedbacks = getRowsAsObjects(feedbackSheet);
    return jsonResponse({ success: true, data: feedbacks });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(payload.action || '').toUpperCase();

    if (action === 'ADD_USER') {
      const result = upsertUser(payload);
      return jsonResponse({ success: true, message: 'User created/updated', mode: result.mode, id: result.id });
    }

    if (action === 'UPDATE_USER') {
      const result = upsertUser(payload);
      return jsonResponse({ success: true, message: 'User updated', mode: result.mode, id: result.id });
    }

    if (action === 'UPDATE_STATUS' || action === 'UPDATE_WORKING_DATA') {
      const result = updateFeedbackStatus(payload);
      return jsonResponse({ success: true, message: 'Working Data updated in Supabase', updated: result.updated, id: result.id });
    }

    throw new Error('Invalid action: ' + action);
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

/**
 * TRIGGER THIS FUNCTION ON FORM SUBMIT
 * Push feedback row to Supabase for real-time dashboard updates.
 */
function syncToSupabase(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const lastColumn = sheet.getLastColumn();
    if (!lastColumn) return;
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((h) => String(h || '').trim());
    const rowData = sheet.getRange(e.range.getRow(), 1, 1, lastColumn).getValues()[0];

    const getValue = (names) => {
      const idx = findHeaderIndex(headers, names);
      return idx === -1 ? '' : rowData[idx];
    };

    const parseRating = (value) => {
      const raw = String(value || '').trim();
      const matched = raw.match(/\d+/);
      return matched ? parseInt(matched[0], 10) : 0;
    };

    const parseBoolean = (value, fallback) => {
      const raw = String(value || '').trim().toLowerCase();
      if (!raw) return fallback;
      if (['true', 't', 'yes', 'y', '1'].indexOf(raw) !== -1) return true;
      if (['false', 'f', 'no', 'n', '0'].indexOf(raw) !== -1) return false;
      return fallback;
    };

    const timestamp = getValue(['Timestamp', 'timestamp'])
      ? new Date(getValue(['Timestamp', 'timestamp'])).toISOString()
      : new Date().toISOString();
    const mobileNumber = String(getValue(['Mobile Number', 'mobile_number', 'mobile']) || '').trim();
    const existingRecordId = normalizeText(getValue(['record_id', '_id', 'id']));
    const existingExternalId = normalizeText(getValue(['external_id']));
    const recordId = isUuid(existingRecordId)
      ? existingRecordId
      : (isUuid(existingExternalId) ? existingExternalId : Utilities.getUuid());
    const legacyReferenceId = normalizeText(existingRecordId || existingExternalId);
    const externalId = (legacyReferenceId && legacyReferenceId !== recordId) ? legacyReferenceId : recordId;
    const complaintText = String(getValue(['Your Complaint', 'complaint', 'your_complaint']) || '').trim();
    const statusValue = String(getValue(['Status', 'status']) || 'Pending').trim();

    const payload = {
      record_id: recordId,
      external_id: externalId,
      source: 'google_form',
      created_at: timestamp,
      updated_at: new Date().toISOString(),
      name: String(getValue(['Name', 'name']) || '').trim(),
      mobile: mobileNumber,
      store_location: String(getValue(['Store Location', 'store_location']) || ''),
      staff_behavior: parseRating(getValue(['Staff Behaviour', 'Staff Behavior', 'staff_behaviour', 'staff_behavior'])) || 3,
      staff_service: parseRating(getValue(['Staff Service', 'staff_service'])) || 3,
      store_satisfaction: parseRating(getValue(['Satisfaction Level', 'Staff Satisfied', 'staff_satisfied'])) || 3,
      price_challenge_ok: parseBoolean(getValue(['Price Challenge', 'Price challenge', 'price_challenge']), true),
      bill_received: parseBoolean(getValue(['Bill Received', 'bill_received']), true),
      feedback: String(getValue(['Your Feedback', 'feedback', 'your_feedback']) || ''),
      suggestions: String(getValue(['Improvement Feedback', 'Your Suggestions', 'suggestions', 'your_suggestions']) || ''),
      product_unavailable: String(getValue(['Product Unavailable', 'product_unavailable']) || ''),
      no_purchase_without_bill: String(getValue(['Receipt Compliance', 'No purchase without bill', 'no_purchase_without_bill']) || ''),
      complaint: complaintText,
      type: String(getValue(['Type of Complaint', 'Type Complaint', 'Type', 'type']) || (complaintText ? 'Complaint' : 'Feedback')),
      user_name: String(getValue(['Assigned To', 'User', 'user_name']) || ''),
      status: statusValue,
      mode: String(getValue(['Mode', 'mode']) || ''),
      remarks: String(getValue(['Remarks', 'remarks']) || ''),
      updated_by: String(getValue(['Updated By', 'updated_by']) || ''),
      status_notes: String(getValue(['Remarks', 'Admin Notes', 'admin_notes']) || ''),
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        Prefer: 'return=representation',
      },
      payload: JSON.stringify(payload),
    };

    const response = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/working_data', options);

    // Write stable record_id back to the sheet so UPDATE_STATUS can locate the row.
    if (recordId && e.range) {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName(FEEDBACK_SHEET);
      const headers = ensureHeaders(sheet, ['record_id']);
      const idColIndex = findHeaderIndex(headers, ['record_id', '_id', 'id']);
      if (idColIndex !== -1) {
        sheet.getRange(e.range.getRow(), idColIndex + 1).setValue(recordId);
      }
    }

    Logger.log('Supabase Sync Success: ' + response.getContentText());
  } catch (error) {
    Logger.log('Supabase Sync Failed: ' + error.message);
  }
}
