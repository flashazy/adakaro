-- AI Training Center: knowledge entries, unanswered questions, usage logs

CREATE TABLE IF NOT EXISTS public.ai_knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  question text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  search_phrases text[] NOT NULL DEFAULT '{}',
  alternative_wording text[] NOT NULL DEFAULT '{}',
  related_terms text[] NOT NULL DEFAULT '{}',
  answer text NOT NULL,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_entries_status_idx
  ON public.ai_knowledge_entries (status);

CREATE INDEX IF NOT EXISTS ai_knowledge_entries_category_idx
  ON public.ai_knowledge_entries (category);

CREATE INDEX IF NOT EXISTS ai_knowledge_entries_usage_idx
  ON public.ai_knowledge_entries (usage_count DESC);

CREATE INDEX IF NOT EXISTS ai_knowledge_entries_last_used_idx
  ON public.ai_knowledge_entries (last_used_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.ai_unanswered_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  normalized_question text NOT NULL,
  occurrences integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'public_ai'
    CHECK (source IN ('public_ai', 'copilot', 'whatsapp', 'website', 'demo', 'support', 'other')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'answered', 'ignored', 'archived')),
  linked_knowledge_entry_id uuid REFERENCES public.ai_knowledge_entries (id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_unanswered_questions_normalized_source_idx
  ON public.ai_unanswered_questions (normalized_question, source);

CREATE INDEX IF NOT EXISTS ai_unanswered_questions_status_idx
  ON public.ai_unanswered_questions (status);

CREATE INDEX IF NOT EXISTS ai_unanswered_questions_last_seen_idx
  ON public.ai_unanswered_questions (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_knowledge_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_entry_id uuid NOT NULL REFERENCES public.ai_knowledge_entries (id) ON DELETE CASCADE,
  query_text text NOT NULL,
  match_score numeric(5, 4) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'public_ai',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_usage_logs_entry_idx
  ON public.ai_knowledge_usage_logs (knowledge_entry_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_knowledge_usage_logs_created_idx
  ON public.ai_knowledge_usage_logs (created_at DESC);

-- updated_at triggers
DROP TRIGGER IF EXISTS ai_knowledge_entries_updated_at ON public.ai_knowledge_entries;
CREATE TRIGGER ai_knowledge_entries_updated_at
  BEFORE UPDATE ON public.ai_knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS ai_unanswered_questions_updated_at ON public.ai_unanswered_questions;
CREATE TRIGGER ai_unanswered_questions_updated_at
  BEFORE UPDATE ON public.ai_unanswered_questions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.ai_knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_unanswered_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_knowledge_entries_super_admin_all ON public.ai_knowledge_entries;
CREATE POLICY ai_knowledge_entries_super_admin_all
  ON public.ai_knowledge_entries
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS ai_unanswered_questions_super_admin_all ON public.ai_unanswered_questions;
CREATE POLICY ai_unanswered_questions_super_admin_all
  ON public.ai_unanswered_questions
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS ai_knowledge_usage_logs_super_admin_select ON public.ai_knowledge_usage_logs;
CREATE POLICY ai_knowledge_usage_logs_super_admin_select
  ON public.ai_knowledge_usage_logs
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Service role inserts usage logs from server; no authenticated insert policy needed.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_knowledge_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_unanswered_questions TO authenticated;
GRANT SELECT ON TABLE public.ai_knowledge_usage_logs TO authenticated;

GRANT ALL ON TABLE public.ai_knowledge_entries TO service_role;
GRANT ALL ON TABLE public.ai_unanswered_questions TO service_role;
GRANT ALL ON TABLE public.ai_knowledge_usage_logs TO service_role;
