BEGIN;

ALTER TABLE public.feedback_submissions
  ADD COLUMN IF NOT EXISTS record_id text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE public.feedback_submissions
SET record_id = coalesce(nullif(record_id, ''), nullif(external_id, ''), id::text)
WHERE record_id IS NULL OR trim(record_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS feedback_submissions_record_id_uidx
  ON public.feedback_submissions (record_id)
  WHERE record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_source ON public.feedback_submissions (source);
CREATE INDEX IF NOT EXISTS idx_feedback_updated ON public.feedback_submissions (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_resolved ON public.feedback_submissions (resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_closed ON public.feedback_submissions (closed_at DESC);

CREATE OR REPLACE FUNCTION public.feedback_apply_workflow_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  status_key text;
BEGIN
  NEW.updated_at := now();
  NEW.record_id := coalesce(nullif(NEW.record_id, ''), nullif(NEW.external_id, ''), NEW.id::text);
  NEW.external_id := coalesce(nullif(NEW.external_id, ''), NEW.record_id);

  status_key := lower(trim(coalesce(NEW.status, '')));

  IF status_key IN ('solved', 'resolved', 'closed', 'archived') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  END IF;

  IF status_key = 'closed' AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
  END IF;

  IF status_key = 'archived' AND NEW.archived_at IS NULL THEN
    NEW.archived_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_apply_workflow_fields ON public.feedback_submissions;
CREATE TRIGGER trg_feedback_apply_workflow_fields
  BEFORE INSERT OR UPDATE ON public.feedback_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.feedback_apply_workflow_fields();

CREATE OR REPLACE VIEW public.feedback_working_view
WITH (security_invoker = true)
AS
SELECT *
FROM public.feedback_submissions
WHERE lower(trim(coalesce(status, 'pending'))) IN (
  'new',
  'active',
  'in progress',
  'in_progress',
  'pending',
  'complaint',
  'feedback',
  'channel partner store',
  'channel partner'
);

CREATE OR REPLACE VIEW public.feedback_migration_view
WITH (security_invoker = true)
AS
SELECT *
FROM public.feedback_submissions
WHERE lower(trim(coalesce(status, ''))) IN (
  'solved',
  'resolved',
  'closed',
  'archived',
  'fake'
)
OR resolved_at IS NOT NULL
OR closed_at IS NOT NULL
OR archived_at IS NOT NULL;

CREATE OR REPLACE VIEW public.feedback_reports_view
WITH (security_invoker = true)
AS
SELECT
  fs.*,
  CASE
    WHEN lower(trim(coalesce(fs.status, ''))) IN ('solved', 'resolved', 'closed', 'archived', 'fake')
      OR fs.resolved_at IS NOT NULL
      OR fs.closed_at IS NOT NULL
      OR fs.archived_at IS NOT NULL
    THEN 'migration'
    ELSE 'working'
  END AS flow_stage
FROM public.feedback_submissions fs;

GRANT SELECT ON public.feedback_working_view TO anon, authenticated;
GRANT SELECT ON public.feedback_migration_view TO anon, authenticated;
GRANT SELECT ON public.feedback_reports_view TO anon, authenticated;

COMMIT;
