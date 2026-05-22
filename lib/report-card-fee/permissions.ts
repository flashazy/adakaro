import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/types/supabase";
import { canUserRecordStudentPayment } from "@/lib/payments/record-permission.server";

type Sb = SupabaseClient<Database>;

/** Finance staff and school admins may manage report card fee rules. */
export async function canManageReportCardFeeRules(
  supabase: Sb,
  userId: string,
  schoolId: string
): Promise<boolean> {
  return canUserRecordStudentPayment(supabase, userId, schoolId);
}

export async function isSchoolAdminForSchool(
  supabase: Sb,
  userId: string,
  schoolId: string
): Promise<boolean> {
  const { data: isSuper, error: superErr } = await supabase.rpc(
    "is_super_admin",
    {} as never
  );
  if (!superErr && isSuper === true) return true;

  const { data: isAdmin, error: adminErr } = await supabase.rpc(
    "is_school_admin",
    { p_school_id: schoolId } as never
  );
  if (!adminErr && isAdmin === true) return true;

  const { data: member } = await supabase
    .from("school_members")
    .select("role")
    .eq("school_id", schoolId)
    .eq("user_id", userId)
    .maybeSingle();

  const role = (member as { role?: UserRole } | null)?.role;
  return role === "admin";
}
