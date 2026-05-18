"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { userIsClassTeacherForClass } from "@/lib/class-teacher";
import type { StudentHealthAttendanceStatus } from "@/lib/student-attendance-status";

async function assertClassTeacherForStudent(
  teacherId: string,
  studentId: string
): Promise<
  { ok: true; classId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: student, error } = await supabase
    .from("students")
    .select("id, class_id, status")
    .eq("id", studentId)
    .maybeSingle();

  if (error || !student) {
    return { ok: false, error: "Student not found." };
  }

  const row = student as {
    id: string;
    class_id: string;
    status: string;
  };

  if (row.status !== "active") {
    return { ok: false, error: "Only active students can be updated." };
  }

  const allowed = await userIsClassTeacherForClass(teacherId, row.class_id);
  if (!allowed) {
    return {
      ok: false,
      error: "You are not the class teacher for this student.",
    };
  }

  return { ok: true, classId: row.class_id };
}

function revalidateClassTeacherPaths(classId: string) {
  revalidatePath("/teacher-dashboard/class-teacher");
  revalidatePath(`/teacher-dashboard/class-teacher/${classId}`);
  revalidatePath("/teacher-dashboard/attendance");
}

export async function updateStudentAttendanceStatusAction(input: {
  studentId: string;
  status: StudentHealthAttendanceStatus | null;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false, error: "Unauthorized." };
  }

  const studentId = input.studentId?.trim();
  if (!studentId) {
    return { ok: false, error: "Student is required." };
  }

  const gate = await assertClassTeacherForStudent(user.id, studentId);
  if (!gate.ok) return gate;

  const reason = input.reason?.trim() || null;

  if (input.status === null) {
    const { error } = await supabase
      .from("student_attendance_status")
      .delete()
      .eq("student_id", studentId);
    if (error) {
      return { ok: false, error: error.message || "Could not clear status." };
    }
    revalidateClassTeacherPaths(gate.classId);
    return { ok: true };
  }

  const payload = {
    student_id: studentId,
    status: input.status,
    marked_by: user.id,
    marked_at: new Date().toISOString(),
    reason,
  };

  const { data: existing } = await supabase
    .from("student_attendance_status")
    .select("id")
    .eq("student_id", studentId)
    .maybeSingle();

  // Table not in generated Supabase types until CLI regen after migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusTable = (supabase as any).from("student_attendance_status");
  const error = existing
    ? (await statusTable.update(payload).eq("student_id", studentId)).error
    : (await statusTable.insert(payload)).error;

  if (error) {
    return { ok: false, error: error.message || "Could not save status." };
  }

  revalidateClassTeacherPaths(gate.classId);
  return { ok: true };
}
