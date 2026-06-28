-- Knowledge Approval Queue: draft lessons awaiting super-admin review before publish

CREATE TABLE IF NOT EXISTS public.ai_knowledge_approval_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_question text NOT NULL,
  proposed_answer text NOT NULL,
  proposed_category text NOT NULL DEFAULT 'General',
  proposed_priority text NOT NULL DEFAULT 'normal'
    CHECK (proposed_priority IN ('low', 'normal', 'high', 'critical')),
  proposed_keywords text[] NOT NULL DEFAULT '{}',
  proposed_synonyms text[] NOT NULL DEFAULT '{}',
  proposed_search_phrases text[] NOT NULL DEFAULT '{}',
  proposed_alternative_wording text[] NOT NULL DEFAULT '{}',
  proposed_related_terms text[] NOT NULL DEFAULT '{}',
  proposed_intent_key text,
  proposed_intent_name text,
  proposed_intent_group text,
  proposed_curriculum_module text,
  source_type text NOT NULL DEFAULT 'ai_lesson_generator'
    CHECK (source_type IN ('ai_lesson_generator', 'manual', 'import', 'other')),
  source_metadata jsonb NOT NULL DEFAULT '{}',
  quality_score integer NOT NULL DEFAULT 0
    CHECK (quality_score >= 0 AND quality_score <= 100),
  duplicate_risk text NOT NULL DEFAULT 'none'
    CHECK (duplicate_risk IN ('none', 'low', 'medium', 'high')),
  coverage_score integer NOT NULL DEFAULT 0
    CHECK (coverage_score >= 0 AND coverage_score <= 100),
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'edited', 'published')),
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_approval_queue_status_idx
  ON public.ai_knowledge_approval_queue (approval_status);

CREATE INDEX IF NOT EXISTS ai_knowledge_approval_queue_module_idx
  ON public.ai_knowledge_approval_queue (proposed_curriculum_module);

CREATE INDEX IF NOT EXISTS ai_knowledge_approval_queue_created_at_idx
  ON public.ai_knowledge_approval_queue (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_knowledge_approval_queue_source_type_idx
  ON public.ai_knowledge_approval_queue (source_type);

DROP TRIGGER IF EXISTS ai_knowledge_approval_queue_updated_at ON public.ai_knowledge_approval_queue;
CREATE TRIGGER ai_knowledge_approval_queue_updated_at
  BEFORE UPDATE ON public.ai_knowledge_approval_queue
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.ai_knowledge_approval_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_knowledge_approval_queue_super_admin_all ON public.ai_knowledge_approval_queue;
CREATE POLICY ai_knowledge_approval_queue_super_admin_all
  ON public.ai_knowledge_approval_queue
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_knowledge_approval_queue TO authenticated;
GRANT ALL ON TABLE public.ai_knowledge_approval_queue TO service_role;
