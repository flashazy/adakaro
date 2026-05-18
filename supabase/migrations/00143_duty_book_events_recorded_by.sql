-- Duty book accountability: who recorded each event and who last edited remarks.

ALTER TABLE public.duty_book_reports
  ADD COLUMN IF NOT EXISTS remarks_last_modified_by_id uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.duty_book_reports.remarks_last_modified_by_id IS
  'Profile that last saved remarks on this report.';

CREATE INDEX IF NOT EXISTS idx_duty_book_reports_remarks_last_modified_by
  ON public.duty_book_reports (remarks_last_modified_by_id)
  WHERE remarks_last_modified_by_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Normalized events (replaces JSON-only storage for new reads/writes)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.duty_book_events (
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.duty_book_reports(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  event_time text NOT NULL,
  event_type text NOT NULL,
  description text NOT NULL,
  recorded_by_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT duty_book_events_time_format CHECK (event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT duty_book_events_type_check CHECK (
    event_type IN ('incident', 'guest', 'announcement', 'other')
  ),
  CONSTRAINT duty_book_events_description_len CHECK (char_length(description) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_duty_book_events_report_id
  ON public.duty_book_events (report_id);

CREATE INDEX IF NOT EXISTS idx_duty_book_events_school_id
  ON public.duty_book_events (school_id);

COMMENT ON TABLE public.duty_book_events IS
  'Duty book events for a daily report; recorded_by_id is required for new rows (enforced in app).';
COMMENT ON COLUMN public.duty_book_events.recorded_by_id IS
  'Teacher on duty (or editor) who recorded this event. NULL only for legacy backfill gaps.';

DROP TRIGGER IF EXISTS duty_book_events_updated_at ON public.duty_book_events;
CREATE TRIGGER duty_book_events_updated_at
  BEFORE UPDATE ON public.duty_book_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Migrate existing JSONB events into duty_book_events
INSERT INTO public.duty_book_events (
  id,
  report_id,
  school_id,
  event_time,
  event_type,
  description,
  recorded_by_id
)
SELECT
  COALESCE(
    NULLIF(trim(elem->>'id'), '')::uuid,
    gen_random_uuid()
  ),
  r.id,
  r.school_id,
  trim(elem->>'time'),
  trim(elem->>'type'),
  trim(elem->>'description'),
  COALESCE(
    NULLIF(trim(elem->>'recorded_by_id'), '')::uuid,
    (
      SELECT tda.teacher_id
      FROM public.teacher_duty_assignments tda
      WHERE tda.school_id = r.school_id
        AND r.report_date BETWEEN tda.start_date AND tda.end_date
        AND tda.is_active = true
        AND tda.revoked_at IS NULL
      ORDER BY tda.start_date
      LIMIT 1
    ),
    r.created_by
  )
FROM public.duty_book_reports r
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(r.events) = 'array' THEN r.events
    ELSE '[]'::jsonb
  END
) AS elem
WHERE jsonb_array_length(
  CASE
    WHEN jsonb_typeof(r.events) = 'array' THEN r.events
    ELSE '[]'::jsonb
  END
) > 0
  AND trim(elem->>'time') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND trim(elem->>'type') IN ('incident', 'guest', 'announcement', 'other')
  AND char_length(trim(elem->>'description')) > 0
ON CONFLICT (id) DO NOTHING;

-- Clear migrated JSONB (table is source of truth)
UPDATE public.duty_book_reports r
SET events = '[]'::jsonb
WHERE EXISTS (
  SELECT 1 FROM public.duty_book_events e WHERE e.report_id = r.id
);

COMMENT ON COLUMN public.duty_book_reports.events IS
  'Deprecated: events are stored in duty_book_events. Kept for backward compatibility.';

-- Backfill remarks last editor
UPDATE public.duty_book_reports
SET remarks_last_modified_by_id = created_by
WHERE remarks IS NOT NULL
  AND trim(remarks) <> ''
  AND remarks_last_modified_by_id IS NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.duty_book_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duty_book_events_select" ON public.duty_book_events;
CREATE POLICY "duty_book_events_select"
  ON public.duty_book_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.duty_book_reports r
      WHERE r.id = report_id
        AND public.can_view_duty_book(r.school_id)
    )
  );

DROP POLICY IF EXISTS "duty_book_events_insert" ON public.duty_book_events;
CREATE POLICY "duty_book_events_insert"
  ON public.duty_book_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    recorded_by_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.duty_book_reports r
      WHERE r.id = report_id
        AND r.signed_at IS NULL
        AND public.can_view_duty_book(r.school_id)
        AND (
          public.is_school_admin(r.school_id)
          OR public.is_school_head_teacher(r.school_id)
          OR public.is_teacher_on_duty(r.school_id, auth.uid(), r.report_date)
        )
    )
  );

DROP POLICY IF EXISTS "duty_book_events_update" ON public.duty_book_events;
CREATE POLICY "duty_book_events_update"
  ON public.duty_book_events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.duty_book_reports r
      WHERE r.id = report_id
        AND r.signed_at IS NULL
        AND public.can_view_duty_book(r.school_id)
        AND (
          public.is_school_admin(r.school_id)
          OR public.is_school_head_teacher(r.school_id)
          OR public.is_teacher_on_duty(r.school_id, auth.uid(), r.report_date)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.duty_book_reports r
      WHERE r.id = report_id
        AND r.signed_at IS NULL
        AND public.can_view_duty_book(r.school_id)
        AND (
          public.is_school_admin(r.school_id)
          OR public.is_school_head_teacher(r.school_id)
          OR public.is_teacher_on_duty(r.school_id, auth.uid(), r.report_date)
        )
    )
  );

DROP POLICY IF EXISTS "duty_book_events_delete" ON public.duty_book_events;
CREATE POLICY "duty_book_events_delete"
  ON public.duty_book_events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.duty_book_reports r
      WHERE r.id = report_id
        AND r.signed_at IS NULL
        AND public.can_view_duty_book(r.school_id)
        AND (
          public.is_school_admin(r.school_id)
          OR public.is_school_head_teacher(r.school_id)
          OR public.is_teacher_on_duty(r.school_id, auth.uid(), r.report_date)
        )
    )
  );

DROP POLICY IF EXISTS "duty_book_events_super_admin" ON public.duty_book_events;
CREATE POLICY "duty_book_events_super_admin"
  ON public.duty_book_events
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.duty_book_events TO authenticated;
GRANT ALL ON TABLE public.duty_book_events TO service_role;
