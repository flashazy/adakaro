-- Enterprise Knowledge Intelligence layer (additive — preserves existing schema)
-- AI organizational memory + intelligence snapshots

CREATE TABLE IF NOT EXISTS ai_knowledge_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  memory_key text NOT NULL,
  memory_value text NOT NULL,
  confidence integer NOT NULL DEFAULT 80 CHECK (confidence >= 0 AND confidence <= 100),
  source text NOT NULL DEFAULT 'system',
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, memory_key)
);

CREATE TABLE IF NOT EXISTS ai_knowledge_intelligence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_health integer NOT NULL DEFAULT 0,
  coverage integer NOT NULL DEFAULT 0,
  confidence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_memory_category ON ai_knowledge_memory (category);
CREATE INDEX IF NOT EXISTS idx_ai_intelligence_snapshots_created ON ai_knowledge_intelligence_snapshots (created_at DESC);

ALTER TABLE ai_knowledge_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_intelligence_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_knowledge_memory_super_admin ON ai_knowledge_memory
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY ai_intelligence_snapshots_super_admin ON ai_knowledge_intelligence_snapshots
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE TRIGGER ai_knowledge_memory_updated_at
  BEFORE UPDATE ON ai_knowledge_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default organizational memory
INSERT INTO ai_knowledge_memory (category, memory_key, memory_value, confidence, source)
VALUES
  ('brand_language', 'product_name', 'Always refer to the product as Adakaro (capital A).', 99, 'brand_guidelines'),
  ('terminology', 'school_administrator', 'Use school administrator or school owner — not admin user.', 95, 'reviewer_preference'),
  ('writing_style', 'tone', 'Professional consultant tone — direct, helpful, never robotic.', 92, 'knowledge_writing_standard'),
  ('feature_naming', 'parent_portal', 'Parent Portal — capitalize both words.', 98, 'product_terminology')
ON CONFLICT (category, memory_key) DO NOTHING;
