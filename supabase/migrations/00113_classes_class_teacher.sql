-- Class teacher (form master): one designated teacher per class, assigned by school admin.

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS class_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_class_teacher_id
  ON public.classes(class_teacher_id)
  WHERE class_teacher_id IS NOT NULL;

COMMENT ON COLUMN public.classes.class_teacher_id IS
  'Profile id of the class teacher (form master). Set only by school administrators.';
