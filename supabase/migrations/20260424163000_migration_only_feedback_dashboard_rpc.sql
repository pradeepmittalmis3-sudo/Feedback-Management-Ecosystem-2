BEGIN;

-- Helper parser: rating text like "5-Excellent" -> 5
CREATE OR REPLACE FUNCTION public.feedback_parse_rating(raw_value text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
  parsed integer;
BEGIN
  IF raw_value IS NULL THEN
    RETURN NULL;
  END IF;

  digits := substring(raw_value FROM '([0-9]+)');
  IF digits IS NULL THEN
    RETURN NULL;
  END IF;

  parsed := digits::integer;
  IF parsed < 1 THEN
    RETURN 1;
  ELSIF parsed > 5 THEN
    RETURN 5;
  END IF;

  RETURN parsed;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

-- Helper parser: mixed timestamp formats
CREATE OR REPLACE FUNCTION public.feedback_parse_timestamp(raw_value text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  cleaned text;
  fmt text;
  parsed_ts timestamptz;
  formats text[] := ARRAY[
    'DD/MM/YYYY HH24:MI',
    'DD/MM/YYYY HH12:MI AM',
    'MM/DD/YYYY HH24:MI',
    'MM/DD/YYYY HH12:MI AM',
    'YYYY-MM-DD HH24:MI:SS',
    'YYYY-MM-DD HH24:MI',
    'YYYY-MM-DD"T"HH24:MI:SS.MS',
    'YYYY-MM-DD"T"HH24:MI:SS'
  ];
BEGIN
  cleaned := nullif(trim(raw_value), '');
  IF cleaned IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN cleaned::timestamptz;
  EXCEPTION
    WHEN others THEN
      NULL;
  END;

  FOREACH fmt IN ARRAY formats LOOP
    BEGIN
      parsed_ts := to_timestamp(cleaned, fmt);
      RETURN parsed_ts;
    EXCEPTION
      WHEN others THEN
        NULL;
    END;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE VIEW public.migration_feedback_normalized_v
WITH (security_invoker = true)
AS
WITH raw AS (
  SELECT
    to_jsonb(md) AS row_json,
    md.ctid::text AS row_pointer
  FROM public.migration_data md
),
mapped AS (
  SELECT
    COALESCE(
      NULLIF(trim(row_json ->> 'id'), ''),
      NULLIF(trim(row_json ->> 'record_id'), ''),
      NULLIF(trim(row_json ->> '_id'), ''),
      row_pointer
    ) AS db_id,
    COALESCE(
      NULLIF(trim(row_json ->> 'record_id'), ''),
      NULLIF(trim(row_json ->> '_id'), ''),
      NULLIF(trim(row_json ->> 'external_id'), ''),
      NULLIF(trim(row_json ->> 'id'), ''),
      row_pointer
    ) AS record_id,
    COALESCE(
      public.feedback_parse_timestamp(
        COALESCE(
          NULLIF(trim(row_json ->> 'Timestamp'), ''),
          NULLIF(trim(row_json ->> 'timestamp'), ''),
          NULLIF(trim(row_json ->> 'created_at'), ''),
          NULLIF(trim(row_json ->> 'Created At'), ''),
          NULLIF(trim(row_json ->> 'Date'), '')
        )
      ),
      now()
    ) AS created_at,
    COALESCE(
      public.feedback_parse_timestamp(
        COALESCE(
          NULLIF(trim(row_json ->> 'updated_at'), ''),
          NULLIF(trim(row_json ->> 'Updated At'), ''),
          NULLIF(trim(row_json ->> 'resolved_at'), ''),
          NULLIF(trim(row_json ->> 'closed_at'), ''),
          NULLIF(trim(row_json ->> 'archived_at'), '')
        )
      ),
      public.feedback_parse_timestamp(
        COALESCE(
          NULLIF(trim(row_json ->> 'Timestamp'), ''),
          NULLIF(trim(row_json ->> 'timestamp'), ''),
          NULLIF(trim(row_json ->> 'created_at'), ''),
          NULLIF(trim(row_json ->> 'Created At'), ''),
          NULLIF(trim(row_json ->> 'Date'), '')
        )
      ),
      now()
    ) AS updated_at,
    COALESCE(
      NULLIF(trim(regexp_replace(
        COALESCE(
          row_json ->> 'Store Location',
          row_json ->> 'store_location',
          row_json ->> 'store',
          row_json ->> 'Store'
        ),
        '\\s+',
        ' ',
        'g'
      )), ''),
      'Unknown'
    ) AS store_location_raw,
    COALESCE(
      NULLIF(trim(regexp_replace(
        COALESCE(row_json ->> 'Status', row_json ->> 'status'),
        '\\s+',
        ' ',
        'g'
      )), ''),
      'Unknown'
    ) AS status_raw,
    COALESCE(
      NULLIF(trim(regexp_replace(
        COALESCE(
          row_json ->> 'Type Complaint',
          row_json ->> 'Type of Complaint',
          row_json ->> 'type',
          row_json ->> 'Type'
        ),
        '\\s+',
        ' ',
        'g'
      )), ''),
      'Unspecified'
    ) AS type_complaint_raw,
    COALESCE(
      NULLIF(trim(regexp_replace(
        COALESCE(
          row_json ->> 'Assigned To',
          row_json ->> 'user_name',
          row_json ->> 'User Name'
        ),
        '\\s+',
        ' ',
        'g'
      )), ''),
      'Unassigned'
    ) AS assigned_to_raw,
    COALESCE(
      NULLIF(trim(regexp_replace(
        COALESCE(
          row_json ->> 'Updated By',
          row_json ->> 'updated_by'
        ),
        '\\s+',
        ' ',
        'g'
      )), ''),
      'Unassigned'
    ) AS updated_by_raw,
    COALESCE(
      NULLIF(trim(regexp_replace(
        COALESCE(row_json ->> 'Mode', row_json ->> 'mode'),
        '\\s+',
        ' ',
        'g'
      )), ''),
      'Unknown'
    ) AS mode_raw,
    NULLIF(trim(COALESCE(row_json ->> 'Name', row_json ->> 'name')), '') AS customer_name,
    NULLIF(trim(COALESCE(row_json ->> 'Mobile Number', row_json ->> 'mobile')), '') AS mobile,
    NULLIF(trim(COALESCE(row_json ->> 'Your Complaint', row_json ->> 'complaint')), '') AS complaint,
    NULLIF(trim(COALESCE(row_json ->> 'Your Feedback', row_json ->> 'feedback')), '') AS feedback,
    NULLIF(
      trim(
        COALESCE(
          row_json ->> 'Remarks',
          row_json ->> 'remarks',
          row_json ->> 'status_notes',
          row_json ->> 'Status Notes'
        )
      ),
      ''
    ) AS remarks,
    NULLIF(trim(COALESCE(row_json ->> 'Product Unavailable', row_json ->> 'product_unavailable')), '') AS product_unavailable,
    CASE
      WHEN lower(trim(COALESCE(row_json ->> 'price_challenge_ok', row_json ->> 'Price Challenge', row_json ->> 'Price challenge', ''))) IN ('yes','y','true','1') THEN true
      WHEN lower(trim(COALESCE(row_json ->> 'price_challenge_ok', row_json ->> 'Price Challenge', row_json ->> 'Price challenge', ''))) IN ('no','n','false','0') THEN false
      ELSE NULL
    END AS price_challenge,
    CASE
      WHEN lower(trim(COALESCE(row_json ->> 'bill_received', row_json ->> 'Bill Received', ''))) IN ('yes','y','true','1') THEN true
      WHEN lower(trim(COALESCE(row_json ->> 'bill_received', row_json ->> 'Bill Received', ''))) IN ('no','n','false','0') THEN false
      ELSE NULL
    END AS bill_received,
    public.feedback_parse_rating(
      COALESCE(
        row_json ->> 'staff_behavior',
        row_json ->> 'Staff Behavior',
        row_json ->> 'Staff Behaviour'
      )
    ) AS staff_behavior,
    public.feedback_parse_rating(
      COALESCE(
        row_json ->> 'staff_service',
        row_json ->> 'Staff Service'
      )
    ) AS staff_service,
    public.feedback_parse_rating(
      COALESCE(
        row_json ->> 'store_satisfaction',
        row_json ->> 'Satisfaction Level',
        row_json ->> 'staff_satisfied',
        row_json ->> 'Staff Satisfied'
      )
    ) AS satisfaction_level
  FROM raw
),
normalized AS (
  SELECT
    db_id,
    record_id,
    created_at,
    updated_at,
    created_at AT TIME ZONE 'Asia/Kolkata' AS created_at_ist,
    updated_at AT TIME ZONE 'Asia/Kolkata' AS updated_at_ist,
    INITCAP(store_location_raw) AS store_location,
    CASE
      WHEN status_key IN ('resolved', 'solved') THEN 'Resolved'
      WHEN status_key = 'closed' THEN 'Closed'
      WHEN status_key = 'archived' THEN 'Archived'
      WHEN status_key IN ('in process', 'in progress') THEN 'In Process'
      WHEN status_key IN ('pending', 'new', 'active') THEN 'Pending'
      WHEN status_key = 'complaint' THEN 'Complaint'
      WHEN status_key = 'feedback' THEN 'Feedback'
      WHEN status_key = 'fake' THEN 'Fake'
      WHEN status_key = '' THEN 'Unknown'
      ELSE INITCAP(status_key)
    END AS status,
    status_key,
    INITCAP(type_complaint_raw) AS type_complaint,
    assigned_to_raw AS assigned_to,
    updated_by_raw AS updated_by,
    INITCAP(mode_raw) AS mode,
    customer_name,
    mobile,
    complaint,
    feedback,
    remarks,
    product_unavailable,
    price_challenge,
    bill_received,
    staff_behavior,
    staff_service,
    satisfaction_level
  FROM (
    SELECT
      mapped.*,
      lower(
        trim(
          regexp_replace(
            regexp_replace(COALESCE(mapped.status_raw, ''), '[_-]+', ' ', 'g'),
            '\\s+',
            ' ',
            'g'
          )
        )
      ) AS status_key
    FROM mapped
  ) keyed
)
SELECT
  normalized.*,
  ROUND(
    (
      COALESCE(normalized.staff_behavior, 0)
      + COALESCE(normalized.staff_service, 0)
      + COALESCE(normalized.satisfaction_level, 0)
    )::numeric
    /
    NULLIF(
      (CASE WHEN normalized.staff_behavior IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN normalized.staff_service IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN normalized.satisfaction_level IS NOT NULL THEN 1 ELSE 0 END),
      0
    ),
    2
  ) AS overall_rating
FROM normalized;

GRANT SELECT ON public.migration_feedback_normalized_v TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_migration_feedback_dashboard(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_store text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_assigned_to text DEFAULT NULL,
  p_updated_by text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
WITH scope_rows AS MATERIALIZED (
  SELECT *
  FROM public.migration_feedback_normalized_v v
  WHERE (p_start_date IS NULL OR v.created_at_ist::date >= p_start_date)
    AND (p_end_date IS NULL OR v.created_at_ist::date <= p_end_date)
    AND (
      p_store IS NULL
      OR lower(trim(v.store_location)) = lower(trim(p_store))
    )
),
base AS MATERIALIZED (
  SELECT *
  FROM scope_rows b
  WHERE (
      p_status IS NULL
      OR b.status_key = lower(
        trim(
          regexp_replace(
            regexp_replace(COALESCE(p_status, ''), '[_-]+', ' ', 'g'),
            '\\s+',
            ' ',
            'g'
          )
        )
      )
      OR lower(trim(b.status)) = lower(trim(p_status))
    )
    AND (
      p_assigned_to IS NULL
      OR lower(trim(b.assigned_to)) = lower(trim(p_assigned_to))
    )
    AND (
      p_updated_by IS NULL
      OR lower(trim(b.updated_by)) = lower(trim(p_updated_by))
    )
)
SELECT jsonb_build_object(
  'summary', (
    SELECT jsonb_build_object(
      'total_entries', COUNT(*),
      'feedback', COUNT(*) FILTER (WHERE status_key = 'feedback' OR feedback IS NOT NULL),
      'complaints', COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint IS NOT NULL),
      'resolved', COUNT(*) FILTER (WHERE status_key IN ('resolved', 'solved', 'closed', 'archived')),
      'pending', COUNT(*) FILTER (WHERE status_key IN ('pending', 'new', 'active', 'in process', 'in progress')),
      'low_ratings', COUNT(*) FILTER (
        WHERE COALESCE(staff_behavior, 5) <= 2
           OR COALESCE(staff_service, 5) <= 2
           OR COALESCE(satisfaction_level, 5) <= 2
      ),
      'price_challenge', COUNT(*) FILTER (WHERE price_challenge IS TRUE),
      'bill_received', COUNT(*) FILTER (WHERE bill_received IS TRUE)
    )
    FROM base
  ),

  'status_breakdown', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.status),
      '[]'::jsonb
    )
    FROM (
      SELECT
        status,
        COUNT(*) AS total,
        ROUND((COUNT(*) * 100.0) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) AS percentage
      FROM base
      GROUP BY status
    ) t
  ),

  'type_breakdown', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.type_complaint),
      '[]'::jsonb
    )
    FROM (
      SELECT
        type_complaint,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint IS NOT NULL) AS complaint_count,
        COUNT(*) FILTER (WHERE status_key = 'feedback' OR feedback IS NOT NULL) AS feedback_count
      FROM base
      GROUP BY type_complaint
    ) t
  ),

  'store_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total_records DESC, t.store_location),
      '[]'::jsonb
    )
    FROM (
      SELECT
        store_location,
        COUNT(*) AS total_records,
        COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint IS NOT NULL) AS complaint_count,
        COUNT(*) FILTER (WHERE status_key = 'feedback' OR feedback IS NOT NULL) AS feedback_count,
        COUNT(*) FILTER (WHERE status_key IN ('pending', 'new', 'active', 'in process', 'in progress')) AS pending_count,
        COUNT(*) FILTER (WHERE status_key IN ('resolved', 'solved', 'closed', 'archived')) AS resolved_count,
        ROUND(AVG(overall_rating), 2) AS avg_overall_rating
      FROM base
      GROUP BY store_location
    ) t
  ),

  'complaint_report', (
    SELECT jsonb_build_object(
      'complaint_vs_feedback', (
        SELECT jsonb_agg(to_jsonb(x) ORDER BY x.label)
        FROM (
          SELECT 'Complaint'::text AS label,
                 COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint IS NOT NULL) AS total
          FROM base
          UNION ALL
          SELECT 'Feedback'::text AS label,
                 COUNT(*) FILTER (WHERE status_key = 'feedback' OR feedback IS NOT NULL) AS total
          FROM base
        ) x
      ),
      'pending_complaints', (
        SELECT COALESCE(
          jsonb_agg(to_jsonb(pc) ORDER BY pc.created_at_ist DESC),
          '[]'::jsonb
        )
        FROM (
          SELECT
            db_id,
            record_id,
            created_at_ist,
            store_location,
            status,
            assigned_to,
            type_complaint,
            complaint,
            mobile,
            remarks
          FROM base
          WHERE status_key IN ('pending', 'new', 'active', 'in process', 'in progress', 'complaint')
            AND complaint IS NOT NULL
          ORDER BY created_at_ist DESC
          LIMIT 200
        ) pc
      ),
      'top_complaint_stores', (
        SELECT COALESCE(
          jsonb_agg(to_jsonb(cs) ORDER BY cs.total_complaints DESC, cs.store_location),
          '[]'::jsonb
        )
        FROM (
          SELECT
            store_location,
            COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint IS NOT NULL) AS total_complaints,
            COUNT(*) FILTER (WHERE status_key IN ('pending', 'new', 'active', 'in process', 'in progress')) AS pending_count,
            COUNT(*) FILTER (WHERE status_key IN ('resolved', 'solved', 'closed', 'archived')) AS resolved_count
          FROM base
          GROUP BY store_location
          HAVING COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint IS NOT NULL) > 0
          ORDER BY total_complaints DESC, store_location
          LIMIT 20
        ) cs
      )
    )
  ),

  'assigned_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.assigned_to),
      '[]'::jsonb
    )
    FROM (
      SELECT
        assigned_to,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status_key IN ('pending', 'new', 'active', 'in process', 'in progress')) AS pending_count,
        COUNT(*) FILTER (WHERE status_key IN ('resolved', 'solved', 'closed', 'archived')) AS resolved_count,
        COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint IS NOT NULL) AS complaint_count
      FROM base
      GROUP BY assigned_to
    ) t
  ),

  'updated_by_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.updated_by),
      '[]'::jsonb
    )
    FROM (
      SELECT
        updated_by,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status_key IN ('pending', 'new', 'active', 'in process', 'in progress')) AS pending_count,
        COUNT(*) FILTER (WHERE status_key IN ('resolved', 'solved', 'closed', 'archived')) AS resolved_count,
        COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint IS NOT NULL) AS complaint_count
      FROM base
      GROUP BY updated_by
    ) t
  ),

  'mode_report', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.total DESC, t.mode),
      '[]'::jsonb
    )
    FROM (
      SELECT
        mode,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint IS NOT NULL) AS complaint_count,
        COUNT(*) FILTER (WHERE status_key = 'feedback' OR feedback IS NOT NULL) AS feedback_count
      FROM base
      GROUP BY mode
    ) t
  ),

  'rating_summary', (
    SELECT jsonb_build_object(
      'avg_staff_behavior', ROUND(AVG(staff_behavior)::numeric, 2),
      'avg_staff_service', ROUND(AVG(staff_service)::numeric, 2),
      'avg_satisfaction_level', ROUND(AVG(satisfaction_level)::numeric, 2),
      'avg_overall_rating', ROUND(AVG(overall_rating)::numeric, 2),
      'low_rating_count', COUNT(*) FILTER (
        WHERE COALESCE(staff_behavior, 5) <= 2
           OR COALESCE(staff_service, 5) <= 2
           OR COALESCE(satisfaction_level, 5) <= 2
      )
    )
    FROM base
  ),

  'low_rating_records', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(lr) ORDER BY lr.created_at_ist DESC),
      '[]'::jsonb
    )
    FROM (
      SELECT
        db_id,
        record_id,
        created_at_ist,
        customer_name,
        mobile,
        store_location,
        status,
        assigned_to,
        updated_by,
        staff_behavior,
        staff_service,
        satisfaction_level,
        overall_rating,
        complaint,
        remarks
      FROM base
      WHERE COALESCE(staff_behavior, 5) <= 2
         OR COALESCE(staff_service, 5) <= 2
         OR COALESCE(satisfaction_level, 5) <= 2
      ORDER BY created_at_ist DESC
      LIMIT 200
    ) lr
  ),

  'latest_remarks', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(rm) ORDER BY rm.updated_at_ist DESC),
      '[]'::jsonb
    )
    FROM (
      SELECT
        db_id,
        record_id,
        created_at_ist,
        updated_at_ist,
        store_location,
        status,
        assigned_to,
        updated_by,
        remarks
      FROM base
      WHERE remarks IS NOT NULL
      ORDER BY updated_at_ist DESC
      LIMIT 150
    ) rm
  ),

  'daily_trend', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.entry_date),
      '[]'::jsonb
    )
    FROM (
      SELECT
        created_at_ist::date AS entry_date,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint IS NOT NULL) AS complaints,
        COUNT(*) FILTER (WHERE status_key = 'feedback' OR feedback IS NOT NULL) AS feedback,
        COUNT(*) FILTER (WHERE status_key IN ('resolved', 'solved', 'closed', 'archived')) AS resolved,
        COUNT(*) FILTER (WHERE status_key IN ('pending', 'new', 'active', 'in process', 'in progress')) AS pending
      FROM base
      GROUP BY created_at_ist::date
    ) t
  ),

  'monthly_trend', (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(t) ORDER BY t.month_date),
      '[]'::jsonb
    )
    FROM (
      SELECT
        date_trunc('month', created_at_ist)::date AS month_date,
        to_char(date_trunc('month', created_at_ist), 'YYYY-MM') AS entry_month,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status_key = 'complaint' OR complaint IS NOT NULL) AS complaints,
        COUNT(*) FILTER (WHERE status_key = 'feedback' OR feedback IS NOT NULL) AS feedback,
        COUNT(*) FILTER (WHERE status_key IN ('resolved', 'solved', 'closed', 'archived')) AS resolved,
        COUNT(*) FILTER (WHERE status_key IN ('pending', 'new', 'active', 'in process', 'in progress')) AS pending
      FROM base
      GROUP BY date_trunc('month', created_at_ist)::date
    ) t
  ),

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

  'filter_options', (
    SELECT jsonb_build_object(
      'stores', (
        SELECT COALESCE(jsonb_agg(x.store_location ORDER BY x.store_location), '[]'::jsonb)
        FROM (
          SELECT DISTINCT store_location
          FROM scope_rows
          ORDER BY store_location
        ) x
      ),
      'statuses', (
        SELECT COALESCE(jsonb_agg(x.status ORDER BY x.status), '[]'::jsonb)
        FROM (
          SELECT DISTINCT status
          FROM scope_rows
          ORDER BY status
        ) x
      ),
      'assigned_to', (
        SELECT COALESCE(jsonb_agg(x.assigned_to ORDER BY x.assigned_to), '[]'::jsonb)
        FROM (
          SELECT DISTINCT assigned_to
          FROM scope_rows
          ORDER BY assigned_to
        ) x
      ),
      'updated_by', (
        SELECT COALESCE(jsonb_agg(x.updated_by ORDER BY x.updated_by), '[]'::jsonb)
        FROM (
          SELECT DISTINCT updated_by
          FROM scope_rows
          ORDER BY updated_by
        ) x
      )
    )
  )
);
$$;

GRANT EXECUTE ON FUNCTION public.get_migration_feedback_dashboard(date, date, text, text, text, text) TO anon, authenticated;

COMMIT;
