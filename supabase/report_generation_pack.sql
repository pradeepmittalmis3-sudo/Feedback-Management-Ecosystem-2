-- Feedback Reporting Pack (Supabase)
-- Generated for report-only dashboard usage.
--
-- How to use filters:
-- 1) In each query, set date_from/date_to/store_filter in the params CTE.
-- 2) Keep NULL to include all values.
-- 3) All date grouping below is in Asia/Kolkata timezone.
--
-- Core 10 reports for practical dashboard use:
-- 1) Total Summary
-- 2) Status Wise
-- 3) Store Wise
-- 4) Complaint Type
-- 5) Assigned To
-- 6) Updated By
-- 7) Mode Wise
-- 8) Date Wise Trend
-- 9) Store Wise Rating
-- 10) Low Rating / Complaint

-- =========================================================
-- Base template (copy inside each report if you customize)
-- =========================================================
-- WITH params AS (
--   SELECT
--     NULL::date AS date_from,
--     NULL::date AS date_to,
--     NULL::text AS store_filter
-- ),
-- base AS (
--   SELECT
--     frv.id,
--     frv.record_id,
--     frv.external_id,
--     COALESCE(NULLIF(frv.store_location, ''), 'Unknown') AS store,
--     COALESCE(NULLIF(frv.status, ''), 'Unknown') AS status,
--     lower(trim(COALESCE(frv.status, ''))) AS status_key,
--     COALESCE(NULLIF(frv.user_name, ''), 'Unassigned') AS assigned_to,
--     COALESCE(NULLIF(frv.updated_by, ''), 'Unassigned') AS updated_by,
--     COALESCE(NULLIF(frv.mode, ''), 'Unknown') AS mode,
--     COALESCE(NULLIF(frv.type, ''), 'Unspecified') AS complaint_type,
--     NULLIF(trim(COALESCE(frv.complaint, '')), '') AS complaint_text,
--     NULLIF(trim(COALESCE(frv.feedback, '')), '') AS feedback_text,
--     NULLIF(trim(COALESCE(frv.remarks, '')), '') AS remarks_text,
--     NULLIF(trim(COALESCE(frv.status_notes, '')), '') AS status_notes_text,
--     frv.staff_behavior,
--     frv.staff_service,
--     frv.store_satisfaction,
--     frv.price_challenge_ok,
--     frv.bill_received,
--     frv.flow_stage,
--     frv.created_at AT TIME ZONE 'Asia/Kolkata' AS created_at_ist,
--     frv.updated_at AT TIME ZONE 'Asia/Kolkata' AS updated_at_ist,
--     frv.resolved_at AT TIME ZONE 'Asia/Kolkata' AS resolved_at_ist,
--     frv.closed_at AT TIME ZONE 'Asia/Kolkata' AS closed_at_ist
--   FROM public.feedback_reports_view frv
--   CROSS JOIN params p
--   WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
--     AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
--     AND (
--       p.store_filter IS NULL
--       OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter))
--     )
-- )

-- =========================================================
-- 1) Total Summary Report (CORE)
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
),
base AS (
  SELECT
    lower(trim(COALESCE(frv.status, ''))) AS status_key,
    NULLIF(trim(COALESCE(frv.complaint, '')), '') AS complaint_text,
    NULLIF(trim(COALESCE(frv.feedback, '')), '') AS feedback_text
  FROM public.feedback_reports_view frv
  CROSS JOIN params p
  WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
    AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
    AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
)
SELECT
  COUNT(*) AS total_entries,
  COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint_text IS NOT NULL) AS total_complaints,
  COUNT(*) FILTER (WHERE status_key = 'feedback' OR feedback_text IS NOT NULL) AS total_feedback,
  COUNT(*) FILTER (WHERE status_key IN ('solved', 'resolved', 'closed', 'archived')) AS total_resolved,
  COUNT(*) FILTER (WHERE status_key = 'fake') AS total_fake
FROM base;

-- =========================================================
-- 2) Status Wise Report (CORE)
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
),
base AS (
  SELECT COALESCE(NULLIF(frv.status, ''), 'Unknown') AS status
  FROM public.feedback_reports_view frv
  CROSS JOIN params p
  WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
    AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
    AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
),
status_counts AS (
  SELECT status, COUNT(*) AS status_count
  FROM base
  GROUP BY status
)
SELECT
  status,
  status_count,
  ROUND((status_count * 100.0) / NULLIF(SUM(status_count) OVER (), 0), 2) AS status_percentage
FROM status_counts
ORDER BY status_count DESC, status;

