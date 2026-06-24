-- Persist synonyms as a first-class field on AI knowledge entries.

ALTER TABLE public.ai_knowledge_entries
  ADD COLUMN IF NOT EXISTS synonyms text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.ai_knowledge_entries.synonyms IS
  'Alternate terms and phrasing for matching user questions (same semantics as keywords arrays).';
