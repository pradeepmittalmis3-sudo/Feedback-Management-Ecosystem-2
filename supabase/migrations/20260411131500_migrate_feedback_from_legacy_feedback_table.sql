BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Parse ratings such as "5-Excellent" into a bounded integer score.
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

-- Parse text booleans used by older feedback sources.
CREATE OR REPLACE FUNCTION public.feedback_parse_boolean(raw_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
BEGIN
  cleaned := lower(trim(coalesce(raw_value, '')));

  IF cleaned = '' THEN
    RETURN NULL;
  ELSIF cleaned IN ('true', 't', 'yes', 'y', '1') THEN
    RETURN TRUE;
  ELSIF cleaned IN ('false', 'f', 'no', 'n', '0') THEN
    RETURN FALSE;
  END IF;

  RETURN NULL;
END;
$$;

-- Parse mixed timestamp formats from legacy sheets/tables.
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

CREATE TABLE IF NOT EXISTS public.feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile text NOT NULL,
  store_location text NOT NULL,
  staff_behavior integer NOT NULL CHECK (staff_behavior BETWEEN 1 AND 5),
  staff_service integer NOT NULL CHECK (staff_service BETWEEN 1 AND 5),
  store_satisfaction integer NOT NULL CHECK (store_satisfaction BETWEEN 1 AND 5),
  price_challenge_ok boolean NOT NULL DEFAULT true,
  bill_received boolean NOT NULL DEFAULT true,
  complaint text,
  feedback text,
  suggestions text,
  product_unavailable text,
  no_purchase_without_bill text,
  status text NOT NULL DEFAULT 'Pending',
  status_notes text,
  user_name text,
  mode text,
  remarks text,
  updated_by text,
  type text,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_submissions ADD COLUMN IF NOT EXISTS user_name text;
ALTER TABLE public.feedback_submissions ADD COLUMN IF NOT EXISTS mode text;
ALTER TABLE public.feedback_submissions ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE public.feedback_submissions ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE public.feedback_submissions ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.feedback_submissions ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.feedback_submissions ADD COLUMN IF NOT EXISTS no_purchase_without_bill text;
ALTER TABLE public.feedback_submissions ADD COLUMN IF NOT EXISTS status_notes text;
ALTER TABLE public.feedback_submissions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.feedback_submissions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_submissions'
      AND policyname = 'Allow public insert'
  ) THEN
    CREATE POLICY "Allow public insert"
      ON public.feedback_submissions
      FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_submissions'
      AND policyname = 'Allow authenticated select'
  ) THEN
    CREATE POLICY "Allow authenticated select"
      ON public.feedback_submissions
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_submissions'
      AND policyname = 'Allow authenticated update'
  ) THEN
    CREATE POLICY "Allow authenticated update"
      ON public.feedback_submissions
      FOR UPDATE
      USING (auth.role() = 'authenticated');
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_feedback_store ON public.feedback_submissions (store_location);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback_submissions (status);
CREATE INDEX IF NOT EXISTS idx_feedback_external_id ON public.feedback_submissions (external_id);

