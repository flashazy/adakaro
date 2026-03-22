import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";

/**
 * All school IDs the current user can access (memberships + schools they created).
 * Prefer `user_school_ids` RPC (SECURITY DEFINER); fall back to `getSchoolIdForUser`.
 */
export async function getSchoolIdsForAdminUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase.rpc("user_school_ids");

  if (!error && data != null) {
    const ids = Array.isArray(data)
      ? data
      : typeof data === "string"
        ? [data]
        : [];
    const unique = [...new Set(ids.map(String).filter(Boolean))];
    if (unique.length > 0) return unique;
  }

  const one = await getSchoolIdForUser(supabase, userId);
  return one ? [one] : [];
}
