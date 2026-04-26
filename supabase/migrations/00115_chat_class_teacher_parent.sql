-- Class teacher ↔ parent messaging (polling; no attachments in v1).

CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  last_message text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_conversations_unique_triple UNIQUE (class_teacher_id, parent_id, class_id)
);

CREATE INDEX idx_chat_conversations_teacher ON public.chat_conversations(class_teacher_id);
CREATE INDEX idx_chat_conversations_parent ON public.chat_conversations(parent_id);
CREATE INDEX idx_chat_conversations_class ON public.chat_conversations(class_id);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_conversation_created
  ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_messages_unread
  ON public.chat_messages(conversation_id)
  WHERE is_read = false;

-- Keep conversation preview in sync (bypasses RLS via SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.touch_chat_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET
    last_message = left(NEW.message, 500),
    last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_chat_conversation_on_message ON public.chat_messages;
CREATE TRIGGER trg_touch_chat_conversation_on_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_chat_conversation_on_message();

-- Participant marks incoming messages read.
CREATE OR REPLACE FUNCTION public.mark_chat_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    WHERE c.id = p_conversation_id
      AND (c.parent_id = auth.uid() OR c.class_teacher_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not allowed' USING errcode = '42501';
  END IF;

  UPDATE public.chat_messages m
  SET is_read = true
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id IS DISTINCT FROM auth.uid()
    AND m.is_read = false;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_chat_conversation_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_chat_conversation_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unread_chat_message_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.chat_messages m
  INNER JOIN public.chat_conversations c ON c.id = m.conversation_id
  WHERE m.is_read = false
    AND m.sender_id IS DISTINCT FROM auth.uid()
    AND (c.parent_id = auth.uid() OR c.class_teacher_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.unread_chat_message_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unread_chat_message_count() TO authenticated;

-- Validate conversation row matches class teacher on class and parent has child in class.
-- SECURITY DEFINER: trigger reads parent_students; teachers have no SELECT RLS on that table.
CREATE OR REPLACE FUNCTION public.validate_chat_conversation_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.classes cl
    WHERE cl.id = NEW.class_id
      AND cl.class_teacher_id = NEW.class_teacher_id
  ) THEN
    RAISE EXCEPTION 'class_teacher_id must match classes.class_teacher_id for class_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.students s
    INNER JOIN public.parent_students ps
      ON ps.student_id = s.id AND ps.parent_id = NEW.parent_id
    WHERE s.class_id = NEW.class_id
      AND coalesce(s.status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'parent must be linked to an active student in this class';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_chat_conversation ON public.chat_conversations;
CREATE TRIGGER trg_validate_chat_conversation
  BEFORE INSERT OR UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_chat_conversation_row();

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_conversations_select_participant
  ON public.chat_conversations FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR class_teacher_id = auth.uid());

CREATE POLICY chat_conversations_insert_participant
  ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (
    (
      parent_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.students s
        INNER JOIN public.parent_students ps
          ON ps.student_id = s.id AND ps.parent_id = auth.uid()
        WHERE s.class_id = chat_conversations.class_id
          AND coalesce(s.status, 'active') = 'active'
      )
      AND EXISTS (
        SELECT 1 FROM public.classes cl
        WHERE cl.id = chat_conversations.class_id
          AND cl.class_teacher_id = chat_conversations.class_teacher_id
      )
    )
    OR
    (
      class_teacher_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.classes cl
        WHERE cl.id = chat_conversations.class_id
          AND cl.class_teacher_id = auth.uid()
      )
    )
  );

CREATE POLICY chat_messages_select_participant
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (c.parent_id = auth.uid() OR c.class_teacher_id = auth.uid())
    )
  );

CREATE POLICY chat_messages_insert_sender_participant
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (c.parent_id = auth.uid() OR c.class_teacher_id = auth.uid())
    )
  );

GRANT SELECT, INSERT ON public.chat_conversations TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;

GRANT ALL ON public.chat_conversations TO service_role;
GRANT ALL ON public.chat_messages TO service_role;
