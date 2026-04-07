-- Custom teacher invitations (token + accept-invite page; no Supabase invite email).

CREATE TABLE public.teacher_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT '',
  academic_year text NOT NULL DEFAULT '',
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX idx_teacher_invitations_school ON public.teacher_invitations (school_id);
CREATE INDEX idx_teacher_invitations_email ON public.teacher_invitations (email);

CREATE TRIGGER teacher_invitations_updated_at
  BEFORE UPDATE ON public.teacher_invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_invitations ENABLE ROW LEVEL SECURITY;

-- No client policies: server uses service role for inserts/reads/updates.
