-- Knowledge versioning, duplicate control, and primary entry selection

ALTER TABLE public.ai_knowledge_entries
  ADD COLUMN IF NOT EXISTS normalized_question text,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS root_entry_id uuid REFERENCES public.ai_knowledge_entries (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.ai_knowledge_entries (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'needs_review'
    CHECK (health_status IN ('healthy', 'needs_review'));

CREATE INDEX IF NOT EXISTS ai_knowledge_entries_normalized_question_idx
  ON public.ai_knowledge_entries (normalized_question)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS ai_knowledge_entries_primary_intent_idx
  ON public.ai_knowledge_entries (intent_key, is_primary)
  WHERE status = 'active' AND intent_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_knowledge_entries_root_entry_idx
  ON public.ai_knowledge_entries (root_entry_id)
  WHERE root_entry_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ai_knowledge_entry_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_entry_id uuid NOT NULL
    REFERENCES public.ai_knowledge_entries (id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  search_phrases text[] NOT NULL DEFAULT '{}',
  alternative_wording text[] NOT NULL DEFAULT '{}',
  synonyms text[] NOT NULL DEFAULT '{}',
  related_terms text[] NOT NULL DEFAULT '{}',
  intent_key text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (knowledge_entry_id, version_number)
);

CREATE INDEX IF NOT EXISTS ai_knowledge_entry_versions_entry_idx
  ON public.ai_knowledge_entry_versions (knowledge_entry_id, version_number DESC);

CREATE TABLE IF NOT EXISTS public.ai_intent_primary_entries (
  intent_key text PRIMARY KEY,
  primary_entry_id uuid NOT NULL
    REFERENCES public.ai_knowledge_entries (id) ON DELETE CASCADE,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill normalized_question for existing rows
UPDATE public.ai_knowledge_entries
SET normalized_question = lower(
  trim(
    regexp_replace(
      regexp_replace(question, '[^\w\s]', ' ', 'g'),
      '\s+',
      ' ',
      'g'
    )
  )
)
WHERE normalized_question IS NULL OR normalized_question = '';

UPDATE public.ai_knowledge_entries
SET root_entry_id = id
WHERE root_entry_id IS NULL;

ALTER TABLE public.ai_knowledge_entry_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_intent_primary_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_knowledge_entry_versions_super_admin_all
  ON public.ai_knowledge_entry_versions;
CREATE POLICY ai_knowledge_entry_versions_super_admin_all
  ON public.ai_knowledge_entry_versions FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS ai_intent_primary_entries_super_admin_all
  ON public.ai_intent_primary_entries;
CREATE POLICY ai_intent_primary_entries_super_admin_all
  ON public.ai_intent_primary_entries FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_knowledge_entry_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_intent_primary_entries TO authenticated;
GRANT ALL ON TABLE public.ai_knowledge_entry_versions TO service_role;
GRANT ALL ON TABLE public.ai_intent_primary_entries TO service_role;
