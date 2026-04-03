import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Distinct user ids that count as school admins: profiles.role = admin or
 * school_members.role = admin, excluding platform super_admin profiles.
 */
export async function getSchoolAdminUserIds(
  admin: SupabaseClient<Database>
): Promise<string[]> {
  const [{ data: profRows }, { data: memRows }, { data: superRows }] =
    await Promise.all([
      admin.from("profiles").select("id").eq("role", "admin"),
      admin.from("school_members").select("user_id").eq("role", "admin"),
      admin.from("profiles").select("id").eq("role", "super_admin"),
    ]);

  const ids = new Set<string>();
  for (const r of profRows ?? []) {
    ids.add((r as { id: string }).id);
  }
  for (const r of memRows ?? []) {
    ids.add((r as { user_id: string }).user_id);
  }
  const superSet = new Set(
    (superRows ?? []).map((r) => (r as { id: string }).id)
  );
  return [...ids].filter((id) => !superSet.has(id));
}
