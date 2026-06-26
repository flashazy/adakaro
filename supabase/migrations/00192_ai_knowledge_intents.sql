-- Intent fields for zero-cost Adakaro AI retrieval

ALTER TABLE public.ai_knowledge_entries
  ADD COLUMN IF NOT EXISTS intent_key text,
  ADD COLUMN IF NOT EXISTS intent_name text,
  ADD COLUMN IF NOT EXISTS intent_group text,
  ADD COLUMN IF NOT EXISTS related_intents text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS ai_knowledge_entries_intent_key_idx
  ON public.ai_knowledge_entries (intent_key)
  WHERE intent_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_knowledge_entries_intent_group_idx
  ON public.ai_knowledge_entries (intent_group)
  WHERE intent_group IS NOT NULL;

-- Richer unanswered logging for the learning loop
ALTER TABLE public.ai_unanswered_questions
  ADD COLUMN IF NOT EXISTS match_debug jsonb;