-- =========================================================
-- 3) Store Wise Report (CORE)
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
),
base AS (
  SELECT
    COALESCE(NULLIF(frv.store_location, ''), 'Unknown') AS store,
    lower(trim(COALESCE(frv.status, ''))) AS status_key,
    NULLIF(trim(COALESCE(frv.complaint, '')), '') AS complaint_text
  FROM public.feedback_reports_view frv
  CROSS JOIN params p
  WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
    AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
    AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
),
store_counts AS (
  SELECT
    store,
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint_text IS NOT NULL) AS complaint_records
  FROM base
  GROUP BY store
)
SELECT
  store,
  total_records,
  complaint_records,
  ROUND((complaint_records * 100.0) / NULLIF(total_records, 0), 2) AS complaint_rate_pct
FROM store_counts
ORDER BY total_records DESC, store;

-- Top stores by volume
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  COALESCE(NULLIF(frv.store_location, ''), 'Unknown') AS store,
  COUNT(*) AS total_records
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY total_records DESC, store
LIMIT 10;

-- Low-performing stores by complaint rate (minimum 10 records)
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
),
store_counts AS (
  SELECT
    COALESCE(NULLIF(frv.store_location, ''), 'Unknown') AS store,
    COUNT(*) AS total_records,
    COUNT(*) FILTER (
      WHERE lower(trim(COALESCE(frv.status, ''))) = 'complaint'
      OR NULLIF(trim(COALESCE(frv.complaint, '')), '') IS NOT NULL
    ) AS complaint_records
  FROM public.feedback_reports_view frv
  CROSS JOIN params p
  WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
    AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
    AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
  GROUP BY 1
)
SELECT
  store,
  total_records,
  complaint_records,
  ROUND((complaint_records * 100.0) / NULLIF(total_records, 0), 2) AS complaint_rate_pct
FROM store_counts
WHERE total_records >= 10
ORDER BY complaint_rate_pct DESC, total_records DESC
LIMIT 10;

-- =========================================================
-- 4) Complaint Type Report (CORE)
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
),
base AS (
  SELECT
    COALESCE(NULLIF(frv.type, ''), 'Unspecified') AS complaint_type,
    lower(trim(COALESCE(frv.status, ''))) AS status_key,
    NULLIF(trim(COALESCE(frv.complaint, '')), '') AS complaint_text,
    NULLIF(trim(COALESCE(frv.feedback, '')), '') AS feedback_text
  FROM public.feedback_reports_view frv
  CROSS JOIN params p
  WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
    AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
    AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
)
SELECT
  complaint_type,
  COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint_text IS NOT NULL) AS complaint_count,
  COUNT(*) FILTER (WHERE status_key = 'feedback' OR feedback_text IS NOT NULL) AS feedback_count,
  COUNT(*) AS total_records
FROM base
GROUP BY complaint_type
ORDER BY total_records DESC, complaint_type;

-- =========================================================
-- 5) Assigned To Report (CORE)
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  COALESCE(NULLIF(frv.user_name, ''), 'Unassigned') AS assigned_to,
  COUNT(*) AS assigned_count
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY assigned_count DESC, assigned_to;

-- =========================================================
-- 6) Updated By Report (CORE)
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  COALESCE(NULLIF(frv.updated_by, ''), 'Unassigned') AS updated_by,
  COUNT(*) AS update_count
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY update_count DESC, updated_by;

-- =========================================================
-- 7) Mode Wise Report (CORE)
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  COALESCE(NULLIF(frv.mode, ''), 'Unknown') AS mode,
  COUNT(*) AS mode_count,
  ROUND((COUNT(*) * 100.0) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) AS mode_percentage
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY mode_count DESC, mode;

-- =========================================================
-- 8) Date Wise Report (CORE)
-- =========================================================
-- Daily entries
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
  COUNT(*) AS daily_entries
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY day;

-- Weekly entries
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  date_trunc('week', frv.created_at AT TIME ZONE 'Asia/Kolkata')::date AS week_start,
  COUNT(*) AS weekly_entries
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY week_start;

-- Monthly entries
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  to_char(date_trunc('month', frv.created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
  COUNT(*) AS monthly_entries
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY month;

-- =========================================================
-- 9) Staff Behavior Report
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
),
base AS (
  SELECT frv.staff_behavior
  FROM public.feedback_reports_view frv
  CROSS JOIN params p
  WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
    AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
    AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
)
SELECT
  ROUND(AVG(staff_behavior)::numeric, 2) AS avg_staff_behavior,
  COUNT(*) FILTER (WHERE staff_behavior <= 2) AS low_score_count,
  COUNT(*) FILTER (WHERE staff_behavior >= 4) AS high_score_count
FROM base
WHERE staff_behavior IS NOT NULL;

