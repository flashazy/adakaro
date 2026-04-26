-- Paged, filtered list of a student's payments (student profile → Finance)
-- for server-side search, date range in school IANA zone, and pagination.

CREATE OR REPLACE FUNCTION public.profile_payments_list_page(
  p_student_id uuid,
  p_q text,
  p_from date,
  p_to date,
  p_school_timezone text,
  p_limit int,
  p_offset int
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tz text;
  v_q text;
  v_limit int;
  v_offset int;
  v_total bigint;
  v_rows jsonb;
BEGIN
  v_tz := nullif(trim(coalesce(p_school_timezone, '')), '');
  IF v_tz IS NULL OR v_tz = '' THEN
    v_tz := 'Africa/Dar_es_Salaam';
  END IF;

  v_q := nullif(trim(coalesce(p_q, '')), '');
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 10), 200));
  v_offset := GREATEST(0, COALESCE(p_offset, 0));

  SELECT count(*)::bigint
  INTO v_total
  FROM public.payments p
  LEFT JOIN public.profiles pr ON pr.id = p.recorded_by_id
  WHERE p.student_id = p_student_id
    AND (p_from IS NULL
      OR (p.recorded_at AT TIME ZONE v_tz)::date >= p_from)
    AND (p_to IS NULL
      OR (p.recorded_at AT TIME ZONE v_tz)::date <= p_to)
    AND (
      v_q IS NULL
      OR (
        (p.reference_number IS NOT NULL
          AND p.reference_number ILIKE ('%' || v_q || '%'))
        OR p.amount::text ILIKE ('%' || v_q || '%')
        OR (pr.full_name IS NOT NULL AND pr.full_name ILIKE ('%' || v_q || '%'))
        OR (pr.role IS NOT NULL
          AND pr.role::text ILIKE ('%' || v_q || '%'))
      )
    );

  WITH page_rows AS (
    SELECT
      p.id,
      p.amount,
      p.reference_number,
      p.recorded_at,
      p.recorded_by_id,
      r.receipt_number,
      pr.full_name AS recorder_full_name,
      pr.role::text AS recorder_role
    FROM public.payments p
    LEFT JOIN public.profiles pr ON pr.id = p.recorded_by_id
    LEFT JOIN LATERAL (
      SELECT r.receipt_number
      FROM public.receipts r
      WHERE r.payment_id = p.id
      LIMIT 1
    ) r ON true
    WHERE p.student_id = p_student_id
      AND (p_from IS NULL
        OR (p.recorded_at AT TIME ZONE v_tz)::date >= p_from)
      AND (p_to IS NULL
        OR (p.recorded_at AT TIME ZONE v_tz)::date <= p_to)
      AND (
        v_q IS NULL
        OR (
          (p.reference_number IS NOT NULL
            AND p.reference_number ILIKE ('%' || v_q || '%'))
          OR p.amount::text ILIKE ('%' || v_q || '%')
          OR (pr.full_name IS NOT NULL
            AND pr.full_name ILIKE ('%' || v_q || '%'))
          OR (pr.role IS NOT NULL
            AND pr.role::text ILIKE ('%' || v_q || '%'))
        )
      )
    ORDER BY p.recorded_at DESC
    LIMIT v_limit
    OFFSET v_offset
  )
  SELECT coalesce((
    SELECT jsonb_agg(to_jsonb(s) ORDER BY s.recorded_at DESC)
    FROM page_rows s
  ), '[]'::jsonb)
  INTO v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', coalesce(v_rows, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.profile_payments_list_page(
  uuid, text, date, date, text, int, int
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.profile_payments_list_page(
  uuid, text, date, date, text, int, int
) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_payments_student_id_recorded_at
  ON public.payments (student_id, recorded_at DESC);
