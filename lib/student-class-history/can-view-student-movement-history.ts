import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * School-wide roles that may open the movement history section even when empty.
 * Class coordinators rely on RLS row visibility (see load + show when rows exist).
 */
export async function canViewStudentMovementHistoryShell(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<boolean> {
  const [{ data: isSuper }, { data: isAdmin }, { data: isAcademic }, { data: isSchoolCoord }] =
    await Promise.all([
      supabase.rpc("is_super_admin" as never),
      supabase.rpc("is_school_admin", { p_school_id: schoolId } as never),
      supabase.rpc("has_teacher_department_role", {
        p_school_id: schoolId,
        p_department: "academic",
      } as never),
      supabase.rpc("is_school_coordinator", { p_school_id: schoolId } as never),
    ]);

  return Boolean(isSuper || isAdmin || isAcademic || isSchoolCoord);
}
