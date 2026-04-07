-- Teacher role: enum value, assignments, attendance, gradebook, lessons, report comments.
-- RLS: teachers see only their school/class scope; school admins via is_school_admin(); super admins via is_super_admin().

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'teacher';

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_teacher_for_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_assignments ta
    WHERE ta.teacher_id = auth.uid() AND ta.class_id = p_class_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_for_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_assignments ta
    WHERE ta.teacher_id = auth.uid() AND ta.school_id = p_school_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher_for_class(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_for_class(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_teacher_for_school(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_for_school(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- teacher_assignments (admin-managed: which class/subject/year per teacher)
-- ---------------------------------------------------------------------------
CREATE TABLE public.teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  academic_year text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX teacher_assignments_unique_scope
  ON public.teacher_assignments (teacher_id, class_id, subject, academic_year);

CREATE INDEX idx_teacher_assignments_teacher ON public.teacher_assignments (teacher_id);
CREATE INDEX idx_teacher_assignments_school ON public.teacher_assignments (school_id);
CREATE INDEX idx_teacher_assignments_class ON public.teacher_assignments (class_id);

CREATE TRIGGER teacher_assignments_updated_at
  BEFORE UPDATE ON public.teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_assignments_select_own"
  ON public.teacher_assignments FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "teacher_assignments_admin_all"
  ON public.teacher_assignments FOR ALL
  USING (public.is_school_admin(school_id))
  WITH CHECK (public.is_school_admin(school_id));

CREATE POLICY "teacher_assignments_super_admin"
  ON public.teacher_assignments FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- teacher_attendance
-- ---------------------------------------------------------------------------
CREATE TABLE public.teacher_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date, class_id)
);

CREATE INDEX idx_teacher_attendance_teacher ON public.teacher_attendance (teacher_id);
CREATE INDEX idx_teacher_attendance_class_date ON public.teacher_attendance (class_id, attendance_date);

CREATE TRIGGER teacher_attendance_updated_at
  BEFORE UPDATE ON public.teacher_attendance
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_attendance_select"
  ON public.teacher_attendance FOR SELECT
  USING (
    auth.uid() = teacher_id
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

CREATE POLICY "teacher_attendance_insert_own"
  ON public.teacher_attendance FOR INSERT
  WITH CHECK (
    auth.uid() = teacher_id
    AND public.is_teacher_for_class(class_id)
  );

CREATE POLICY "teacher_attendance_update_own"
  ON public.teacher_attendance FOR UPDATE
  USING (
    (auth.uid() = teacher_id AND public.is_teacher_for_class(class_id))
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  )
  WITH CHECK (
    teacher_id = auth.uid()
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

CREATE POLICY "teacher_attendance_delete_own"
  ON public.teacher_attendance FOR DELETE
  USING (
    (auth.uid() = teacher_id AND public.is_teacher_for_class(class_id))
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- Gradebook: assignments + scores (table name avoids clash with teacher_assignments)
-- ---------------------------------------------------------------------------
CREATE TABLE public.teacher_gradebook_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  title text NOT NULL,
  max_score numeric(10, 2) NOT NULL CHECK (max_score > 0),
  weight numeric(5, 2) NOT NULL DEFAULT 100 CHECK (weight >= 0),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_gradebook_assignments_teacher ON public.teacher_gradebook_assignments (teacher_id);
CREATE INDEX idx_teacher_gradebook_assignments_class ON public.teacher_gradebook_assignments (class_id);

CREATE TRIGGER teacher_gradebook_assignments_updated_at
  BEFORE UPDATE ON public.teacher_gradebook_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_gradebook_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gradebook_assignments_select"
  ON public.teacher_gradebook_assignments FOR SELECT
  USING (
    auth.uid() = teacher_id
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND public.is_school_admin(c.school_id)
    )
  );

CREATE POLICY "gradebook_assignments_teacher_write"
  ON public.teacher_gradebook_assignments FOR INSERT
  WITH CHECK (auth.uid() = teacher_id AND public.is_teacher_for_class(class_id));

CREATE POLICY "gradebook_assignments_teacher_update"
  ON public.teacher_gradebook_assignments FOR UPDATE
  USING (auth.uid() = teacher_id AND public.is_teacher_for_class(class_id))
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "gradebook_assignments_teacher_delete"
  ON public.teacher_gradebook_assignments FOR DELETE
  USING (
    (auth.uid() = teacher_id AND public.is_teacher_for_class(class_id))
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND public.is_school_admin(c.school_id)
    )
  );

CREATE TABLE public.teacher_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.teacher_gradebook_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  score numeric(10, 2),
  comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX idx_teacher_scores_assignment ON public.teacher_scores (assignment_id);
CREATE INDEX idx_teacher_scores_student ON public.teacher_scores (student_id);

CREATE TRIGGER teacher_scores_updated_at
  BEFORE UPDATE ON public.teacher_scores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_scores_select"
  ON public.teacher_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_gradebook_assignments g
      JOIN public.classes c ON c.id = g.class_id
      WHERE g.id = assignment_id
        AND (
          g.teacher_id = auth.uid()
          OR public.is_school_admin(c.school_id)
          OR public.is_super_admin()
        )
    )
  );

CREATE POLICY "teacher_scores_insert"
  ON public.teacher_scores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teacher_gradebook_assignments g
      WHERE g.id = assignment_id
        AND g.teacher_id = auth.uid()
        AND public.is_teacher_for_class(g.class_id)
    )
    AND EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.teacher_gradebook_assignments g ON g.id = assignment_id
      WHERE s.id = student_id AND s.class_id = g.class_id
    )
  );

