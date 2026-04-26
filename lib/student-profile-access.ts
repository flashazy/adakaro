import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/types/supabase";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";

type StudentForAccess = {
  class_id: string;
  school_id: string;
};

type StudentProfileTabId =
  | "academic"
  | "discipline"
  | "health"
  | "finance";

/**
 * True when the user is allowed to open a dashboard student profile for this
 * student, matching the gate in
 * `app/(dashboard)/dashboard/students/[studentId]/profile/page.tsx`.
 */
export async function canUserAccessStudentProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  student: StudentForAccess
): Promise<boolean> {
  const userSchool = await getSchoolIdForUser(supabase, userId);
  if (userSchool !== student.school_id) {
    return false;
  }

  const schoolId = student.school_id;

  const [
    { data: isAdmin },
    { data: isSuper },
    { data: teacherForClass },
    { data: scopeRows, error: scopeErr },
    { data: deptRoleRows, error: deptRoleErr },
    { data: myProfile },
  ] = await Promise.all([
    supabase.rpc("is_school_admin", { p_school_id: schoolId } as never),
    supabase.rpc("is_super_admin" as never),
    supabase.rpc("is_teacher_for_class", { p_class_id: student.class_id } as never),
    supabase
      .from("school_member_record_attachment_scopes")
      .select("scope")
      .eq("school_id", schoolId)
      .eq("user_id", userId),
    supabase
      .from("teacher_department_roles")
      .select("department")
      .eq("school_id", schoolId)
      .eq("user_id", userId),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
  ]);

  const hasHealthScope =
    !scopeErr &&
    (scopeRows ?? []).some((r) => (r as { scope: string }).scope === "health");
  const hasDisciplineScope =
    !scopeErr &&
    (scopeRows ?? []).some((r) => (r as { scope: string }).scope === "discipline");

  const departmentRoles = new Set<StudentProfileTabId>();
  if (!deptRoleErr) {
    for (const row of deptRoleRows ?? []) {
      const dep = (row as { department: string }).department;
      if (dep === "academic" || dep === "discipline" || dep === "health") {
        departmentRoles.add(dep);
      } else if (dep === "finance" || dep === "accounts") {
        departmentRoles.add("finance");
      }
    }
  }

  const myProfileRole = (myProfile as { role: UserRole } | null)?.role;
  const isFinanceOrAccountsProfile =
    myProfileRole === "finance" || myProfileRole === "accounts";

  const adminOk = Boolean(isAdmin) || Boolean(isSuper);
  const teacherOk = Boolean(teacherForClass);

  return (
    adminOk ||
    teacherOk ||
    departmentRoles.size > 0 ||
    hasHealthScope ||
    hasDisciplineScope ||
    isFinanceOrAccountsProfile
  );
}
