import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { userIsClassTeacherForClass } from "@/lib/class-teacher";

type Supabase = SupabaseClient<Database>;

export async function getClassSchoolId(
  supabase: Supabase,
  classId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("classes")
    .select("school_id")
    .eq("id", classId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { school_id: string }).school_id;
}

/**
 * Class teachers for their class; school admins and head teachers for the school.
 * Regular subject teachers without a class-teacher assignment are denied.
 */
export async function canManageClassAttendance(
  supabase: Supabase,
  userId: string,
  classId: string
): Promise<boolean> {
  const { data: canRpc, error } = await supabase.rpc("can_manage_class_attendance", {
    p_class_id: classId,
  } as never);
  if (!error && canRpc === true) return true;

  const schoolId = await getClassSchoolId(supabase, classId);
  if (!schoolId) return false;

  const [{ data: isSuper }, { data: isAdmin }, { data: isHead }] =
    await Promise.all([
      supabase.rpc("is_super_admin", {} as never),
      supabase.rpc("is_school_admin", { p_school_id: schoolId } as never),
      supabase.rpc("is_school_head_teacher", { p_school_id: schoolId } as never),
    ]);

  if (isSuper || isAdmin || isHead) return true;
  return userIsClassTeacherForClass(userId, classId);
}

export async function assertCanManageClassAttendance(
  supabase: Supabase,
  userId: string,
  classId: string
): Promise<{ ok: true; schoolId: string } | { ok: false; error: string }> {
  const schoolId = await getClassSchoolId(supabase, classId);
  if (!schoolId) {
    return { ok: false, error: "Class not found." };
  }

  const allowed = await canManageClassAttendance(supabase, userId, classId);
  if (!allowed) {
    return {
      ok: false,
      error: "You do not have permission to manage class attendance for this class.",
    };
  }

  return { ok: true, schoolId };
}