CREATE POLICY "teacher_scores_update"
  ON public.teacher_scores FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_gradebook_assignments g
      WHERE g.id = assignment_id AND g.teacher_id = auth.uid()
    )
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.teacher_gradebook_assignments g
      JOIN public.classes c ON c.id = g.class_id
      WHERE g.id = assignment_id AND public.is_school_admin(c.school_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teacher_gradebook_assignments g
      WHERE g.id = assignment_id AND g.teacher_id = auth.uid()
    )
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.teacher_gradebook_assignments g
      JOIN public.classes c ON c.id = g.class_id
      WHERE g.id = assignment_id AND public.is_school_admin(c.school_id)
    )
  );

CREATE POLICY "teacher_scores_delete"
  ON public.teacher_scores FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_gradebook_assignments g
      WHERE g.id = assignment_id AND g.teacher_id = auth.uid()
    )
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.teacher_gradebook_assignments g
      JOIN public.classes c ON c.id = g.class_id
      WHERE g.id = assignment_id AND public.is_school_admin(c.school_id)
    )
  );

-- ---------------------------------------------------------------------------
-- teacher_lessons
-- ---------------------------------------------------------------------------
CREATE TABLE public.teacher_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  lesson_date date NOT NULL,
  topic text NOT NULL DEFAULT '',
  objectives text,
  materials text,
  procedure text,
  assessment text,
  homework text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_lessons_teacher ON public.teacher_lessons (teacher_id);
CREATE INDEX idx_teacher_lessons_class_date ON public.teacher_lessons (class_id, lesson_date);

CREATE TRIGGER teacher_lessons_updated_at
  BEFORE UPDATE ON public.teacher_lessons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_lessons_select"
  ON public.teacher_lessons FOR SELECT
  USING (
    auth.uid() = teacher_id
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND public.is_school_admin(c.school_id)
    )
  );

CREATE POLICY "teacher_lessons_write_own"
  ON public.teacher_lessons FOR INSERT
  WITH CHECK (auth.uid() = teacher_id AND public.is_teacher_for_class(class_id));

CREATE POLICY "teacher_lessons_update_own"
  ON public.teacher_lessons FOR UPDATE
  USING (
    (auth.uid() = teacher_id AND public.is_teacher_for_class(class_id))
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND public.is_school_admin(c.school_id)
    )
  )
  WITH CHECK (teacher_id = auth.uid() OR public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND public.is_school_admin(c.school_id)
    ));

CREATE POLICY "teacher_lessons_delete_own"
  ON public.teacher_lessons FOR DELETE
  USING (
    (auth.uid() = teacher_id AND public.is_teacher_for_class(class_id))
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND public.is_school_admin(c.school_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Report card comments
-- ---------------------------------------------------------------------------
CREATE TABLE public.teacher_report_card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  academic_year text NOT NULL DEFAULT '',
  comment text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id, subject, academic_year)
);

CREATE INDEX idx_teacher_report_comments_teacher ON public.teacher_report_card_comments (teacher_id);
CREATE INDEX idx_teacher_report_comments_student ON public.teacher_report_card_comments (student_id);

CREATE TRIGGER teacher_report_card_comments_updated_at
  BEFORE UPDATE ON public.teacher_report_card_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_report_card_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_comments_select"
  ON public.teacher_report_card_comments FOR SELECT
  USING (
    auth.uid() = teacher_id
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

CREATE POLICY "report_comments_teacher_write"
  ON public.teacher_report_card_comments FOR INSERT
  WITH CHECK (
    auth.uid() = teacher_id
    AND public.is_teacher_for_school(school_id)
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id AND s.school_id = school_id
        AND public.is_teacher_for_class(s.class_id)
    )
  );

CREATE POLICY "report_comments_teacher_update"
  ON public.teacher_report_card_comments FOR UPDATE
  USING (
    (auth.uid() = teacher_id AND public.is_teacher_for_school(school_id))
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  )
  WITH CHECK (
    teacher_id = auth.uid()
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

CREATE POLICY "report_comments_delete"
  ON public.teacher_report_card_comments FOR DELETE
  USING (
    (auth.uid() = teacher_id)
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- Teachers can read students in assigned classes only (additive policy)
-- ---------------------------------------------------------------------------
CREATE POLICY "Teachers select students in assigned classes"
  ON public.students FOR SELECT
  USING (public.is_teacher_for_class(class_id));

-- ---------------------------------------------------------------------------
-- Teachers can read classes they are assigned to
-- ---------------------------------------------------------------------------
CREATE POLICY "Teachers select assigned classes"
  ON public.classes FOR SELECT
  USING (public.is_teacher_for_class(id));
