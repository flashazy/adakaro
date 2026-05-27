-- Data fix: ensure FORM ONE / FORM TWO progression ordering.
-- This is idempotent and scoped to schools that already have these classes.
--
-- Requirements:
-- - Track "Secondary" exists
-- - FORM ONE progression_order = 1
-- - FORM TWO progression_order = 2
-- - Both classes assigned to the same "Secondary" track
--
-- Note: This does NOT create missing classes (schemas differ per deployment).

WITH schools_with_forms AS (
  SELECT DISTINCT c.school_id
  FROM public.classes c
  WHERE c.name ILIKE 'form one%'
     OR c.name ILIKE 'form two%'
),
inserted AS (
  INSERT INTO public.class_progression_tracks (school_id, track_name)
  SELECT s.school_id, 'Secondary'
  FROM schools_with_forms s
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.class_progression_tracks t
    WHERE t.school_id = s.school_id
      AND t.track_name = 'Secondary'
  )
  RETURNING id, school_id
),
tracks AS (
  SELECT t.id, t.school_id
  FROM public.class_progression_tracks t
  JOIN schools_with_forms s ON s.school_id = t.school_id
  WHERE t.track_name = 'Secondary'
)
UPDATE public.classes c
SET
  track_id = tr.id,
  progression_order = CASE
    WHEN c.name ILIKE 'form one%' THEN 1
    WHEN c.name ILIKE 'form two%' THEN 2
    ELSE c.progression_order
  END
FROM tracks tr
WHERE c.school_id = tr.school_id
  AND (
    c.name ILIKE 'form one%'
    OR c.name ILIKE 'form two%'
  );

