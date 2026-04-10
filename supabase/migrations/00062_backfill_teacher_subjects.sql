-- Populate teacher_subjects from existing class assignments that reference a subject.
INSERT INTO public.teacher_subjects (teacher_id, subject_id)
SELECT DISTINCT teacher_id, subject_id
FROM public.teacher_assignments
WHERE subject_id IS NOT NULL
ON CONFLICT (teacher_id, subject_id) DO NOTHING;
