import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Returns the current user's primary school_id.
 * Prefer `get_my_school_id` RPC (SECURITY DEFINER) when RLS blocks direct
 * `school_members` reads; fall back to a table query if the RPC is missing.
 */
export async function getSchoolIdForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_my_school_id"
  );

  if (!rpcError && rpcData != null && String(rpcData).length > 0) {
    return rpcData as string;
  }

  const { data: row } = await supabase
    .from("school_members")
    .select("school_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const fromMember = (row as { school_id: string } | null)?.school_id ?? null;
  if (fromMember) return fromMember;

  const { data: ta } = await supabase
    .from("teacher_assignments")
    .select("school_id")
    .eq("teacher_id", userId)
    .limit(1)
    .maybeSingle();

  return (ta as { school_id: string } | null)?.school_id ?? null;
}
