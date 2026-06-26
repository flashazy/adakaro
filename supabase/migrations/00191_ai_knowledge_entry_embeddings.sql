-- pgvector embeddings for AI knowledge entry semantic re-ranking

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.ai_knowledge_entry_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_entry_id uuid NOT NULL UNIQUE
    REFERENCES public.ai_knowledge_entries (id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  embedding_text text NOT NULL,
  embedding_model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_entry_embeddings_entry_idx
  ON public.ai_knowledge_entry_embeddings (knowledge_entry_id);

CREATE INDEX IF NOT EXISTS ai_knowledge_entry_embeddings_vector_idx
  ON public.ai_knowledge_entry_embeddings
  USING hnsw (embedding vector_cosine_ops);

DROP TRIGGER IF EXISTS ai_knowledge_entry_embeddings_updated_at
  ON public.ai_knowledge_entry_embeddings;
CREATE TRIGGER ai_knowledge_entry_embeddings_updated_at
  BEFORE UPDATE ON public.ai_knowledge_entry_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.ai_knowledge_entry_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_knowledge_entry_embeddings_super_admin_all
  ON public.ai_knowledge_entry_embeddings;
CREATE POLICY ai_knowledge_entry_embeddings_super_admin_all
  ON public.ai_knowledge_entry_embeddings
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_knowledge_entry_embeddings TO authenticated;
GRANT ALL ON TABLE public.ai_knowledge_entry_embeddings TO service_role;

CREATE OR REPLACE FUNCTION public.match_knowledge_embeddings(
  query_embedding vector(1536),
  match_count integer DEFAULT 10,
  similarity_threshold double precision DEFAULT 0.72
)
RETURNS TABLE (
  knowledge_entry_id uuid,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.knowledge_entry_id,
    (1 - (e.embedding <=> query_embedding))::double precision AS similarity
  FROM public.ai_knowledge_entry_embeddings e
  INNER JOIN public.ai_knowledge_entries k ON k.id = e.knowledge_entry_id
  WHERE k.status = 'active'
    AND k.category <> 'needs_review'
    AND (1 - (e.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;

REVOKE ALL ON FUNCTION public.match_knowledge_embeddings(vector, integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_knowledge_embeddings(vector, integer, double precision) TO service_role;
