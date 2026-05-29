-- Academic department staff need read/write access to promotion configuration data
-- (tracks, rules, promotion log) matching school admins for year-end promotions.

-- class_progression_tracks
DROP POLICY IF EXISTS class_progression_tracks_select ON public.class_progression_tracks;
CREATE POLICY class_progression_tracks_select
  ON public.class_progression_tracks FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
  );

DROP POLICY IF EXISTS class_progression_tracks_insert ON public.class_progression_tracks;
CREATE POLICY class_progression_tracks_insert
  ON public.class_progression_tracks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
  );

DROP POLICY IF EXISTS class_progression_tracks_update ON public.class_progression_tracks;
CREATE POLICY class_progression_tracks_update
  ON public.class_progression_tracks FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
  );

DROP POLICY IF EXISTS class_progression_tracks_delete ON public.class_progression_tracks;
CREATE POLICY class_progression_tracks_delete
  ON public.class_progression_tracks FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
  );

-- promotion_rules (read thresholds; same visibility as admins)
DROP POLICY IF EXISTS promotion_rules_select ON public.promotion_rules;
CREATE POLICY promotion_rules_select
  ON public.promotion_rules FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
  );

-- student_promotions log
DROP POLICY IF EXISTS student_promotions_select ON public.student_promotions;
CREATE POLICY student_promotions_select
  ON public.student_promotions FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
  );

DROP POLICY IF EXISTS student_promotions_insert ON public.student_promotions;
CREATE POLICY student_promotions_insert
  ON public.student_promotions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
  );

-- Class sequence fields on classes (track + progression order)
DROP POLICY IF EXISTS "Academic department can update class progression" ON public.classes;
CREATE POLICY "Academic department can update class progression"
  ON public.classes FOR UPDATE
  TO authenticated
  USING (public.has_teacher_department_role(school_id, 'academic'))
  WITH CHECK (public.has_teacher_department_role(school_id, 'academic'));

DROP POLICY IF EXISTS "Academic department can update students for promotion" ON public.students;
CREATE POLICY "Academic department can update students for promotion"
  ON public.students FOR UPDATE
  TO authenticated
  USING (public.has_teacher_department_role(school_id, 'academic'))
  WITH CHECK (public.has_teacher_department_role(school_id, 'academic'));
