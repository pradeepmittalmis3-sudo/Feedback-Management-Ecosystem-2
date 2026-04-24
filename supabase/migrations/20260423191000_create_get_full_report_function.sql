BEGIN;

CREATE OR REPLACE FUNCTION public.get_full_report(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_store text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
WITH base AS MATERIALIZED (
  SELECT
    COALESCE(frv.record_id, frv.external_id, frv.id::text) AS record_ref,
    COALESCE(NULLIF(frv.name, ''), 'Unknown') AS name,
    COALESCE(NULLIF(frv.mobile, ''), '') AS mobile_number,
    COALESCE(NULLIF(frv.store_location, ''), 'Unknown') AS store_location,
    COALESCE(NULLIF(frv.status, ''), 'Unknown') AS status,
    lower(
      trim(
        regexp_replace(
          regexp_replace(COALESCE(frv.status, ''), '[_-]+', ' ', 'g'),
          '\\s+',
          ' ',
          'g'
        )
      )
    ) AS status_key,
    COALESCE(NULLIF(frv.type, ''), 'Unspecified') AS type_complaint,
    COALESCE(NULLIF(frv.user_name, ''), 'Unassigned') AS assigned_to,
    COALESCE(NULLIF(frv.updated_by, ''), 'Unassigned') AS updated_by,
    COALESCE(NULLIF(frv.mode, ''), 'Unknown') AS mode,
    CASE
      WHEN frv.price_challenge_ok IS TRUE THEN 'Yes'
      WHEN frv.price_challenge_ok IS FALSE THEN 'No'
      ELSE 'Unknown'
    END AS price_challenge,
    CASE
      WHEN frv.bill_received IS TRUE THEN 'Yes'
      WHEN frv.bill_received IS FALSE THEN 'No'
      ELSE 'Unknown'
    END AS bill_received,
    NULLIF(trim(COALESCE(frv.complaint, '')), '') AS complaint_text,
    NULLIF(trim(COALESCE(frv.feedback, '')), '') AS feedback_text,
    NULLIF(trim(COALESCE(frv.remarks, '')), '') AS remarks,
    NULLIF(trim(COALESCE(frv.status_notes, '')), '') AS status_notes,
    frv.staff_behavior::numeric AS staff_behavior_num,
    frv.staff_service::numeric AS staff_service_num,
    frv.store_satisfaction::numeric AS satisfaction_num,
    frv.flow_stage,
    (frv.created_at AT TIME ZONE 'Asia/Kolkata') AS created_at_ist,
    (frv.updated_at AT TIME ZONE 'Asia/Kolkata') AS updated_at_ist,
    (COALESCE(frv.resolved_at, frv.closed_at, frv.archived_at, frv.updated_at, frv.created_at) AT TIME ZONE 'Asia/Kolkata') AS lifecycle_at_ist
  FROM public.feedback_reports_view frv
  WHERE (p_date_from IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date >= p_date_from)
    AND (p_date_to IS NULL OR (frv.created_at AT TIME ZONE 'Asia/Kolkata')::date <= p_date_to)
    AND (
      p_store IS NULL
      OR lower(trim(COALESCE(frv.store_location, ''))) = lower(trim(p_store))
    )
)
SELECT jsonb_build_object(

  -- 1. Summary Cards
  'summary', (
    SELECT jsonb_build_object(
      'total_records', COUNT(*),
      'total_complaints', COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint_text IS NOT NULL),
      'total_feedback', COUNT(*) FILTER (WHERE status_key = 'feedback' OR feedback_text IS NOT NULL),
      'total_resolved', COUNT(*) FILTER (WHERE status_key IN ('solved', 'resolved', 'closed', 'archived')),
      'total_closed', COUNT(*) FILTER (WHERE status_key = 'closed'),
      'total_pending', COUNT(*) FILTER (WHERE status_key IN ('pending', 'complaint', 'in process', 'in progress', 'new', 'active')),
      'total_fake', COUNT(*) FILTER (WHERE status_key = 'fake'),
      'total_channel_partner', COUNT(*) FILTER (WHERE status_key IN ('channel partner', 'channel partner store'))
    )
    FROM base
  ),

  -- 2. Status Wise Report
  'status_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.status),
      '[]'::jsonb
    )
    FROM (
      SELECT status, COUNT(*) AS total
      FROM base
      GROUP BY status
    ) t
  ),

  -- 3. Type Complaint Wise Report
  'type_complaint_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.type_complaint),
      '[]'::jsonb
    )
    FROM (
      SELECT
        type_complaint,
        COUNT(*) AS total,
        ROUND((COUNT(*) * 100.0) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) AS percentage
      FROM base
      GROUP BY type_complaint
    ) t
  ),

  -- 4. Store Wise Report
  'store_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.store_location),
      '[]'::jsonb
    )
    FROM (
      SELECT
        store_location,
        COUNT(*) AS total
      FROM base
      GROUP BY store_location
    ) t
  ),

  -- 5. Assigned To Wise Report
  'assigned_to_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.assigned_to),
      '[]'::jsonb
    )
    FROM (
      SELECT
        assigned_to,
        COUNT(*) AS total
      FROM base
      GROUP BY assigned_to
    ) t
  ),

  -- 6. Updated By Wise Report
  'updated_by_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.updated_by),
      '[]'::jsonb
    )
    FROM (
      SELECT
        updated_by,
        COUNT(*) AS total
      FROM base
      GROUP BY updated_by
    ) t
  ),

  -- 7. Mode Wise Report
  'mode_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.mode),
      '[]'::jsonb
    )
    FROM (
      SELECT
        mode,
        COUNT(*) AS total
      FROM base
      GROUP BY mode
    ) t
  ),

  -- 8. Price Challenge Report
  'price_challenge_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.price_challenge),
      '[]'::jsonb
    )
    FROM (
      SELECT
        price_challenge,
        COUNT(*) AS total
      FROM base
      GROUP BY price_challenge
    ) t
  ),

  -- 9. Bill Received Report
  'bill_received_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.bill_received),
      '[]'::jsonb
    )
    FROM (
      SELECT
        bill_received,
        COUNT(*) AS total
      FROM base
      GROUP BY bill_received
    ) t
  ),

  -- 10. Store + Status Matrix
  'store_status_matrix', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.store_location, t.total DESC),
      '[]'::jsonb
    )
    FROM (
      SELECT
        store_location,
        status,
        COUNT(*) AS total
      FROM base
      GROUP BY store_location, status
    ) t
  ),

  -- 11. Assigned To + Status Matrix
  'assigned_status_matrix', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.assigned_to, t.total DESC),
      '[]'::jsonb
    )
    FROM (
      SELECT
        assigned_to,
        status,
        COUNT(*) AS total
      FROM base
      GROUP BY assigned_to, status
    ) t
  ),

  -- 12. Overall Rating Averages
  'rating_summary', (
    SELECT jsonb_build_object(
      'avg_staff_behavior', ROUND(AVG(staff_behavior_num), 2),
      'avg_staff_service', ROUND(AVG(staff_service_num), 2),
      'avg_satisfaction_level', ROUND(AVG(satisfaction_num), 2)
    )
    FROM base
  ),

  -- 13. Store Wise Average Ratings
  'store_rating_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total_records DESC, t.store_location),
      '[]'::jsonb
    )
    FROM (
      SELECT
        store_location,
        ROUND(AVG(staff_behavior_num), 2) AS avg_behavior,
        ROUND(AVG(staff_service_num), 2) AS avg_service,
        ROUND(AVG(satisfaction_num), 2) AS avg_satisfaction,
        COUNT(*) AS total_records
      FROM base
      GROUP BY store_location
    ) t
  ),

  -- 14. Low Rating Records
  'low_rating_records', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC),
      '[]'::jsonb
    )
    FROM (
      SELECT
        record_ref AS id,
        created_at_ist AS "Timestamp",
        name AS "Name",
        mobile_number AS "Mobile Number",
        store_location AS "Store Location",
        staff_behavior_num AS "Staff Behavior",
        staff_service_num AS "Staff Service",
        satisfaction_num AS "Satisfaction Level",
        complaint_text AS "Your Complaint",
        COALESCE(remarks, status_notes) AS "Remarks",
        status AS "Status",
        created_at_ist AS created_at
      FROM base
      WHERE COALESCE(staff_behavior_num, 5) <= 2
         OR COALESCE(staff_service_num, 5) <= 2
         OR COALESCE(satisfaction_num, 5) <= 2
      ORDER BY created_at_ist DESC
      LIMIT 200
    ) t
  ),

  -- 15. Top Complaint Stores
  'top_complaint_stores', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total_complaints DESC, t.store_location),
      '[]'::jsonb
    )
    FROM (
      SELECT
        store_location,
        COUNT(*) AS total_complaints
      FROM base
      WHERE status_key = 'complaint' OR complaint_text IS NOT NULL
      GROUP BY store_location
      ORDER BY total_complaints DESC
      LIMIT 20
    ) t
  ),

  -- 16. Fake / Channel Partner Report
  'special_status_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.status),
      '[]'::jsonb
    )
    FROM (
      SELECT
        status,
        COUNT(*) AS total
      FROM base
      WHERE status_key IN ('fake', 'channel partner', 'channel partner store')
      GROUP BY status
    ) t
  ),

  -- 17. Latest Remarks
  'latest_remarks', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.updated_at DESC),
      '[]'::jsonb
    )
    FROM (
      SELECT
        record_ref AS id,
        created_at_ist AS "Timestamp",
        name AS "Name",
        store_location AS "Store Location",
        status AS "Status",
        assigned_to AS "Assigned To",
        mode AS "Mode",
        COALESCE(remarks, status_notes) AS "Remarks",
        updated_by AS "Updated By",
        updated_at_ist AS updated_at
      FROM base
      WHERE COALESCE(remarks, status_notes) IS NOT NULL
      ORDER BY updated_at_ist DESC
      LIMIT 100
    ) t
  ),

  -- 18. Daily Trend
  'daily_trend', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.entry_date),
      '[]'::jsonb
    )
    FROM (
      SELECT
        created_at_ist::date AS entry_date,
        COUNT(*) AS total
      FROM base
      GROUP BY created_at_ist::date
    ) t
  ),

  -- 19. Weekly Trend
  'weekly_trend', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.week_start),
      '[]'::jsonb
    )
    FROM (
      SELECT
        date_trunc('week', created_at_ist)::date AS week_start,
        COUNT(*) AS total
      FROM base
      GROUP BY date_trunc('week', created_at_ist)::date
    ) t
  ),

  -- 20. Monthly Trend
  'monthly_trend', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.month_date),
      '[]'::jsonb
    )
    FROM (
      SELECT
        date_trunc('month', created_at_ist)::date AS month_date,
        COUNT(*) AS total
      FROM base
      GROUP BY date_trunc('month', created_at_ist)::date
    ) t
  )
);
$$;

GRANT EXECUTE ON FUNCTION public.get_full_report(date, date, text) TO anon, authenticated;

COMMIT;