DO $$
BEGIN
  IF to_regclass('public."Feedback"') IS NOT NULL THEN
    WITH legacy_rows AS (
      SELECT
        trim(coalesce(legacy_json.payload->>'Name', legacy_json.payload->>'name')) AS name,
        trim(coalesce(legacy_json.payload->>'Mobile Number', legacy_json.payload->>'mobile_number', legacy_json.payload->>'mobile')) AS mobile,
        trim(coalesce(legacy_json.payload->>'Store Location', legacy_json.payload->>'store_location')) AS store_location,
        coalesce(legacy_json.payload->>'Staff Behavior', legacy_json.payload->>'Staff Behaviour', legacy_json.payload->>'staff_behavior', legacy_json.payload->>'staff_behaviour') AS staff_behavior_raw,
        coalesce(legacy_json.payload->>'Staff Service', legacy_json.payload->>'staff_service') AS staff_service_raw,
        coalesce(legacy_json.payload->>'Satisfaction Level', legacy_json.payload->>'Staff Satisfied', legacy_json.payload->>'store_satisfaction', legacy_json.payload->>'staff_satisfied') AS satisfaction_raw,
        coalesce(legacy_json.payload->>'Price Challenge', legacy_json.payload->>'Price challenge', legacy_json.payload->>'price_challenge', legacy_json.payload->>'price_challenge_ok') AS price_challenge_raw,
        coalesce(legacy_json.payload->>'Bill Received', legacy_json.payload->>'bill_received') AS bill_received_raw,
        trim(coalesce(legacy_json.payload->>'Your Complaint', legacy_json.payload->>'complaint', legacy_json.payload->>'your_complaint')) AS complaint,
        trim(coalesce(legacy_json.payload->>'Your Feedback', legacy_json.payload->>'feedback', legacy_json.payload->>'your_feedback')) AS feedback,
        trim(coalesce(legacy_json.payload->>'Improvement Feedback', legacy_json.payload->>'Your Suggestions', legacy_json.payload->>'suggestions', legacy_json.payload->>'your_suggestions')) AS suggestions,
        trim(coalesce(legacy_json.payload->>'Product Unavailable', legacy_json.payload->>'product_unavailable')) AS product_unavailable,
        trim(coalesce(legacy_json.payload->>'Receipt Compliance', legacy_json.payload->>'No purchase without bill', legacy_json.payload->>'no_purchase_without_bill')) AS no_purchase_without_bill,
        trim(coalesce(legacy_json.payload->>'Status', legacy_json.payload->>'status')) AS status,
        trim(coalesce(legacy_json.payload->>'Remarks', legacy_json.payload->>'Admin Notes', legacy_json.payload->>'status_notes', legacy_json.payload->>'admin_notes')) AS status_notes,
        trim(coalesce(legacy_json.payload->>'Assigned To', legacy_json.payload->>'User', legacy_json.payload->>'user_name')) AS user_name,
        trim(coalesce(legacy_json.payload->>'Mode', legacy_json.payload->>'mode')) AS mode,
        trim(coalesce(legacy_json.payload->>'Updated By', legacy_json.payload->>'updated_by')) AS updated_by,
        trim(coalesce(legacy_json.payload->>'Type of Complaint', legacy_json.payload->>'Type Complaint', legacy_json.payload->>'Type', legacy_json.payload->>'type')) AS type,
        trim(coalesce(legacy_json.payload->>'_id', legacy_json.payload->>'external_id', legacy_json.payload->>'id')) AS external_id,
        coalesce(legacy_json.payload->>'Timestamp', legacy_json.payload->>'timestamp', legacy_json.payload->>'created_at') AS timestamp_raw
      FROM public."Feedback" legacy
      CROSS JOIN LATERAL (
        SELECT to_jsonb(legacy) AS payload
      ) AS legacy_json
    ),
    normalized AS (
      SELECT
        coalesce(nullif(name, ''), 'Unknown') AS name,
        coalesce(nullif(mobile, ''), '') AS mobile,
        coalesce(nullif(store_location, ''), 'Unknown') AS store_location,
        coalesce(public.feedback_parse_rating(staff_behavior_raw), 3) AS staff_behavior,
        coalesce(public.feedback_parse_rating(staff_service_raw), 3) AS staff_service,
        coalesce(public.feedback_parse_rating(satisfaction_raw), 3) AS store_satisfaction,
        coalesce(public.feedback_parse_boolean(price_challenge_raw), true) AS price_challenge_ok,
        coalesce(public.feedback_parse_boolean(bill_received_raw), true) AS bill_received,
        nullif(complaint, '') AS complaint,
        nullif(feedback, '') AS feedback,
        nullif(suggestions, '') AS suggestions,
        nullif(product_unavailable, '') AS product_unavailable,
        nullif(no_purchase_without_bill, '') AS no_purchase_without_bill,
        coalesce(nullif(status, ''), 'Pending') AS status,
        nullif(status_notes, '') AS status_notes,
        nullif(user_name, '') AS user_name,
        nullif(mode, '') AS mode,
        nullif(updated_by, '') AS updated_by,
        nullif(type, '') AS type,
        nullif(external_id, '') AS external_id,
        coalesce(public.feedback_parse_timestamp(timestamp_raw), now()) AS created_at
      FROM legacy_rows
    )
    INSERT INTO public.feedback_submissions (
      name,
      mobile,
      store_location,
      staff_behavior,
      staff_service,
      store_satisfaction,
      price_challenge_ok,
      bill_received,
      complaint,
      feedback,
      suggestions,
      product_unavailable,
      no_purchase_without_bill,
      status,
      status_notes,
      user_name,
      mode,
      remarks,
      updated_by,
      type,
      external_id,
      created_at,
      updated_at
    )
    SELECT
      n.name,
      n.mobile,
      n.store_location,
      n.staff_behavior,
      n.staff_service,
      n.store_satisfaction,
      n.price_challenge_ok,
      n.bill_received,
      n.complaint,
      n.feedback,
      n.suggestions,
      n.product_unavailable,
      n.no_purchase_without_bill,
      n.status,
      n.status_notes,
      n.user_name,
      n.mode,
      n.status_notes,
      n.updated_by,
      n.type,
      n.external_id,
      n.created_at,
      n.created_at
    FROM normalized n
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.feedback_submissions existing
      WHERE existing.name = n.name
        AND existing.mobile = n.mobile
        AND existing.created_at = n.created_at
    );
  END IF;
END;
$$;

COMMIT;
