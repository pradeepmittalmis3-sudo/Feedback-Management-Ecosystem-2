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
  const headers = ensureHeaders(sheet, ['id', 'name', 'email', 'department', 'status', 'role', 'active', 'permissions', 'updated_at', 'created_at']);

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
  merged.updated_at = now;

  const updatedRow = headers.map((h) => (merged[h] !== undefined ? merged[h] : ''));
  sheet.getRange(targetRowNumber, 1, 1, headers.length).setValues([updatedRow]);

  return { mode: 'updated', id: merged.id || id };
}

function updateFeedbackStatus(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, FEEDBACK_SHEET);
  let values = sheet.getDataRange().getValues();

  if (!values || values.length === 0) {
    throw new Error('Feedback sheet is empty.');
  }

  let headers = values[0].map((h) => String(h || '').trim());
  const status = String(payload.status || '').trim();
  if (!status) throw new Error("Missing 'status' for UPDATE_STATUS.");

  const recordId = String(payload.id || '').trim();
  if (!recordId) throw new Error("Missing 'id' for UPDATE_STATUS.");

  let idCol = findHeaderIndex(headers, ['_id', 'id', 'external_id']);
  if (idCol === -1) {
    sheet.getRange(1, headers.length + 1).setValue('_id');
    headers.push('_id');
    idCol = headers.length - 1;
  }

  let statusCol = findHeaderIndex(headers, ['Status', 'status']);
  if (statusCol === -1) {
    sheet.getRange(1, headers.length + 1).setValue('Status');
    headers.push('Status');
    statusCol = headers.length - 1;
  }

  let notesCol = findHeaderIndex(headers, ['Admin Notes', 'admin_notes']);
  if (notesCol === -1) {
    sheet.getRange(1, headers.length + 1).setValue('Admin Notes');
    headers.push('Admin Notes');
    notesCol = headers.length - 1;
  }

  values = sheet.getDataRange().getValues();
  headers = values[0].map((h) => String(h || '').trim());

  const candidateIdCols = [
    findHeaderIndex(headers, ['_id']),
    findHeaderIndex(headers, ['id']),
    findHeaderIndex(headers, ['external_id']),
  ].filter((idx) => idx !== -1);

  let targetRow = -1;
  for (let i = 1; i < values.length; i++) {
    for (let j = 0; j < candidateIdCols.length; j++) {
      const rowId = String(values[i][candidateIdCols[j]] || '').trim();
      if (rowId === recordId) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow !== -1) break;
  }

  if (targetRow === -1) {
    throw new Error("Feedback record not found for id '" + recordId + "'");
  }

  const resolvedStatusCol = findHeaderIndex(headers, ['Status', 'status']);
  const resolvedNotesCol = findHeaderIndex(headers, ['Admin Notes', 'admin_notes']);

  sheet.getRange(targetRow, resolvedStatusCol + 1).setValue(status);
  if (payload.adminNotes !== undefined) {
    sheet.getRange(targetRow, resolvedNotesCol + 1).setValue(String(payload.adminNotes || ''));
  }

  return { updated: true, id: recordId };
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
      ensureHeaders(userSheet, ['id', 'name', 'email', 'department', 'status', 'role', 'active', 'permissions', 'updated_at', 'created_at']);
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

    if (action === 'UPDATE_STATUS') {
      const result = updateFeedbackStatus(payload);
      return jsonResponse({ success: true, message: 'Feedback status updated', updated: result.updated, id: result.id });
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
    const rowData = e.values;
    if (!rowData) return;

    const payload = {
      timestamp: rowData[0] ? new Date(rowData[0]).toISOString() : new Date().toISOString(),
      name: rowData[1],
      mobile_number: rowData[2],
      store_location: rowData[3],
      staff_behaviour: parseInt(rowData[4], 10) || 0,
      staff_service: parseInt(rowData[5], 10) || 0,
      staff_satisfied: rowData[6],
      price_challenge: rowData[7],
      bill_received: rowData[8],
      your_feedback: rowData[9],
      your_suggestions: rowData[10],
      product_unavailable: rowData[11],
      no_purchase_without_bill: rowData[12],
      your_complaint: rowData[13],
      type: rowData[14] || '',
      user_name: rowData[15] || '',
      external_id: rowData[16] || '',
      status: rowData[17] || 'Feedback',
      admin_notes: rowData[18] || '',
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

    const response = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/feedbacks', options);
    const json = JSON.parse(response.getContentText());

    // Write Supabase UUID back to sheet _id column so UPDATE_STATUS can locate row
    if (json && json[0] && json[0].id && e.range) {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName(FEEDBACK_SHEET);
      const headers = ensureHeaders(sheet, ['_id']);
      const idColIndex = findHeaderIndex(headers, ['_id', 'id']);
      if (idColIndex !== -1) {
        sheet.getRange(e.range.getRow(), idColIndex + 1).setValue(json[0].id);
      }
    }

    Logger.log('Supabase Sync Success: ' + response.getContentText());
  } catch (error) {
    Logger.log('Supabase Sync Failed: ' + error.message);
  }
}
