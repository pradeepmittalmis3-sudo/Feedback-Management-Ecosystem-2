import { Router } from "express";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TABLE_NAME = "working_data";
const HISTORY_SEPARATOR = "\n\n-----\n\n";
const DEFAULT_PAGE_SIZE = parsePositiveInteger(
  process.env.WORKING_DATA_DEFAULT_PAGE_SIZE,
  100
);
const MAX_PAGE_SIZE = parsePositiveInteger(
  process.env.WORKING_DATA_MAX_PAGE_SIZE,
  500
);
const SHEET_SYNC_INTERVAL_MS = parsePositiveInteger(
  process.env.WORKING_DATA_SHEET_SYNC_INTERVAL_MS,
  300000
);
const ENABLE_BACKGROUND_SHEET_SYNC = String(
  process.env.WORKING_DATA_BACKGROUND_SHEET_SYNC || "true"
).toLowerCase() !== "false";
const SHEET_SYNC_COOLDOWN_MS = parsePositiveInteger(
  process.env.WORKING_DATA_SHEET_SYNC_COOLDOWN_MS,
  120000
);

let lastSheetSyncAt = 0;
let lastSheetSyncSummary = null;
let sheetSyncInFlight = null;
let backgroundSyncTimer = null;

function cleanText(value) {
  return String(value || "").trim();
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isUuid(value) {
  return UUID_REGEX.test(cleanText(value));
}

function isUuidCastError(message) {
  return String(message || "")
    .toLowerCase()
    .includes("invalid input syntax for type uuid");
}

function mergeRemarks(existingRemarks, incomingRemarks) {
  const existing = String(existingRemarks || "").trim();
  const incoming = String(incomingRemarks || "").trim();

  if (!existing && !incoming) return "";
  if (!incoming) return existing;
  if (!existing) return incoming;
  if (incoming === existing) return existing;

  // If frontend already sent full history chain, trust it.
  if (incoming.includes(HISTORY_SEPARATOR)) return incoming;

  // Avoid duplicate append if exact note already present.
  if (existing.split(HISTORY_SEPARATOR).some((entry) => entry.trim() === incoming)) {
    return existing;
  }

  return `${existing}${HISTORY_SEPARATOR}${incoming}`;
}

function toIsoTimestamp(value, fallbackIso = new Date().toISOString()) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  const raw = cleanText(value);
  if (!raw) return fallbackIso;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return fallbackIso;
}

