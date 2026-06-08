-- Phase 1: Align subject_classes so all sibling streams under the same form
-- parent share the union of subjects offered on any stream in that cluster.
--
-- Does NOT touch student_subject_enrollment, teacher_assignments, marks,
-- attendance, or movement logic.
--
-- Strategy:
--   1. Remove erroneous subject_classes rows on parent umbrella classes
--      (parents hold no students; offerings belong on leaf streams only).
--   2. For each form cluster, insert missing (subject_id, leaf_class_id) pairs
--      so every leaf gets the union of subjects on any sibling.

-- ------------------------------------------------------------
-- Pre-check (informational): clusters with mismatched subject counts
-- ------------------------------------------------------------
DO $$
DECLARE
  v_mismatched_clusters integer;
BEGIN
  WITH cluster_leaves AS (
    SELECT parent_class_id AS root_id, id AS leaf_id
    FROM public.classes
    WHERE parent_class_id IS NOT NULL
  ),
  leaf_counts AS (
    SELECT
      cl.root_id,
      cl.leaf_id,
      COUNT(DISTINCT sc.subject_id) AS subject_count
    FROM cluster_leaves AS cl
    LEFT JOIN public.subject_classes AS sc ON sc.class_id = cl.leaf_id
    GROUP BY cl.root_id, cl.leaf_id
  ),
  mismatched_roots AS (
    SELECT root_id
    FROM leaf_counts
    GROUP BY root_id
    HAVING COUNT(DISTINCT subject_count) > 1
  )
  SELECT COUNT(*)::integer INTO v_mismatched_clusters FROM mismatched_roots;

  RAISE NOTICE
    'subject_classes sibling alignment (pre-check): % form cluster(s) with mismatched offerings',
    v_mismatched_clusters;
END $$;

-- ------------------------------------------------------------
-- 1. Remove subject_classes on parent umbrella classes
-- ------------------------------------------------------------
DELETE FROM public.subject_classes AS sc
WHERE EXISTS (
  SELECT 1
  FROM public.classes AS child
  WHERE child.parent_class_id = sc.class_id
);

-- ------------------------------------------------------------
-- 2. Union-add missing sibling subject_classes (leaf streams only)
-- ------------------------------------------------------------
INSERT INTO public.subject_classes (subject_id, class_id)
SELECT DISTINCT csu.subject_id, cl.leaf_id
FROM (
  SELECT cl.root_id, sc.subject_id
  FROM (
    SELECT parent_class_id AS root_id, id AS leaf_id
    FROM public.classes
    WHERE parent_class_id IS NOT NULL
  ) AS cl
  INNER JOIN public.subject_classes AS sc ON sc.class_id = cl.leaf_id
) AS csu
INNER JOIN (
  SELECT parent_class_id AS root_id, id AS leaf_id
  FROM public.classes
  WHERE parent_class_id IS NOT NULL
) AS cl ON cl.root_id = csu.root_id
ON CONFLICT (subject_id, class_id) DO NOTHING;

-- ------------------------------------------------------------
-- Post-check: warn if any cluster still has mismatched subject counts
-- ------------------------------------------------------------
DO $$
DECLARE
  v_remaining integer;
BEGIN
  WITH cluster_leaves AS (
    SELECT parent_class_id AS root_id, id AS leaf_id
    FROM public.classes
    WHERE parent_class_id IS NOT NULL
  ),
  leaf_counts AS (
    SELECT
      cl.root_id,
      cl.leaf_id,
      COUNT(DISTINCT sc.subject_id) AS subject_count
    FROM cluster_leaves AS cl
    LEFT JOIN public.subject_classes AS sc ON sc.class_id = cl.leaf_id
    GROUP BY cl.root_id, cl.leaf_id
  ),
  mismatched_roots AS (
    SELECT root_id
    FROM leaf_counts
    GROUP BY root_id
    HAVING COUNT(DISTINCT subject_count) > 1
  )
  SELECT COUNT(*)::integer INTO v_remaining FROM mismatched_roots;

  IF v_remaining > 0 THEN
    RAISE WARNING
      'subject_classes sibling alignment (post-check): % form cluster(s) still mismatched — review manually',
      v_remaining;
  ELSE
    RAISE NOTICE
      'subject_classes sibling alignment (post-check): all form clusters have identical offerings per leaf stream';
  END IF;
END $$;
