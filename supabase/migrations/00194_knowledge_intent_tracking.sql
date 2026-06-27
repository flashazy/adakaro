-- Intent confidence, recalculation tracking, and audit history

ALTER TABLE public.ai_knowledge_entries
  ADD COLUMN IF NOT EXISTS intent_confidence numeric(5, 4),
  ADD COLUMN IF NOT EXISTS intent_recalculated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.ai_knowledge_intent_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_entry_id uuid NOT NULL
    REFERENCES public.ai_knowledge_entries (id) ON DELETE CASCADE,
  previous_intent_key text,
  new_intent_key text,
  previous_intent_name text,
  new_intent_name text,
  reason text NOT NULL,
  changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_intent_history_entry_idx
  ON public.ai_knowledge_intent_history (knowledge_entry_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_knowledge_entries_null_intent_idx
  ON public.ai_knowledge_entries (status)
  WHERE intent_key IS NULL AND status = 'active';

ALTER TABLE public.ai_knowledge_intent_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_knowledge_intent_history_super_admin_all
  ON public.ai_knowledge_intent_history;
CREATE POLICY ai_knowledge_intent_history_super_admin_all
  ON public.ai_knowledge_intent_history FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT ON TABLE public.ai_knowledge_intent_history TO authenticated;
GRANT ALL ON TABLE public.ai_knowledge_intent_history TO service_role;
