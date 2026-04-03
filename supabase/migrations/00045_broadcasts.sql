-- Platform-wide broadcast messages to school admins (super admin sends; school admins read).

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  is_urgent boolean NOT NULL DEFAULT false,
  sent_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  sent_at timestamptz NOT NULL DEFAULT now(),
  target_role text NOT NULL DEFAULT 'school_admin'
    CHECK (target_role = 'school_admin'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.broadcasts IS
  'Super-admin broadcast announcements; visible to school admins per target_role.';

DROP TRIGGER IF EXISTS broadcasts_updated_at ON public.broadcasts;
CREATE TRIGGER broadcasts_updated_at
  BEFORE UPDATE ON public.broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_broadcasts_sent_at ON public.broadcasts (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_sent_by ON public.broadcasts (sent_by);

CREATE TABLE IF NOT EXISTS public.broadcast_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, user_id)
);

COMMENT ON TABLE public.broadcast_reads IS
  'Tracks which school admins have read or dismissed a broadcast.';

CREATE INDEX IF NOT EXISTS idx_broadcast_reads_user_id ON public.broadcast_reads (user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_reads_broadcast_id ON public.broadcast_reads (broadcast_id);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;

-- broadcasts: super admins — full access
CREATE POLICY "Super admins manage broadcasts"
  ON public.broadcasts
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- broadcasts: school admins — read only
CREATE POLICY "School admins select targeted broadcasts"
  ON public.broadcasts
  FOR SELECT
  TO authenticated
  USING (
    target_role = 'school_admin'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'::public.user_role
    )
    AND NOT public.is_super_admin()
  );

-- broadcast_reads: super admins — full access
CREATE POLICY "Super admins manage broadcast reads"
  ON public.broadcast_reads
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- broadcast_reads: school admins — insert own reads
CREATE POLICY "School admins insert own broadcast reads"
  ON public.broadcast_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.broadcasts b
      WHERE b.id = broadcast_id
        AND b.target_role = 'school_admin'
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'::public.user_role
    )
    AND NOT public.is_super_admin()
  );

-- broadcast_reads: school admins — select own rows
CREATE POLICY "School admins select own broadcast reads"
  ON public.broadcast_reads
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'::public.user_role
    )
    AND NOT public.is_super_admin()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_reads TO authenticated;
