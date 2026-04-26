/**
 * Chat poll payloads for API routes (no "use server" — avoids Server Action ID
 * mismatch when the dev server restarts while the tab keeps old JS).
 */

import { createAdminClient } from "@/lib/supabase/admin";

/** Mirrors `TeacherConversationRow` in chat-server-actions (avoid importing "use server" module). */
export type PollTeacherConversationRow = {
  id: string;
  parent_id: string;
  class_id: string;
  last_message: string | null;
  last_message_at: string;
};

export type PollChatMessageRow = {
  id: string;
  message: string;
  created_at: string;
  sender_id: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- chat tables
type AdminDb = any;

function getAdmin(): AdminDb {
  return createAdminClient() as AdminDb;
}

async function assertConversationParticipant(
  admin: AdminDb,
  conversationId: string,
  userId: string
): Promise<{ ok: false; error: string } | null> {
  const { data: row, error } = await admin
    .from("chat_conversations")
    .select("parent_id, class_teacher_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !row) return { ok: false, error: "Conversation not found" };
  const r = row as { parent_id: string; class_teacher_id: string };
  if (r.parent_id !== userId && r.class_teacher_id !== userId) {
    return { ok: false, error: "Not allowed" };
  }
  return null;
}

export type TeacherInboxPollOk = {
  ok: true;
  conversations: PollTeacherConversationRow[];
  messages: PollChatMessageRow[] | null;
  unreadByConversationId: Record<string, number>;
};

export type ChatPollErr = { ok: false; error: string };

export async function runTeacherInboxPoll(
  userId: string,
  activeConversationId: string | null
): Promise<TeacherInboxPollOk | ChatPollErr> {
  let admin: AdminDb;
  try {
    admin = getAdmin();
  } catch {
    return { ok: false, error: "Server configuration error." };
  }

  const { data: convRows, error: cErr } = await admin
    .from("chat_conversations")
    .select("id, parent_id, class_id, last_message, last_message_at")
    .eq("class_teacher_id", userId);
  if (cErr) return { ok: false, error: cErr.message };
  const conversations = (convRows ?? []) as PollTeacherConversationRow[];
  const ids = conversations.map((c) => c.id);

  let messages: PollChatMessageRow[] | null = null;
  if (
    activeConversationId &&
    ids.includes(activeConversationId)
  ) {
    const denied = await assertConversationParticipant(
      admin,
      activeConversationId,
      userId
    );
    if (denied) {
      messages = null;
    } else {
      const { data: msgRows, error: mErr } = await admin
        .from("chat_messages")
        .select("id, message, created_at, sender_id")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });
      if (mErr) return { ok: false, error: mErr.message };
      messages = (msgRows ?? []) as PollChatMessageRow[];
    }
  }

  const unreadByConversationId: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: allowedRows, error: aErr } = await admin
      .from("chat_conversations")
      .select("id")
      .eq("class_teacher_id", userId)
      .in("id", ids);
    if (aErr) return { ok: false, error: aErr.message };
    const allowed = new Set(
      ((allowedRows ?? []) as { id: string }[]).map((r) => r.id)
    );
    if (allowed.size > 0) {
      const { data: rows, error } = await admin
        .from("chat_messages")
        .select("conversation_id")
        .eq("is_read", false)
        .neq("sender_id", userId)
        .in("conversation_id", [...allowed]);
      if (error) return { ok: false, error: error.message };
      for (const r of (rows ?? []) as { conversation_id: string }[]) {
        unreadByConversationId[r.conversation_id] =
          (unreadByConversationId[r.conversation_id] ?? 0) + 1;
      }
    }
  }

  return {
    ok: true,
    conversations,
    messages,
    unreadByConversationId,
  };
}

export type ParentThreadPollOk = {
  ok: true;
  messages: PollChatMessageRow[];
  unreadCount: number;
};

export async function runParentThreadPoll(
  userId: string,
  conversationId: string
): Promise<ParentThreadPollOk | ChatPollErr> {
  let admin: AdminDb;
  try {
    admin = getAdmin();
  } catch {
    return { ok: false, error: "Server configuration error." };
  }

  const denied = await assertConversationParticipant(
    admin,
    conversationId,
    userId
  );
  if (denied) return denied;

  const { data: msgRows, error: mErr } = await admin
    .from("chat_messages")
    .select("id, message, created_at, sender_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (mErr) return { ok: false, error: mErr.message };

  const { count, error: cErr } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("is_read", false)
    .neq("sender_id", userId);
  if (cErr) return { ok: false, error: cErr.message };

  return {
    ok: true,
    messages: (msgRows ?? []) as PollChatMessageRow[],
    unreadCount: count ?? 0,
  };
}

export async function runChatInboxUnreadCount(
  userId: string
): Promise<{ ok: true; count: number } | ChatPollErr> {
  let admin: AdminDb;
  try {
    admin = getAdmin();
  } catch {
    return { ok: false, error: "Server configuration error." };
  }

  const [{ data: asParent, error: pErr }, { data: asTeacher, error: tErr }] =
    await Promise.all([
      admin.from("chat_conversations").select("id").eq("parent_id", userId),
      admin
        .from("chat_conversations")
        .select("id")
        .eq("class_teacher_id", userId),
    ]);
  if (pErr) return { ok: false, error: pErr.message };
  if (tErr) return { ok: false, error: tErr.message };
  const ids = [
    ...new Set(
      [...(asParent ?? []), ...(asTeacher ?? [])].map(
        (c: { id: string }) => c.id
      )
    ),
  ];
  if (ids.length === 0) return { ok: true, count: 0 };
  const { count, error } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", ids)
    .eq("is_read", false)
    .neq("sender_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: count ?? 0 };
}
