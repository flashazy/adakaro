-- =============================================================================
-- Cleanup: duplicate major gradebook assignments (same class, subject, year,
-- same major exam via exam_type OR title keywords).
--
-- Quick inspect (example: June Terminal for class "Daycare"):
--
--   SELECT id, title, exam_type, academic_year, created_at
--   FROM public.teacher_gradebook_assignments
--   WHERE title ILIKE '%June Terminal%'
--     AND class_id = (SELECT id FROM public.classes WHERE name = 'Daycare' LIMIT 1);
--
-- Same query with score counts (which row is "empty"):
--
--   SELECT
--     g.id,
--     g.title,
--     g.exam_type,
--     g.academic_year,
--     g.created_at,
--     (
--       SELECT COUNT(*)::int
--       FROM public.teacher_scores ts
--       WHERE ts.assignment_id = g.id
--         AND (
--           ts.score IS NOT NULL
--           OR nullif(trim(both from coalesce(ts.comments, '')), '') IS NOT NULL
--           OR nullif(trim(both from coalesce(ts.remarks, '')), '') IS NOT NULL
--         )
--     ) AS filled_score_rows
--   FROM public.teacher_gradebook_assignments g
--   WHERE g.title ILIKE '%June Terminal%'
--     AND g.class_id = (SELECT id FROM public.classes WHERE name = 'Daycare' LIMIT 1);
--
-- Keeps one row per (class_id, subject, academic_year, major_key): prefer the
-- assignment with the most "filled" score rows (numeric score and/or non-empty
-- comments/remarks). Ties break on oldest created_at.
--
-- Run the PREVIEW section first in the Supabase SQL editor. Review output, then
-- run DELETE inside a transaction and COMMIT when satisfied.
--
-- Related teacher_scores rows for deleted assignments are removed by ON DELETE
-- CASCADE (empty duplicates typically have no rows or only blank rows).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- OPTIONAL: Inspect duplicates for one class (e.g. "Daycare") — adjust name.
-- Same idea as filtering by title ILIKE '%June Terminal%'.
-- -----------------------------------------------------------------------------
-- SELECT
--   g.id,
--   g.title,
--   g.exam_type,
--   g.academic_year,
--   g.created_at,
--   c.name AS class_name,
--   (
--     SELECT COUNT(*)::int
--     FROM public.teacher_scores ts
--     WHERE ts.assignment_id = g.id
--       AND (
--         ts.score IS NOT NULL
--         OR nullif(trim(both from coalesce(ts.comments, '')), '') IS NOT NULL
--         OR nullif(trim(both from coalesce(ts.remarks, '')), '') IS NOT NULL
--       )
--   ) AS filled_score_rows
-- FROM public.teacher_gradebook_assignments g
-- JOIN public.classes c ON c.id = g.class_id
-- WHERE c.name = 'Daycare'
--   AND lower(g.title) LIKE '%june%'
--   AND lower(g.title) LIKE '%terminal%'
-- ORDER BY g.academic_year, g.subject, g.created_at;

-- -----------------------------------------------------------------------------
-- PREVIEW: all duplicate groups and which row would be kept vs deleted
-- -----------------------------------------------------------------------------
WITH annotated AS (
  SELECT
    g.id,
    g.teacher_id,
    g.class_id,
    c.name AS class_name,
    g.subject,
    lower(trim(both from g.subject)) AS norm_subject,
    g.academic_year,
    g.title,
    g.exam_type,
    g.created_at,
    COALESCE(
      g.exam_type,
      CASE
        WHEN lower(g.title) LIKE '%september%' AND lower(g.title) LIKE '%midterm%' THEN 'September_Midterm'
        WHEN lower(g.title) LIKE '%december%' AND lower(g.title) LIKE '%annual%' THEN 'December_Annual'
        WHEN lower(g.title) LIKE '%june%' AND lower(g.title) LIKE '%terminal%' THEN 'June_Terminal'
        WHEN lower(g.title) LIKE '%april%' AND lower(g.title) LIKE '%midterm%' THEN 'April_Midterm'
        ELSE NULL
      END
    ) AS major_key,
    (
      SELECT COUNT(*)::bigint
      FROM public.teacher_scores ts
      WHERE ts.assignment_id = g.id
        AND (
          ts.score IS NOT NULL
          OR nullif(trim(both from coalesce(ts.comments, '')), '') IS NOT NULL
          OR nullif(trim(both from coalesce(ts.remarks, '')), '') IS NOT NULL
        )
    ) AS filled_score_rows
  FROM public.teacher_gradebook_assignments g
  JOIN public.classes c ON c.id = g.class_id
),
dup_groups AS (
  SELECT class_id, norm_subject, academic_year, major_key
  FROM annotated
  WHERE major_key IS NOT NULL
  GROUP BY class_id, norm_subject, academic_year, major_key
  HAVING COUNT(*) > 1
),
keepers AS (
  SELECT DISTINCT ON (a.class_id, a.norm_subject, a.academic_year, a.major_key)
    a.id AS keeper_id,
    a.class_id,
    a.norm_subject,
    a.academic_year,
    a.major_key,
    a.title AS keeper_title,
    a.filled_score_rows AS keeper_filled_rows
  FROM annotated a
  INNER JOIN dup_groups d
    ON a.class_id = d.class_id
    AND a.norm_subject = d.norm_subject
    AND a.academic_year = d.academic_year
    AND a.major_key = d.major_key
  ORDER BY
    a.class_id,
    a.norm_subject,
    a.academic_year,
    a.major_key,
    a.filled_score_rows DESC,
    a.created_at ASC
)
SELECT
  a.id,
  a.class_name,
  a.subject,
  a.academic_year,
  a.major_key,
  a.title,
  a.exam_type,
  a.filled_score_rows,
  a.created_at,
  CASE WHEN a.id = k.keeper_id THEN 'KEEP' ELSE 'DELETE' END AS action
