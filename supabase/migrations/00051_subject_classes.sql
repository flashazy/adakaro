-- Subject ↔ class mapping (which subjects can be taught in which classes).

CREATE TABLE IF NOT EXISTS public.subject_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_classes_subject ON public.subject_classes (subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_class ON public.subject_classes (class_id);

ALTER TABLE public.subject_classes ENABLE ROW LEVEL SECURITY;

-- Read: anyone who can read the parent subject’s school scope.
CREATE POLICY "subject_classes_select"
  ON public.subject_classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_classes.subject_id
        AND (
          public.is_school_admin(s.school_id)
          OR public.is_teacher_for_school(s.school_id)
          OR public.is_super_admin()
        )
    )
  );

-- Write: school admins / super admins; class must belong to same school as subject.
CREATE POLICY "subject_classes_insert_admin"
  ON public.subject_classes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subjects s
      INNER JOIN public.classes c ON c.id = subject_classes.class_id AND c.school_id = s.school_id
      WHERE s.id = subject_classes.subject_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

CREATE POLICY "subject_classes_update_admin"
  ON public.subject_classes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_classes.subject_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subjects s
      INNER JOIN public.classes c ON c.id = subject_classes.class_id AND c.school_id = s.school_id
      WHERE s.id = subject_classes.subject_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

CREATE POLICY "subject_classes_delete_admin"
  ON public.subject_classes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_classes.subject_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );
