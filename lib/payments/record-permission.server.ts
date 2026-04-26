import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/types/supabase";

type Sb = SupabaseClient<Database>;

export async function canUserRecordStudentPayment(
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

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) {
    return false;
  }
  const pr = (profile as { role: UserRole } | null)?.role;
  if (pr === "finance" || pr === "accounts") return true;

  const { data: deptRows, error: deptErr } = await supabase
    .from("teacher_department_roles")
    .select("department")
    .eq("school_id", schoolId)
    .eq("user_id", userId);

  if (deptErr) return false;
  for (const row of deptRows ?? []) {
    const d = (row as { department: string }).department;
    if (d === "finance" || d === "accounts") return true;
  }
  return false;
}
