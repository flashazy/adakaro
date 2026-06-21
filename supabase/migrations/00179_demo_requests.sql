-- Public demo / contact leads from the marketing Contact page.

CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  full_name text NOT NULL,
  school_name text NOT NULL,
  phone text NOT NULL,
  email text,
  school_type text,
  student_count integer,
  message text,
  status text NOT NULL DEFAULT 'New',
  source text NOT NULL DEFAULT 'contact_page',
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT demo_requests_status_check CHECK (
    status IN (
      'New',
      'Contacted',
      'Demo Scheduled',
      'Demo Completed',
      'Won',
      'Lost'
    )
  ),
  CONSTRAINT demo_requests_school_type_check CHECK (
    school_type IS NULL
    OR school_type IN (
      'Primary',
      'Secondary',
      'Primary & Secondary',
      'Other'
    )
  )
);

CREATE INDEX idx_demo_requests_status ON public.demo_requests (status);
CREATE INDEX idx_demo_requests_created_at ON public.demo_requests (created_at DESC);
CREATE INDEX idx_demo_requests_school_name ON public.demo_requests (school_name);

DROP TRIGGER IF EXISTS demo_requests_updated_at ON public.demo_requests;
CREATE TRIGGER demo_requests_updated_at
  BEFORE UPDATE ON public.demo_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Public marketing form: insert only, forced defaults.
CREATE POLICY "Public insert demo_requests"
  ON public.demo_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'New'
    AND source = 'contact_page'
  );

CREATE POLICY "Super admins select demo_requests"
  ON public.demo_requests FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super admins update demo_requests"
  ON public.demo_requests FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins delete demo_requests"
  ON public.demo_requests FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

COMMENT ON TABLE public.demo_requests IS
  'Inbound demo requests from the public Contact page. Super Admin only after insert.';

GRANT INSERT ON TABLE public.demo_requests TO anon;
GRANT SELECT, UPDATE, DELETE ON TABLE public.demo_requests TO authenticated;
GRANT ALL ON TABLE public.demo_requests TO service_role;