-- =========================================================
-- 10) Staff Service Report
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
),
base AS (
  SELECT frv.staff_service
  FROM public.feedback_reports_view frv
  CROSS JOIN params p
  WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
    AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
    AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
)
SELECT
  ROUND(AVG(staff_service)::numeric, 2) AS avg_staff_service,
  COUNT(*) FILTER (WHERE staff_service <= 2) AS low_score_count,
  COUNT(*) FILTER (WHERE staff_service >= 4) AS high_score_count
FROM base
WHERE staff_service IS NOT NULL;

-- =========================================================
-- 11) Satisfaction Level Report
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
),
base AS (
  SELECT frv.store_satisfaction
  FROM public.feedback_reports_view frv
  CROSS JOIN params p
  WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
    AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
    AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
)
SELECT
  ROUND(AVG(store_satisfaction)::numeric, 2) AS avg_satisfaction,
  COUNT(*) FILTER (WHERE store_satisfaction <= 2) AS low_satisfaction_cases
FROM base
WHERE store_satisfaction IS NOT NULL;

-- =========================================================
-- 12) Store Wise Rating Report (CORE)
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  COALESCE(NULLIF(frv.store_location, ''), 'Unknown') AS store,
  ROUND(AVG(frv.staff_behavior)::numeric, 2) AS avg_behavior,
  ROUND(AVG(frv.staff_service)::numeric, 2) AS avg_service,
  ROUND(AVG(frv.store_satisfaction)::numeric, 2) AS avg_satisfaction,
  COUNT(*) AS total_records
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY total_records DESC, store;

-- =========================================================
-- 13) Price Challenge Report
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  CASE
    WHEN frv.price_challenge_ok IS TRUE THEN 'Yes'
    WHEN frv.price_challenge_ok IS FALSE THEN 'No'
    ELSE 'Unknown'
  END AS price_challenge,
  COUNT(*) AS record_count
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY record_count DESC;

-- Store-wise price challenge
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  COALESCE(NULLIF(frv.store_location, ''), 'Unknown') AS store,
  COUNT(*) FILTER (WHERE frv.price_challenge_ok IS TRUE) AS yes_count,
  COUNT(*) FILTER (WHERE frv.price_challenge_ok IS FALSE) AS no_count,
  COUNT(*) FILTER (WHERE frv.price_challenge_ok IS NULL) AS unknown_count
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY (yes_count + no_count + unknown_count) DESC, store;

-- =========================================================
-- 14) Bill Received Report
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  CASE
    WHEN frv.bill_received IS TRUE THEN 'Yes'
    WHEN frv.bill_received IS FALSE THEN 'No'
    ELSE 'Unknown'
  END AS bill_received,
  COUNT(*) AS record_count
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY record_count DESC;

-- Store-wise billing compliance
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  COALESCE(NULLIF(frv.store_location, ''), 'Unknown') AS store,
  COUNT(*) FILTER (WHERE frv.bill_received IS TRUE) AS bill_yes,
  COUNT(*) FILTER (WHERE frv.bill_received IS FALSE) AS bill_no,
  ROUND(
    (COUNT(*) FILTER (WHERE frv.bill_received IS TRUE) * 100.0)
    / NULLIF(COUNT(*) FILTER (WHERE frv.bill_received IS NOT NULL), 0),
    2
  ) AS bill_compliance_pct
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY bill_compliance_pct DESC NULLS LAST, store;

-- =========================================================
-- 15) Complaint Trend Report
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
),
base AS (
  SELECT
    (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
    lower(trim(COALESCE(frv.status, ''))) AS status_key,
    NULLIF(trim(COALESCE(frv.complaint, '')), '') AS complaint_text,
    NULLIF(trim(COALESCE(frv.feedback, '')), '') AS feedback_text
  FROM public.feedback_reports_view frv
  CROSS JOIN params p
  WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
    AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
    AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
)
SELECT
  day,
  COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint_text IS NOT NULL) AS complaint_trend,
  COUNT(*) FILTER (WHERE status_key = 'feedback' OR feedback_text IS NOT NULL) AS feedback_trend
FROM base
GROUP BY day
ORDER BY day;

-- =========================================================
-- 16) User Performance Report
-- =========================================================
-- Assigned to vs resolved
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  COALESCE(NULLIF(frv.user_name, ''), 'Unassigned') AS assigned_to,
  COUNT(*) AS total_assigned,
  COUNT(*) FILTER (
    WHERE lower(trim(COALESCE(frv.status, ''))) IN ('solved', 'resolved', 'closed', 'archived')
  ) AS resolved_count,
  ROUND(
    (COUNT(*) FILTER (
      WHERE lower(trim(COALESCE(frv.status, ''))) IN ('solved', 'resolved', 'closed', 'archived')
    ) * 100.0) / NULLIF(COUNT(*), 0),
    2
  ) AS resolved_rate_pct
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY resolved_rate_pct DESC NULLS LAST, total_assigned DESC;

