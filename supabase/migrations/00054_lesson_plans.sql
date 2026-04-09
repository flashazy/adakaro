-- Official-style lesson plans (Tanzania format). RLS: teachers own rows only.

CREATE TABLE public.lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  lesson_date date NOT NULL,
  period integer NOT NULL CHECK (period >= 1 AND period <= 12),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  total_boys integer NOT NULL DEFAULT 0 CHECK (total_boys >= 0),
  total_girls integer NOT NULL DEFAULT 0 CHECK (total_girls >= 0),
  total_pupils integer NOT NULL DEFAULT 0 CHECK (total_pupils >= 0),
  present_count integer NOT NULL DEFAULT 0 CHECK (present_count >= 0),
  main_competence text NOT NULL DEFAULT '',
  specific_competence text NOT NULL DEFAULT '',
  teaching_activities text NOT NULL DEFAULT '',
  learning_activities text NOT NULL DEFAULT '',
  materials text NOT NULL DEFAULT '',
  reference_materials text NOT NULL DEFAULT '',
  remarks text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_plans_teacher ON public.lesson_plans (teacher_id);
CREATE INDEX idx_lesson_plans_class ON public.lesson_plans (class_id);
CREATE INDEX idx_lesson_plans_subject ON public.lesson_plans (subject_id);
CREATE INDEX idx_lesson_plans_lesson_date ON public.lesson_plans (lesson_date DESC);

CREATE TRIGGER lesson_plans_updated_at
  BEFORE UPDATE ON public.lesson_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_plans_select_own"
  ON public.lesson_plans FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "lesson_plans_insert_own"
  ON public.lesson_plans FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "lesson_plans_update_own"
  ON public.lesson_plans FOR UPDATE
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "lesson_plans_delete_own"
  ON public.lesson_plans FOR DELETE
  USING (auth.uid() = teacher_id);
