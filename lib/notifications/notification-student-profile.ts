import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { canUserAccessStudentProfile } from "@/lib/student-profile-access";
import { STUDENT_PROFILE_CLASS_TEACHER_ENTRY } from "@/lib/student-profile-back-nav";

export const studentProfilePath = (
  studentId: string,
  opts?: { fromClassTeacherNotification?: boolean }
): string => {
  const base = `/dashboard/students/${studentId.trim()}/profile`;
  if (!opts?.fromClassTeacherNotification) return base;
  return `${base}?entry=${STUDENT_PROFILE_CLASS_TEACHER_ENTRY}`;
};

type DbClient = SupabaseClient<Database>;

/**
 * Whether the user may open the dashboard student profile for this student,
 * using the same rules as the profile page.
 */
export async function canOpenStudentProfileForUser(
  supabase: DbClient,
  userId: string,
  studentId: string
): Promise<boolean> {
  const trimmedId = studentId?.trim();
  if (!trimmedId) return false;

  const { data: student, error } = await supabase
    .from("students")
    .select("id, class_id, school_id")
    .eq("id", trimmedId)
    .maybeSingle();

  if (error || !student) return false;

  const row = student as { class_id: string; school_id: string };
  return canUserAccessStudentProfile(supabase, userId, row);
}

export async function resolveStudentProfileAccessForMoves(
  supabase: DbClient,
  userId: string,
  moves: { studentId: string }[]
): Promise<Map<string, boolean>> {
  const uniqueStudentIds = [
    ...new Set(moves.map((m) => m.studentId?.trim()).filter(Boolean)),
  ] as string[];

  const out = new Map<string, boolean>();
  if (uniqueStudentIds.length === 0) return out;

  await Promise.all(
    uniqueStudentIds.map(async (studentId) => {
      const allowed = await canOpenStudentProfileForUser(
        supabase,
        userId,
        studentId
      );
      out.set(studentId, allowed);
    })
  );

  return out;
}
