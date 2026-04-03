import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

/**
 * Who should see platform broadcasts: school dashboard admins.
 * Matches parent-dashboard “Admin” entry logic: profile role admin, or
 * school_members row with role admin (when profile reads are flaky).
 */
export async function isSchoolAdminBroadcastAudience(
  userId: string,
  supabase: SupabaseClient<Database>,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if ((profile as { role: string } | null)?.role === "admin") return true;

  try {
    const admin = createAdminClient();
    const { data: profRow } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if ((profRow as { role: string } | null)?.role === "admin") return true;
    const { data: memRow } = await admin
      .from("school_members")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (memRow) return true;
  } catch {
    /* no service role */
  }
  return false;
}
