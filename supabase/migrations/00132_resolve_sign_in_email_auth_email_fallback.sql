-- Teacher/admin name login: use auth.users.email when profiles.email is empty
-- (profiles.email can be out of sync; web still requires profiles.email in TS).

CREATE OR REPLACE FUNCTION public.resolve_sign_in_email(p_raw text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v text := trim(coalesce(p_raw, ''));
  v_esc text;
  v_norm text;
  cc_count int;
  cc_auth_email text;
  cc_is_active boolean;
  cc_expires_at timestamptz;
  st_distinct_schools int;
  st_school_id uuid;
  st_admission text;
  v_school_slug text;
  v_local text;
  parent_email text;
  name_match_emails text[];
BEGIN
  IF v = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Email or name and password are required.'
    );
  END IF;

  IF position('@' in v) > 0 THEN
    RETURN jsonb_build_object('ok', true, 'email', v);
  END IF;

  -- 1) capture_card_users (same school+username is unique; multiple rows => ambiguous schools)
  SELECT count(*) INTO cc_count
  FROM public.capture_card_users c
  WHERE lower(trim(c.username)) = lower(v);

  IF cc_count > 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'That username exists for more than one school. Open the capture card link from your school, or sign in with your email address.'
    );
  END IF;

  IF cc_count = 1 THEN
    SELECT c.auth_email, c.is_active, c.expires_at
    INTO cc_auth_email, cc_is_active, cc_expires_at
    FROM public.capture_card_users c
    WHERE lower(trim(c.username)) = lower(v)
    LIMIT 1;

    IF NOT cc_is_active THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error',
        'This capture account is turned off. Ask your school admin for help.'
      );
    END IF;

    IF cc_expires_at IS NOT NULL AND cc_expires_at <= now() THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error',
        'This capture account has expired. Ask your school admin for a new one.'
      );
    END IF;

    IF trim(coalesce(cc_auth_email, '')) = '' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error',
        'Could not resolve this capture account. Ask your school admin for help.'
      );
    END IF;

    RETURN jsonb_build_object('ok', true, 'email', trim(cc_auth_email));
  END IF;

  -- 2) Parent synthetic email from admission number (exact match, ILIKE escaped)
  v_esc := replace(replace(replace(v, '#', '##'), '%', '#%'), '_', '#_');

  SELECT count(DISTINCT s.school_id) INTO st_distinct_schools
  FROM public.students s
  WHERE s.approval_status IN ('pending', 'approved')
    AND s.admission_number IS NOT NULL
    AND trim(s.admission_number::text) <> ''
    AND s.admission_number::text ILIKE v_esc ESCAPE '#';

  IF st_distinct_schools > 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'This admission number exists in more than one school. Sign in with the email address on your account instead.'
    );
  END IF;

  IF st_distinct_schools = 1 THEN
    SELECT s.school_id, s.admission_number
    INTO st_school_id, st_admission
    FROM public.students s
    WHERE s.approval_status IN ('pending', 'approved')
      AND s.admission_number IS NOT NULL
      AND trim(s.admission_number::text) <> ''
      AND s.admission_number::text ILIKE v_esc ESCAPE '#'
    LIMIT 1;

    v_school_slug := replace(lower(st_school_id::text), '-', '');

    v_local := trim(both '-' FROM regexp_replace(
      regexp_replace(lower(trim(coalesce(st_admission, ''))), '[^a-z0-9-]', '-', 'g'),
      '-+', '-', 'g'
    ));
    v_local := left(v_local, 48);

    IF coalesce(v_school_slug, '') = '' OR coalesce(v_local, '') = '' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error',
        'Could not resolve login for this admission number. Ask your school or sign in with email.'
      );
    END IF;

    parent_email := 'parent.' || v_school_slug || '.' || v_local || '@adakaro-parent.local';
    RETURN jsonb_build_object('ok', true, 'email', parent_email);
  END IF;

  -- 3) Teacher / admin by registered full name (normalized like web TS)
  v_norm := trim(both ' ' FROM regexp_replace(lower(trim(v)), '\s+', ' ', 'g'));

  IF v_norm = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'Enter your full name exactly as your school registered it, or your email address.'
    );
  END IF;

  SELECT coalesce(
      array_agg(DISTINCT em) FILTER (WHERE em IS NOT NULL AND trim(em) <> ''),
      ARRAY[]::text[]
    )
  INTO name_match_emails
  FROM (
    SELECT trim(
      coalesce(
        nullif(trim(coalesce(p.email, '')), ''),
        nullif(trim(coalesce(u.email, '')), '')
      )
    ) AS em
    FROM public.profiles p
    INNER JOIN auth.users u ON u.id = p.id
    WHERE p.role IN ('teacher'::public.user_role, 'admin'::public.user_role)
      AND trim(both ' ' FROM regexp_replace(lower(trim(coalesce(p.full_name, ''))), '\s+', ' ', 'g')) = v_norm
  ) matched;

  IF array_length(name_match_emails, 1) IS NULL OR array_length(name_match_emails, 1) = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'No school account matches that name. Check spelling or sign in with email.'
    );
  END IF;

  IF array_length(name_match_emails, 1) > 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'More than one account matches that name. Please sign in with the email address on your account, or ask your school administrator.'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'email', name_match_emails[1]);
END;
$$;

COMMENT ON FUNCTION public.resolve_sign_in_email(text) IS
  'Maps capture username, parent admission, or teacher/admin display name to Supabase Auth email (same rules as web login server).';

REVOKE ALL ON FUNCTION public.resolve_sign_in_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_sign_in_email(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_sign_in_email(text) TO authenticated;
