import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AIConversation, AIMessage, AIProduct } from "@/lib/ai/types";

export async function createConversation(
  client: SupabaseClient<Database>,
  input: {
    product: AIProduct;
    userId?: string | null;
    schoolId?: string | null;
    anonymousSessionId?: string | null;
    title?: string | null;
  }
): Promise<AIConversation | null> {
  const { data, error } = await client
    .from("ai_conversations")
    .insert({
      product: input.product,
      user_id: input.userId ?? null,
      school_id: input.schoolId ?? null,
      anonymous_session_id: input.anonymousSessionId ?? null,
      title: input.title ?? null,
    } as never)
    .select("id, product, title, created_at, updated_at, school_id")
    .single();

  if (error || !data) {
    console.error("[ai] create conversation:", error);
    return null;
  }

  const row = data as {
    id: string;
    product: AIProduct;
    title: string | null;
    created_at: string;
    updated_at: string;
    school_id: string | null;
  };

  return {
    id: row.id,
    product: row.product,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schoolId: row.school_id,
  };
}

export async function loadConversationMessages(
  client: SupabaseClient<Database>,
  conversationId: string
): Promise<AIMessage[]> {
  const { data, error } = await client
    .from("ai_messages")
    .select("id, role, content, created_at, metadata")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return (data as Array<{
    id: string;
    role: AIMessage["role"];
    content: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }>).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    metadata: row.metadata ?? undefined,
  }));
}

export async function insertMessage(
  client: SupabaseClient<Database>,
  input: {
    conversationId: string;
    role: AIMessage["role"];
    content: string;
    metadata?: Record<string, unknown>;
  }
): Promise<AIMessage | null> {
  const { data, error } = await client
    .from("ai_messages")
    .insert({
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content,
      metadata: input.metadata ?? {},
    } as never)
    .select("id, role, content, created_at, metadata")
    .single();

  if (error || !data) {
    console.error("[ai] insert message:", error);
    return null;
  }

  const row = data as {
    id: string;
    role: AIMessage["role"];
    content: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
  };

  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    metadata: row.metadata ?? undefined,
  };
}

export async function listUserConversations(
  client: SupabaseClient<Database>,
  userId: string,
  product: AIProduct,
  limit = 20
): Promise<AIConversation[]> {
  const { data, error } = await client
    .from("ai_conversations")
    .select("id, product, title, created_at, updated_at, school_id")
    .eq("user_id", userId)
    .eq("product", product)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as Array<{
    id: string;
    product: AIProduct;
    title: string | null;
    created_at: string;
    updated_at: string;
    school_id: string | null;
  }>).map((row) => ({
    id: row.id,
    product: row.product,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schoolId: row.school_id,
  }));
}
