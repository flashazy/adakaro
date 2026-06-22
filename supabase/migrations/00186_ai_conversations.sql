-- Adakaro AI: conversation history for public assistant and authenticated copilot.

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  product text NOT NULL CHECK (product IN ('public', 'copilot')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  anonymous_session_id text,
  title text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_product_idx
  ON public.ai_conversations (user_id, product, updated_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_conversations_anon_session_idx
  ON public.ai_conversations (anonymous_session_id, product, updated_at DESC)
  WHERE anonymous_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_conversations_school_idx
  ON public.ai_conversations (school_id, updated_at DESC)
  WHERE school_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_idx
  ON public.ai_messages (conversation_id, created_at ASC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- Copilot: authenticated users access their own school-scoped conversations.
DROP POLICY IF EXISTS "ai_conversations_copilot_select" ON public.ai_conversations;
CREATE POLICY "ai_conversations_copilot_select"
  ON public.ai_conversations FOR SELECT
  TO authenticated
  USING (
    product = 'copilot'
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "ai_conversations_copilot_insert" ON public.ai_conversations;
CREATE POLICY "ai_conversations_copilot_insert"
  ON public.ai_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    product = 'copilot'
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "ai_conversations_copilot_update" ON public.ai_conversations;
CREATE POLICY "ai_conversations_copilot_update"
  ON public.ai_conversations FOR UPDATE
  TO authenticated
  USING (product = 'copilot' AND user_id = auth.uid())
  WITH CHECK (product = 'copilot' AND user_id = auth.uid());

-- Public assistant: anon + authenticated may insert/read via session id in metadata.
DROP POLICY IF EXISTS "ai_conversations_public_select" ON public.ai_conversations;
CREATE POLICY "ai_conversations_public_select"
  ON public.ai_conversations FOR SELECT
  TO anon, authenticated
  USING (product = 'public');

DROP POLICY IF EXISTS "ai_conversations_public_insert" ON public.ai_conversations;
CREATE POLICY "ai_conversations_public_insert"
  ON public.ai_conversations FOR INSERT
  TO anon, authenticated
  WITH CHECK (product = 'public');

DROP POLICY IF EXISTS "ai_conversations_public_update" ON public.ai_conversations;
CREATE POLICY "ai_conversations_public_update"
  ON public.ai_conversations FOR UPDATE
  TO anon, authenticated
  USING (product = 'public')
  WITH CHECK (product = 'public');

-- Messages: readable when parent conversation is accessible.
DROP POLICY IF EXISTS "ai_messages_select" ON public.ai_messages;
CREATE POLICY "ai_messages_select"
  ON public.ai_messages FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND (
          (c.product = 'public')
          OR (c.product = 'copilot' AND c.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "ai_messages_insert" ON public.ai_messages;
CREATE POLICY "ai_messages_insert"
  ON public.ai_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND (
          (c.product = 'public')
          OR (c.product = 'copilot' AND c.user_id = auth.uid())
        )
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.ai_conversations TO anon, authenticated;
GRANT SELECT, INSERT ON public.ai_messages TO anon, authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
GRANT ALL ON public.ai_messages TO service_role;

CREATE OR REPLACE FUNCTION public.touch_ai_conversation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.ai_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_messages_touch_conversation ON public.ai_messages;
CREATE TRIGGER ai_messages_touch_conversation
  AFTER INSERT ON public.ai_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_ai_conversation_updated_at();

COMMENT ON TABLE public.ai_conversations IS
  'Adakaro AI / Copilot conversation sessions.';
COMMENT ON TABLE public.ai_messages IS
  'Messages within Adakaro AI conversations.';
