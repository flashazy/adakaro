"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClassSchoolId } from "@/lib/class-attendance/class-attendance-access";
import { canViewHistoricalAttendance } from "@/lib/class-attendance/can-view-historical-attendance";
import {
  loadHistoricalClassListForClassTeacher,
  listStudentIdsWithHistoricalClassList,
  type HistoricalClassListClassGroup,
} from "@/lib/teacher-attendance/load-historical-class-list-for-class-teacher";

async function assertClassTeacherHistoricalClassListAccess(
  userId: string,
  classId: string
): Promise<
  | { ok: true; schoolId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const schoolId = await getClassSchoolId(supabase, classId);
  if (!schoolId) {
    return { ok: false, error: "Class not found." };
  }

  const allowed = await canViewHistoricalAttendance(userId, classId);
  if (!allowed) {
    return { ok: false, error: "You do not have permission to view this." };
  }

  return { ok: true, schoolId };
}

async function assertStudentActiveInClass(
  studentId: string,
  classId: string
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("class_id", classId)
      .eq("status", "active")
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function listStudentsWithHistoricalClassListAction(input: {
  classId: string;
  studentIds: string[];
}): Promise<
  | { ok: true; studentIds: string[] }
  | { ok: false; error: string }
> {
  const classId = input.classId?.trim();
  if (!classId) {
    return { ok: false, error: "Invalid class." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const access = await assertClassTeacherHistoricalClassListAccess(
    user.id,
    classId
  );
  if (!access.ok) {
    return { ok: true, studentIds: [] };
  }

  const ids = [
    ...new Set(
      (input.studentIds ?? []).map((id) => id?.trim()).filter(Boolean)
    ),
  ];
  if (ids.length === 0) {
    return { ok: true, studentIds: [] };
  }

  const withHistory = await listStudentIdsWithHistoricalClassList(
    classId,
    access.schoolId,
    ids
  );

  return { ok: true, studentIds: [...withHistory] };
}

export async function loadStudentHistoricalClassListAction(input: {
  classId: string;
  studentId: string;
}): Promise<
  | { ok: true; groups: HistoricalClassListClassGroup[] }
  | { ok: false; error: string }
> {
  const classId = input.classId?.trim();
  const studentId = input.studentId?.trim();
  if (!classId || !studentId) {
    return { ok: false, error: "Invalid class or student." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const access = await assertClassTeacherHistoricalClassListAccess(
    user.id,
    classId
  );
  if (!access.ok) {
    return { ok: false, error: access.error };
  }

  const inClass = await assertStudentActiveInClass(studentId, classId);
  if (!inClass) {
    return { ok: false, error: "Student not found in this class." };
  }

  const loaded = await loadHistoricalClassListForClassTeacher(
    studentId,
    classId,
    access.schoolId
  );
  if (loaded.error) {
    return { ok: false, error: loaded.error };
  }

  return { ok: true, groups: loaded.groups };
}