FROM annotated a
INNER JOIN dup_groups d
  ON a.class_id = d.class_id
  AND a.norm_subject = d.norm_subject
  AND a.academic_year = d.academic_year
  AND a.major_key = d.major_key
LEFT JOIN keepers k ON k.keeper_id = a.id
ORDER BY a.class_id, a.norm_subject, a.academic_year, a.major_key, a.created_at;

-- -----------------------------------------------------------------------------
-- DELETE: run after preview (wrap in BEGIN/COMMIT or use SQL editor transaction)
-- -----------------------------------------------------------------------------
-- BEGIN;
--
-- WITH annotated AS (
--   SELECT
--     g.id,
--     g.class_id,
--     lower(trim(both from g.subject)) AS norm_subject,
--     g.academic_year,
--     COALESCE(
--       g.exam_type,
--       CASE
--         WHEN lower(g.title) LIKE '%september%' AND lower(g.title) LIKE '%midterm%' THEN 'September_Midterm'
--         WHEN lower(g.title) LIKE '%december%' AND lower(g.title) LIKE '%annual%' THEN 'December_Annual'
--         WHEN lower(g.title) LIKE '%june%' AND lower(g.title) LIKE '%terminal%' THEN 'June_Terminal'
--         WHEN lower(g.title) LIKE '%april%' AND lower(g.title) LIKE '%midterm%' THEN 'April_Midterm'
--         ELSE NULL
--       END
--     ) AS major_key,
--     (
--       SELECT COUNT(*)::bigint
--       FROM public.teacher_scores ts
--       WHERE ts.assignment_id = g.id
--         AND (
--           ts.score IS NOT NULL
--           OR nullif(trim(both from coalesce(ts.comments, '')), '') IS NOT NULL
--           OR nullif(trim(both from coalesce(ts.remarks, '')), '') IS NOT NULL
--         )
--     ) AS filled_score_rows,
--     g.created_at
--   FROM public.teacher_gradebook_assignments g
-- ),
-- dup_groups AS (
--   SELECT class_id, norm_subject, academic_year, major_key
--   FROM annotated
--   WHERE major_key IS NOT NULL
--   GROUP BY class_id, norm_subject, academic_year, major_key
--   HAVING COUNT(*) > 1
-- ),
-- keepers AS (
--   SELECT DISTINCT ON (a.class_id, a.norm_subject, a.academic_year, a.major_key)
--     a.id AS keeper_id
--   FROM annotated a
--   INNER JOIN dup_groups d
--     ON a.class_id = d.class_id
--     AND a.norm_subject = d.norm_subject
--     AND a.academic_year = d.academic_year
--     AND a.major_key = d.major_key
--   ORDER BY
--     a.class_id,
--     a.norm_subject,
--     a.academic_year,
--     a.major_key,
--     a.filled_score_rows DESC,
--     a.created_at ASC
-- ),
-- to_delete AS (
--   SELECT a.id
--   FROM annotated a
--   INNER JOIN dup_groups d
--     ON a.class_id = d.class_id
--     AND a.norm_subject = d.norm_subject
--     AND a.academic_year = d.academic_year
--     AND a.major_key = d.major_key
--   WHERE a.id NOT IN (SELECT keeper_id FROM keepers)
-- )
-- DELETE FROM public.teacher_gradebook_assignments g
-- WHERE g.id IN (SELECT id FROM to_delete);
--
-- COMMIT;
-- -- ROLLBACK;
