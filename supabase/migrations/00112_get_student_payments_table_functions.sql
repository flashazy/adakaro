-- Set-returning payment list for the student profile Finance table (replaces jsonb flow).
-- Returns one row per payment with `recorded_by_name` / `recorded_by_role` from `profiles`.

CREATE OR REPLACE FUNCTION public.get_student_payments(
  p_student_id uuid,
  p_q text,
  p_from date,
  p_to date,
  p_school_timezone text,
  p_limit int,
  p_offset int
)
RETURNS TABLE (
  id uuid,
  amount numeric,
  recorded_at timestamptz,
  recorded_by_name text,
  recorded_by_role text,
  reference_number text,
  payment_date date,
  receipt_number text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tz text;
  v_q text;
  v_lim int;
  v_off int;
BEGIN
  v_tz := coalesce(nullif(trim(p_school_timezone), ''), 'Africa/Dar_es_Salaam');
  v_q := nullif(trim(coalesce(p_q, '')), '');
  v_lim := GREATEST(1, LEAST(COALESCE(p_limit, 10), 200));
  v_off := GREATEST(0, COALESCE(p_offset, 0));

  RETURN QUERY
  SELECT
    p.id,
    p.amount,
    p.recorded_at,
    pr.full_name::text,
    (pr.role)::text,
    p.reference_number,
    p.payment_date,
    rec.receipt_number
  FROM public.payments p
  LEFT JOIN public.profiles pr ON pr.id = p.recorded_by_id
  LEFT JOIN LATERAL (
    SELECT r0.receipt_number
    FROM public.receipts r0
    WHERE r0.payment_id = p.id
    LIMIT 1
  ) rec ON true
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
  LIMIT v_lim
  OFFSET v_off;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_payments_count(
  p_student_id uuid,
  p_q text,
  p_from date,
  p_to date,
  p_school_timezone text
) RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tz text;
  v_q text;
  v_n bigint;
BEGIN
  v_tz := coalesce(nullif(trim(p_school_timezone), ''), 'Africa/Dar_es_Salaam');
  v_q := nullif(trim(coalesce(p_q, '')), '');

  SELECT count(*)::bigint
  INTO v_n
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
        OR (pr.full_name IS NOT NULL
          AND pr.full_name ILIKE ('%' || v_q || '%'))
        OR (pr.role IS NOT NULL
          AND pr.role::text ILIKE ('%' || v_q || '%'))
      )
    );

  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_payments(
  uuid, text, date, date, text, int, int
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_payments_count(
  uuid, text, date, date, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_student_payments(
  uuid, text, date, date, text, int, int
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_payments_count(
  uuid, text, date, date, text
) TO authenticated, service_role;