-- Updated by vs handled count
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  COALESCE(NULLIF(frv.updated_by, ''), 'Unassigned') AS updated_by,
  COUNT(*) AS handled_count
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY handled_count DESC, updated_by;

-- =========================================================
-- 17) Remarks / Notes Report
-- =========================================================
-- Latest remarks list
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  COALESCE(frv.record_id, frv.external_id, frv.id::text) AS record_ref,
  COALESCE(NULLIF(frv.store_location, ''), 'Unknown') AS store,
  COALESCE(NULLIF(frv.status, ''), 'Unknown') AS status,
  COALESCE(NULLIF(frv.remarks, ''), NULLIF(frv.status_notes, '')) AS latest_note,
  (frv.updated_at AT TIME ZONE 'Asia/Kolkata') AS updated_at_ist
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE COALESCE(NULLIF(frv.remarks, ''), NULLIF(frv.status_notes, '')) IS NOT NULL
  AND (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
ORDER BY frv.updated_at DESC
LIMIT 100;

-- Remarks frequency
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
),
base AS (
  SELECT lower(trim(COALESCE(frv.remarks, frv.status_notes, ''))) AS note_key
  FROM public.feedback_reports_view frv
  CROSS JOIN params p
  WHERE COALESCE(NULLIF(frv.remarks, ''), NULLIF(frv.status_notes, '')) IS NOT NULL
    AND (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
    AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
    AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
)
SELECT
  note_key AS remark_text,
  COUNT(*) AS remark_count
FROM base
WHERE note_key <> ''
GROUP BY note_key
ORDER BY remark_count DESC, remark_text
LIMIT 50;

-- =========================================================
-- 18) Low Rating Report (CORE)
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  COALESCE(frv.record_id, frv.external_id, frv.id::text) AS record_ref,
  COALESCE(NULLIF(frv.store_location, ''), 'Unknown') AS store,
  COALESCE(NULLIF(frv.status, ''), 'Unknown') AS status,
  frv.staff_behavior,
  frv.staff_service,
  frv.store_satisfaction,
  NULLIF(trim(COALESCE(frv.complaint, '')), '') AS complaint,
  (frv.created_at AT TIME ZONE 'Asia/Kolkata') AS created_at_ist
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE (
    COALESCE(frv.staff_behavior, 5) <= 2
    OR COALESCE(frv.staff_service, 5) <= 2
    OR COALESCE(frv.store_satisfaction, 5) <= 2
  )
  AND (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
ORDER BY frv.created_at DESC;

-- =========================================================
-- 19) Fake / Channel Partner Report
-- =========================================================
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
),
base AS (
  SELECT lower(trim(COALESCE(frv.status, ''))) AS status_key
  FROM public.feedback_reports_view frv
  CROSS JOIN params p
  WHERE (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
    AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
    AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
)
SELECT
  COUNT(*) FILTER (WHERE status_key = 'fake') AS fake_records_count,
  COUNT(*) FILTER (WHERE status_key IN ('channel partner', 'channel partner store')) AS channel_partner_records_count
FROM base;

-- =========================================================
-- 20) Historical Migration Report
-- =========================================================
-- Migration trend by month
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
)
SELECT
  to_char(date_trunc('month', frv.created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
  COUNT(*) AS migration_records
FROM public.feedback_reports_view frv
CROSS JOIN params p
WHERE frv.flow_stage = 'migration'
  AND (p.date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY month;

-- Resolved/Closed trend by month
WITH params AS (
  SELECT NULL::date AS date_from, NULL::date AS date_to, NULL::text AS store_filter
),
base AS (
  SELECT
    COALESCE(frv.resolved_at, frv.closed_at, frv.archived_at, frv.created_at) AS event_ts,
    lower(trim(COALESCE(frv.status, ''))) AS status_key,
    frv.store_location
  FROM public.feedback_reports_view frv
)
SELECT
  to_char(date_trunc('month', base.event_ts AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
  COUNT(*) FILTER (WHERE base.status_key IN ('solved', 'resolved', 'closed', 'archived')) AS resolved_closed_records
FROM base
CROSS JOIN params p
WHERE (p.date_from IS NULL OR (base.event_ts AT TIME ZONE 'Asia/Kolkata')::date >= p.date_from)
  AND (p.date_to IS NULL OR (base.event_ts AT TIME ZONE 'Asia/Kolkata')::date <= p.date_to)
  AND (p.store_filter IS NULL OR lower(trim(COALESCE(base.store_location, ''))) = lower(trim(p.store_filter)))
GROUP BY 1
ORDER BY month;
