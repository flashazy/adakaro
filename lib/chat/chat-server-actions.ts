"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userIsClassTeacherForClass } from "@/lib/class-teacher";

export type ChatMessageRow = {
  id: string;
  message: string;
  created_at: string;
  sender_id: string;
};

export type TeacherConversationRow = {
  id: string;
  parent_id: string;
  class_id: string;
  last_message: string | null;
  last_message_at: string;
};

type Err = { ok: false; error: string };
type Ok<T> = { ok: true } & T;
type OkVoid = { ok: true };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- chat tables not in generated client insert/select types
type AdminDb = any;

async function getChatAdmin(): Promise<AdminDb> {
  return createAdminClient() as AdminDb;
}

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function parentHasActiveStudentInClass(
  admin: AdminDb,
  parentId: string,
  classId: string
): Promise<boolean> {
  const { data: links, error: lErr } = await admin
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", parentId);
  if (lErr || !links?.length) return false;
  const studentIds = (links as { student_id: string }[]).map((r) => r.student_id);
  const { data: studs, error: sErr } = await admin
    .from("students")
    .select("id")
    .in("id", studentIds)
    .eq("class_id", classId)
    .eq("status", "active")
    .limit(1);
  return !sErr && (studs?.length ?? 0) > 0;
}

async function assertCanOpenConversation(
  admin: AdminDb,
  userId: string,
  classTeacherId: string,
  parentId: string,
  classId: string
): Promise<Err | null> {
  if (userId !== classTeacherId && userId !== parentId) {
    return { ok: false, error: "Not allowed" };
  }
  if (userId === classTeacherId) {
    const ok = await userIsClassTeacherForClass(userId, classId);
    if (!ok || classTeacherId !== userId) {
      return { ok: false, error: "Not allowed" };
    }
    return null;
  }
  const linked = await parentHasActiveStudentInClass(admin, userId, classId);
  if (!linked || parentId !== userId) {
    return { ok: false, error: "Not allowed" };
  }
  return null;
}

async function assertConversationParticipant(
  admin: AdminDb,
  conversationId: string,
  userId: string
): Promise<Err | null> {
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

export async function listTeacherChatConversationsAction(): Promise<
  Ok<{ conversations: TeacherConversationRow[] }> | Err
> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const admin = await getChatAdmin();
  const { data, error } = await admin
    .from("chat_conversations")
    .select("id, parent_id, class_id, last_message, last_message_at")
    .eq("class_teacher_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, conversations: (data ?? []) as TeacherConversationRow[] };
}

export async function listChatMessagesAction(
  conversationId: string
): Promise<Ok<{ messages: ChatMessageRow[] }> | Err> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const admin = await getChatAdmin();
  const denied = await assertConversationParticipant(
    admin,
    conversationId,
    userId
  );
  if (denied) return denied;
  const { data, error } = await admin
    .from("chat_messages")
    .select("id, message, created_at, sender_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, messages: (data ?? []) as ChatMessageRow[] };
}

export async function ensureChatConversationAction(
  classTeacherId: string,
  parentId: string,
  classId: string
): Promise<Ok<{ conversationId: string }> | Err> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const admin = await getChatAdmin();
  const denied = await assertCanOpenConversation(
    admin,
    userId,
    classTeacherId,
    parentId,
    classId
  );
  if (denied) return denied;

  const { data: existing, error: selErr } = await admin
    .from("chat_conversations")
    .select("id")
    .eq("class_teacher_id", classTeacherId)
    .eq("parent_id", parentId)
    .eq("class_id", classId)
    .maybeSingle();
  if (selErr) return { ok: false, error: selErr.message };
  if (existing?.id) {
    return { ok: true, conversationId: (existing as { id: string }).id };
  }

  const { data: inserted, error: insErr } = await admin
    .from("chat_conversations")
    .insert({
      class_teacher_id: classTeacherId,
      parent_id: parentId,
      class_id: classId,
    })
    .select("id")
    .single();

  if (!insErr && inserted?.id) {
    return { ok: true, conversationId: (inserted as { id: string }).id };
  }

  if (insErr?.code === "23505") {
    const { data: raced, error: rErr } = await admin
      .from("chat_conversations")
      .select("id")
      .eq("class_teacher_id", classTeacherId)
      .eq("parent_id", parentId)
      .eq("class_id", classId)
      .maybeSingle();
    if (!rErr && raced?.id) {
      return { ok: true, conversationId: (raced as { id: string }).id };
    }
  }

  return {
    ok: false,
    error: insErr?.message ?? "Could not create conversation",
  };
}

export async function insertChatMessageAction(
  conversationId: string,
  message: string
): Promise<OkVoid | Err> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const text = message.trim();
  if (!text) return { ok: false, error: "Empty message" };
  const admin = await getChatAdmin();
  const denied = await assertConversationParticipant(
    admin,
    conversationId,
    userId
  );
  if (denied) return denied;
  const { error } = await admin.from("chat_messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    message: text,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markChatConversationReadAction(
  conversationId: string
): Promise<OkVoid | Err> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const admin = await getChatAdmin();
  const denied = await assertConversationParticipant(
    admin,
    conversationId,
    userId
  );
  if (denied) return denied;
  const { error } = await admin
    .from("chat_messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .eq("is_read", false);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function countUnreadInConversationAction(
  conversationId: string
): Promise<Ok<{ count: number }> | Err> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const admin = await getChatAdmin();
  const denied = await assertConversationParticipant(
    admin,
    conversationId,
    userId
  );
  if (denied) return denied;
  const { count, error } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("is_read", false)
    .neq("sender_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: count ?? 0 };
}

export async function countUnreadMessagesForTeacherConversationsAction(
  conversationIds: string[]
): Promise<Ok<{ byConversationId: Record<string, number> }> | Err> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  if (conversationIds.length === 0) {
    return { ok: true, byConversationId: {} };
  }
  const admin = await getChatAdmin();
  const { data: allowedRows, error: aErr } = await admin
    .from("chat_conversations")
    .select("id")
    .eq("class_teacher_id", userId)
    .in("id", conversationIds);
  if (aErr) return { ok: false, error: aErr.message };
  const allowed = new Set(
    ((allowedRows ?? []) as { id: string }[]).map((r) => r.id)
  );
  if (allowed.size === 0) {
    return { ok: true, byConversationId: {} };
  }
  const { data: rows, error } = await admin
    .from("chat_messages")
    .select("conversation_id")
    .eq("is_read", false)
    .neq("sender_id", userId)
    .in("conversation_id", [...allowed]);
  if (error) return { ok: false, error: error.message };
  const byConversationId: Record<string, number> = {};
  for (const r of (rows ?? []) as { conversation_id: string }[]) {
    byConversationId[r.conversation_id] =
      (byConversationId[r.conversation_id] ?? 0) + 1;
  }
  return { ok: true, byConversationId };
}

export async function getChatInboxUnreadCountAction(): Promise<
  Ok<{ count: number }> | Err
> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const admin = await getChatAdmin();
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
