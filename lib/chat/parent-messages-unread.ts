import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Unread messages in the parent ↔ class-teacher thread for this class
 * (messages sent by the teacher, not yet read by the parent).
 * Uses service role for chat tables (same as chat server actions).
 */
export async function countParentChatUnreadForClass(
  parentId: string,
  classId: string,
  classTeacherId: string | null | undefined
): Promise<number> {
  if (!classTeacherId?.trim()) return 0;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return 0;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: conv, error: cErr } = await db
    .from("chat_conversations")
    .select("id")
    .eq("parent_id", parentId)
    .eq("class_id", classId)
    .eq("class_teacher_id", classTeacherId.trim())
    .maybeSingle();

  if (cErr || !conv) return 0;

  const { count, error: mErr } = await db
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", (conv as { id: string }).id)
    .eq("is_read", false)
    .neq("sender_id", parentId);

  if (mErr) return 0;
  return count ?? 0;
}
