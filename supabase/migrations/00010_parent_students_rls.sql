-- ============================================================
-- Allow parents to SELECT students, payments, and receipts
-- for children linked via parent_students.
--
-- Uses the parent_student_ids() helper created in 00009.
-- ============================================================

-- ── students ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Parents can view linked students" ON public.students;

CREATE POLICY "Parents can view linked students"
  ON public.students FOR SELECT
  USING (id IN (SELECT public.parent_student_ids()));

-- ── payments ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Parents can view payments for linked students" ON public.payments;

CREATE POLICY "Parents can view payments for linked students"
  ON public.payments FOR SELECT
  USING (student_id IN (SELECT public.parent_student_ids()));

-- ── receipts ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Parents can view receipts for linked students" ON public.receipts;

CREATE POLICY "Parents can view receipts for linked students"
  ON public.receipts FOR SELECT
  USING (
    payment_id IN (
      SELECT p.id FROM public.payments p
      WHERE p.student_id IN (SELECT public.parent_student_ids())
    )
  );

-- ── fee_structures (needed for payment joins) ───────────────

DROP POLICY IF EXISTS "Parents can view fee structures for linked students" ON public.fee_structures;

CREATE POLICY "Parents can view fee structures for linked students"
  ON public.fee_structures FOR SELECT
  USING (
    id IN (
      SELECT DISTINCT sfb.fee_structure_id
      FROM public.student_fee_balances sfb
      WHERE sfb.student_id IN (SELECT public.parent_student_ids())
    )
    OR class_id IN (
      SELECT s.class_id FROM public.students s
      WHERE s.id IN (SELECT public.parent_student_ids())
    )
    OR student_id IN (SELECT public.parent_student_ids())
  );

-- ── classes (needed for student class join) ─────────────────

DROP POLICY IF EXISTS "Parents can view classes for linked students" ON public.classes;

CREATE POLICY "Parents can view classes for linked students"
  ON public.classes FOR SELECT
  USING (
    id IN (
      SELECT s.class_id FROM public.students s
      WHERE s.id IN (SELECT public.parent_student_ids())
    )
  );
