import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import type { Database } from "@/types/supabase";

/** School admin or Academic department role (year-end promotions). */
export async function canAccessSchoolPromotions(
  supabase: SupabaseClient<Database>,
  userId: string,
  schoolId: string
): Promise<boolean> {
  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: schoolId,
  } as never);
  if (isAdmin) return true;

  const { data: academicRole } = await supabase
    .from("teacher_department_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .eq("department", "academic")
    .limit(1)
    .maybeSingle();

  return Boolean(academicRole);
}

/** Same school resolution as promotion server actions. */
export async function resolvePromotionsSchoolId(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data: schoolIdRpc } = await supabase.rpc("get_my_school_id");
  if (schoolIdRpc != null && String(schoolIdRpc).length > 0) {
    return schoolIdRpc as string;
  }
  return getSchoolIdForUser(supabase, userId);
}

/**
 * Promotion reads/writes use the service role when available so Academic staff
 * see the same tracks, rules, and class metadata as school admins (RLS on
 * promotion tables is otherwise admin-only).
 */
export function getPromotionsDataClient(
  sessionClient: SupabaseClient<Database>
): SupabaseClient<Database> {
  try {
    return createAdminClient();
  } catch {
    return sessionClient;
  }
}

export async function requirePromotionsAccess(): Promise<{
  supabase: SupabaseClient<Database>;
  db: SupabaseClient<Database>;
  schoolId: string;
  userId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const schoolId = await resolvePromotionsSchoolId(supabase, user.id);
  if (!schoolId) throw new Error("No school found.");

  if (!(await canAccessSchoolPromotions(supabase, user.id, schoolId))) {
    throw new Error("You do not have permission to manage promotions.");
  }

  return {
    supabase,
    db: getPromotionsDataClient(supabase),
    schoolId,
    userId: user.id,
  };
}
