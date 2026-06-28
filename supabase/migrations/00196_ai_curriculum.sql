-- Knowledge Curriculum: module targets and global knowledge goal

CREATE TABLE IF NOT EXISTS public.ai_curriculum_settings (
  id text PRIMARY KEY DEFAULT 'default',
  knowledge_target integer NOT NULL DEFAULT 2500
    CHECK (knowledge_target > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

INSERT INTO public.ai_curriculum_settings (id, knowledge_target)
VALUES ('default', 2500)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ai_curriculum_module_targets (
  module_id text PRIMARY KEY,
  target_lessons integer NOT NULL CHECK (target_lessons > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_knowledge_entries
  ADD COLUMN IF NOT EXISTS curriculum_module text;

CREATE INDEX IF NOT EXISTS ai_knowledge_entries_curriculum_module_idx
  ON public.ai_knowledge_entries (curriculum_module);

-- Default module targets (18 curriculum modules)
INSERT INTO public.ai_curriculum_module_targets (module_id, target_lessons) VALUES
  ('about-adakaro', 80),
  ('pricing', 60),
  ('getting-started', 90),
  ('student-management', 140),
  ('admissions', 100),
  ('classes-streams', 120),
  ('teachers-staff', 110),
  ('attendance', 100),
  ('report-cards', 130),
  ('finance', 120),
  ('parent-portal', 110),
  ('communication', 80),
  ('curriculum-syllabus', 90),
  ('promotions', 80),
  ('student-streaming', 70),
  ('security-roles', 90),
  ('ai-copilot', 80),
  ('troubleshooting', 100)
ON CONFLICT (module_id) DO NOTHING;

DROP TRIGGER IF EXISTS ai_curriculum_module_targets_updated_at ON public.ai_curriculum_module_targets;
CREATE TRIGGER ai_curriculum_module_targets_updated_at
  BEFORE UPDATE ON public.ai_curriculum_module_targets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS ai_curriculum_settings_updated_at ON public.ai_curriculum_settings;
CREATE TRIGGER ai_curriculum_settings_updated_at
  BEFORE UPDATE ON public.ai_curriculum_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.ai_curriculum_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_curriculum_module_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_curriculum_settings_super_admin_all ON public.ai_curriculum_settings;
CREATE POLICY ai_curriculum_settings_super_admin_all
  ON public.ai_curriculum_settings
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS ai_curriculum_module_targets_super_admin_all ON public.ai_curriculum_module_targets;
CREATE POLICY ai_curriculum_module_targets_super_admin_all
  ON public.ai_curriculum_module_targets
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_curriculum_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_curriculum_module_targets TO authenticated;
GRANT ALL ON TABLE public.ai_curriculum_settings TO service_role;
GRANT ALL ON TABLE public.ai_curriculum_module_targets TO service_role;