function parseRating(value, fallback = 3) {
  if (typeof value === "number" && Number.isFinite(value)) {
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

function toYesNo(value, fallback = true) {
  if (typeof value === "boolean") return value ? "Yes" : "No";

  const raw = cleanText(value).toLowerCase();
  if (!raw) return fallback ? "Yes" : "No";
  if (["true", "t", "yes", "y", "1"].includes(raw)) return "Yes";
  if (["false", "f", "no", "n", "0"].includes(raw)) return "No";

  return fallback ? "Yes" : "No";
}

function buildLegacyCompositeId(timestamp, mobile) {
  if (!timestamp && !mobile) return "";
  return `${timestamp}-${mobile}`;
}

function resolveSheetRecordId(row, fallbackTimestamp, fallbackMobile) {
  const explicitCandidates = [
    cleanText(row.record_id),
    cleanText(row.id),
    cleanText(row._id),
    cleanText(row.external_id),
  ];

  for (const candidate of explicitCandidates) {
    if (candidate) return candidate;
  }

  return buildLegacyCompositeId(fallbackTimestamp, fallbackMobile);
}

function buildWorkingDataPayloadFromSheetRow(row) {
  const nowIso = new Date().toISOString();
  const timestamp = toIsoTimestamp(
    row.Timestamp || row.timestamp || row.created_at,
    nowIso
  );
  const mobile = cleanText(
    row["Mobile Number"] || row.mobile_number || row.mobile
  );
  const name = cleanText(row.Name || row.name) || "Unknown";
  const storeLocation =
    cleanText(row["Store Location"] || row.store_location || row.storeLocation) ||
    "Unknown";

  const staffBehavior = parseRating(
    row["Staff Behaviour"] ||
      row["Staff Behavior"] ||
      row.staff_behaviour ||
      row.staff_behavior,
    3
  );
  const staffService = parseRating(
    row["Staff Service"] || row.staff_service || row.staffService,
    3
  );

  const satisfactionRaw = cleanText(
    row["Satisfaction Level"] ||
      row["Staff Satisfied"] ||
      row.staff_satisfied ||
      row.store_satisfaction
  );
  const satisfactionValue =
    satisfactionRaw ||
    String(Math.max(1, Math.round((staffBehavior + staffService) / 2)));

  const complaint = cleanText(
    row["Your Complaint"] || row.complaint || row.your_complaint
  );
  const feedback = cleanText(
    row["Your Feedback"] || row.feedback || row.your_feedback
  );
  const suggestions = cleanText(
    row["Improvement Feedback"] ||
      row["Your Suggestions"] ||
      row.suggestions ||
      row.your_suggestions
  );
  const productUnavailable = cleanText(
    row["Product Unavailable"] || row.product_unavailable
  );
  const receiptCompliance = cleanText(
    row["Receipt Compliance"] ||
      row["No purchase without bill"] ||
      row.no_purchase_without_bill
  );
  const status = cleanText(row.Status || row.status) || "Pending";
  const assignedTo = cleanText(
    row["Assigned To"] || row.user_name || row.User
  );
  const mode = cleanText(row.Mode || row.mode);
  const remarks = cleanText(
    row.Remarks || row.remarks || row["Admin Notes"] || row.admin_notes
  );
  const updatedBy = cleanText(row["Updated By"] || row.updated_by);
  const complaintType =
    cleanText(
      row["Type of Complaint"] || row["Type Complaint"] || row.type || row.Type
    ) || (complaint ? "Complaint" : "Feedback");

  const recordId = resolveSheetRecordId(row, timestamp, mobile);

  return {
    id: isUuid(row.id) ? cleanText(row.id) : undefined,
    Timestamp: timestamp,
    Name: name,
    "Mobile Number": mobile,
    "Store Location": storeLocation,
    "Staff Behavior": String(staffBehavior),
    "Staff Service": String(staffService),
    "Satisfaction Level": satisfactionValue,
    "Price Challenge": toYesNo(
      row["Price Challenge"] || row["Price challenge"] || row.price_challenge,
      true
    ),
    "Bill Received": toYesNo(row["Bill Received"] || row.bill_received, true),
    "Your Feedback": feedback || null,
    "Improvement Feedback": suggestions || null,
    "Product Unavailable": productUnavailable || null,
    "Receipt Compliance": receiptCompliance || null,
    "Your Complaint": complaint || null,
    "Type of Complaint": complaintType,
    Status: status,
    "Assigned To": assignedTo || null,
    Mode: mode || null,
    Remarks: remarks || null,
    "Updated By": updatedBy || null,
    record_id: recordId,
  };
}

function getSheetApiUrl() {
  return cleanText(
    process.env.GOOGLE_SHEET_API_URL || process.env.VITE_GOOGLE_SHEET_API_URL
  );
}

async function fetchSheetRows() {
  const baseUrl = getSheetApiUrl();
  if (!baseUrl) {
    throw new Error("VITE_GOOGLE_SHEET_API_URL is not configured");
  }

  const url = new URL(baseUrl);
  url.searchParams.set("action", "GET_ALL");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Sheet API failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.success || !Array.isArray(payload?.data)) {
    throw new Error(payload?.error || "Invalid sheet API response");
  }

  return payload.data;
}

async function findExistingWorkingRow(supabase, recordId, explicitUuid) {
  const probes = [];

  if (recordId) probes.push({ column: "record_id", value: recordId });
  if (explicitUuid && isUuid(explicitUuid)) {
    probes.unshift({ column: "id", value: explicitUuid });
  }

  let lastError = null;

  for (const probe of probes) {
    const { data, error } = await supabase
      .schema("public")
      .from(TABLE_NAME)
      .select("id,record_id,Remarks")
      .eq(probe.column, probe.value)
      .limit(1);

    if (error) {
      if (isUuidCastError(error.message)) {
        continue;
      }
      lastError = error;
      continue;
    }

    if (data && data.length > 0) {
      return { row: data[0], error: null };
    }
  }

  return { row: null, error: lastError };
}

async function syncWorkingDataFromSheetInternal(supabase) {
  const rows = await fetchSheetRows();
  const summary = {
    sheet_rows: rows.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    synced_at: new Date().toISOString(),
  };

  for (const row of rows) {
    const payload = buildWorkingDataPayloadFromSheetRow(row);
    const recordId = cleanText(payload.record_id);

    if (!recordId) {
      summary.skipped += 1;
      continue;
    }

    if (!cleanText(payload["Mobile Number"])) {
      summary.skipped += 1;
      continue;
    }

    const existing = await findExistingWorkingRow(supabase, recordId, payload.id);
    if (existing.error) {
      summary.failed += 1;
      if (summary.errors.length < 8) {
        summary.errors.push(
          `record_id=${recordId}: ${existing.error.message || "lookup failed"}`
        );
      }
      continue;
    }

    if (existing.row) {
      const mergedPayload = { ...payload };
      mergedPayload.Remarks = mergeRemarks(existing.row.Remarks, payload.Remarks);
      delete mergedPayload.id;

      const { error } = await supabase
        .schema("public")
        .from(TABLE_NAME)
        .update(mergedPayload)
        .eq("id", existing.row.id)
        .limit(1);

      if (error) {
        summary.failed += 1;
        if (summary.errors.length < 8) {
          summary.errors.push(
            `record_id=${recordId}: ${error.message || "update failed"}`
          );
        }
        continue;
      }

      summary.updated += 1;
      continue;
    }

    const insertPayload = { ...payload };
    const { error: insertError } = await supabase
      .schema("public")
      .from(TABLE_NAME)
      .insert(insertPayload)
      .limit(1);

    if (insertError && insertPayload.id) {
      delete insertPayload.id;
      const { error: retryInsertError } = await supabase
        .schema("public")
        .from(TABLE_NAME)
        .insert(insertPayload)
        .limit(1);

      if (retryInsertError) {
        summary.failed += 1;
        if (summary.errors.length < 8) {
          summary.errors.push(
            `record_id=${recordId}: ${retryInsertError.message || "insert failed"}`
          );
        }
        continue;
      }

      summary.inserted += 1;
      continue;
    }

    if (insertError) {
      summary.failed += 1;
      if (summary.errors.length < 8) {
        summary.errors.push(
          `record_id=${recordId}: ${insertError.message || "insert failed"}`
        );
      }
      continue;
    }

    summary.inserted += 1;
  }

  return summary;
}

async function syncWorkingDataFromSheet(supabase, { force = false } = {}) {
  const now = Date.now();

  if (!force && lastSheetSyncSummary && now - lastSheetSyncAt < SHEET_SYNC_COOLDOWN_MS) {
    return { ...lastSheetSyncSummary, cached: true };
  }

  if (sheetSyncInFlight) {
    return sheetSyncInFlight;
  }

  sheetSyncInFlight = syncWorkingDataFromSheetInternal(supabase)
    .then((summary) => {
      lastSheetSyncAt = Date.now();
      lastSheetSyncSummary = summary;
      return { ...summary, cached: false };
    })
    .finally(() => {
      sheetSyncInFlight = null;
    });

  return sheetSyncInFlight;
}

async function runBackgroundSheetSyncTick(supabase) {
  try {
    const summary = await syncWorkingDataFromSheet(supabase, { force: true });
    console.log(
      `[working-data] sheet sync ok: inserted=${summary.inserted}, updated=${summary.updated}, failed=${summary.failed}, rows=${summary.sheet_rows}`
    );
    return summary;
  } catch (error) {
    console.error(
      `[working-data] sheet sync failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
    throw error;
  }
}

export function startWorkingDataSheetSync(supabase) {
  if (!supabase) {
    return { started: false, reason: "Supabase client is not configured" };
  }

  if (!ENABLE_BACKGROUND_SHEET_SYNC) {
    return { started: false, reason: "Background sync disabled by env" };
  }

  if (backgroundSyncTimer) {
    return { started: false, reason: "Background sync already running" };
  }

  const intervalMs = Math.max(15000, SHEET_SYNC_INTERVAL_MS);
  backgroundSyncTimer = setInterval(() => {
    void runBackgroundSheetSyncTick(supabase);
  }, intervalMs);

  if (typeof backgroundSyncTimer.unref === "function") {
    backgroundSyncTimer.unref();
  }

  // Warm up once at startup so the DB gets sheet rows without waiting for first interval.
  void runBackgroundSheetSyncTick(supabase);

  return { started: true, intervalMs };
}

export default function createUpdateRouter(supabase) {
  const router = Router();

  router.get("/working-data", async (req, res) => {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: "Supabase client is not configured",
        });
      }

      const page = parsePositiveInteger(req.query?.page, 1);
      const requestedPageSize = parsePositiveInteger(
        req.query?.pageSize,
        DEFAULT_PAGE_SIZE
      );
      const pageSize = clamp(requestedPageSize, 1, MAX_PAGE_SIZE);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await supabase
        .schema("public")
        .from(TABLE_NAME)
        .select("*", { count: "exact" })
        .order("Timestamp", { ascending: false, nullsFirst: false })
        .range(from, to);

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message || "Failed to load working data",
        });
      }

      const total = Number(count || 0);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const hasMore = page < totalPages;

      res.setHeader("Cache-Control", "no-store");
      return res.json({
        success: true,
        data: data || [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasMore,
        },
        sheet_sync: lastSheetSyncSummary,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message || "Server error",
      });
    }
  });

  router.post("/sync-working-data", async (_req, res) => {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: "Supabase client is not configured",
        });
      }

      const summary = await syncWorkingDataFromSheet(supabase, { force: true });
      return res.json({
        success: true,
        summary,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Sheet sync failed",
      });
    }
  });

  router.post("/update", async (req, res) => {
    try {
      const body = req.body || {};

      if (!body.id || typeof body.id !== "string") {
        return res.status(400).json({
          success: false,
          error: "id is required",
        });
      }

      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: "Supabase client is not configured",
        });
      }

      const allowedColumns = [
        "Status",
        "Assigned To",
        "Mode",
        "Remarks",
        "Updated By",
        "Timestamp",
        "Name",
        "Mobile Number",
        "Store Location",
        "Staff Behavior",
        "Staff Service",
        "Satisfaction Level",
        "Price Challenge",
        "Bill Received",
        "Your Feedback",
        "Improvement Feedback",
        "Product Unavailable",
        "Receipt Compliance",
        "Your Complaint",
        "Type of Complaint",
      ];

      const updatePayload = {};
      for (const column of allowedColumns) {
        if (Object.prototype.hasOwnProperty.call(body, column) && body[column] !== undefined) {
          updatePayload[column] = body[column];
        }
      }

      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({
          success: false,
          error: "No update fields provided",
        });
      }

      const updateTargets = [{ column: "id", value: cleanText(body.id) }];
      const providedRecordId = cleanText(body.record_id);
      if (providedRecordId) {
        updateTargets.push({ column: "record_id", value: providedRecordId });
      }

      let lastError = null;

      for (const target of updateTargets) {
        if (!target.value) {
          continue;
        }

        if (target.column === "id" && UUID_REGEX.test(cleanText(body.id)) && !UUID_REGEX.test(target.value)) {
          continue;
        }

        const { data: matchedRows, error: matchError } = await supabase
          .schema("public")
          .from(TABLE_NAME)
          .select("id,record_id,Remarks")
          .eq(target.column, target.value)
          .limit(1);

        if (matchError) {
          if (isUuidCastError(matchError.message)) {
            continue;
          }
          lastError = matchError;
          continue;
        }

        if (!matchedRows || matchedRows.length === 0) {
          continue;
        }

        const matched = matchedRows[0];
        const mergedPayload = { ...updatePayload };
        mergedPayload.Remarks = mergeRemarks(matched.Remarks, body.Remarks);

        const { data, error } = await supabase
          .schema("public")
          .from(TABLE_NAME)
          .update(mergedPayload)
          .eq("id", matched.id)
          .select("id,record_id")
          .limit(1);

        if (error) {
          if (isUuidCastError(error.message)) {
            continue;
          }
          lastError = error;
          continue;
        }

        if (data && data.length > 0) {
          return res.json({ success: true, data: data[0] });
        }
      }

      if (lastError) {
        return res.status(500).json({
          success: false,
          error: lastError.message || "Backend update failed",
        });
      }

      return res.status(404).json({
        success: false,
        error: `Record not found for id: ${body.id}`,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message || "Server error",
      });
    }
  });

  return router;
}
