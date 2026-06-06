import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ClassTeacherClassRow = {
  id: string;
  name: string;
  school_id: string;
};

/**
 * Leaf classes (or any class) where this user is the designated class teacher.
 */
export async function fetchClassesWhereUserIsClassTeacher(
  userId: string
): Promise<ClassTeacherClassRow[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("classes")
      .select("id, name, school_id")
      .eq("class_teacher_id", userId)
      .order("name");
    if (error) return [];
    return (data ?? []) as ClassTeacherClassRow[];
  } catch {
    return [];
  }
}

export async function userIsClassTeacherForClass(
  userId: string,
  classId: string
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("class_teacher_id", userId)
      .maybeSingle();
    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

/** True when `classTeacherId` on the student's class row matches the user. */
export function isClassTeacherIdForUser(
  classTeacherId: string | null | undefined,
  userId: string
): boolean {
  const trimmedTeacher = classTeacherId?.trim();
  const trimmedUser = userId?.trim();
  return Boolean(
    trimmedTeacher && trimmedUser && trimmedTeacher === trimmedUser
  );
}

/**
 * Whether the user is the designated class teacher for the student's current
 * class. Prefers the embedded `classes.class_teacher_id` from the student row,
 * then confirms via taught-class lookup.
 */
export async function isUserClassTeacherForStudentClass(
  userId: string,
  studentClassId: string,
  studentClassTeacherId?: string | null
): Promise<boolean> {
  const classId = studentClassId?.trim();
  if (!classId || !userId?.trim()) return false;

  if (isClassTeacherIdForUser(studentClassTeacherId, userId)) {
    return true;
  }

  if (await userIsClassTeacherForClass(userId, classId)) {
    return true;
  }

  const taughtClasses = await fetchClassesWhereUserIsClassTeacher(userId);
  return taughtClasses.some((c) => c.id === classId);
}

type ClassTeacherIdRow = {
  class_teacher_id: string | null;
  parent_class_id: string | null;
};

/**
 * True when `userId` is `class_teacher_id` on the student's current class, or on
 * the parent class when the student sits in a stream/child class.
 */
export async function isViewerClassTeacherForStudentClass(
  userId: string,
  studentClassId: string,
  studentClassTeacherId?: string | null
): Promise<boolean> {
  const trimmedUserId = userId?.trim();
  const classId = studentClassId?.trim();
  if (!trimmedUserId || !classId) return false;

  if (isClassTeacherIdForUser(studentClassTeacherId, trimmedUserId)) {
    return true;
  }

  if (await isUserClassTeacherForStudentClass(trimmedUserId, classId)) {
    return true;
  }

  try {
    const admin = createAdminClient();
    const { data: studentClass, error } = await admin
      .from("classes")
      .select("class_teacher_id, parent_class_id")
      .eq("id", classId)
      .maybeSingle();

    if (error || !studentClass) return false;

    const row = studentClass as ClassTeacherIdRow;
    if (isClassTeacherIdForUser(row.class_teacher_id, trimmedUserId)) {
      return true;
    }

    const parentId = row.parent_class_id?.trim();
    if (!parentId) return false;

    const { data: parentClass, error: parentErr } = await admin
      .from("classes")
      .select("class_teacher_id")
      .eq("id", parentId)
      .maybeSingle();

    if (parentErr || !parentClass) return false;
    return isClassTeacherIdForUser(
      (parentClass as { class_teacher_id: string | null }).class_teacher_id,
      trimmedUserId
    );
  } catch {
    return false;
  }
}

export type SchoolTeacherOption = {
  id: string;
  full_name: string;
};

/**
 * Active teachers in the school (for class-teacher dropdown). Admin-only callers.
 */
export async function fetchSchoolTeachersForSelect(
  schoolId: string
): Promise<SchoolTeacherOption[]> {
  try {
    const admin = createAdminClient();
    const { data: mems, error: mErr } = await admin
      .from("school_members")
      .select("user_id")
      .eq("school_id", schoolId)
      .eq("role", "teacher");
    if (mErr || !mems?.length) return [];
    const ids = [...new Set((mems as { user_id: string }[]).map((m) => m.user_id))];
    const { data: profs, error: pErr } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids)
      .order("full_name");
    if (pErr) return [];
    return ((profs ?? []) as { id: string; full_name: string }[]).map((p) => ({
      id: p.id,
      full_name: p.full_name?.trim() || "Teacher",
    }));
  } catch {
    return [];
  }
}

/**
 * Returns map class_id -> { full_name, phone } for parents / dashboards.
 */
export async function fetchClassTeacherContactByClassIds(
  classIds: string[]
): Promise<
  Map<string, { full_name: string; phone: string | null }>
> {
  const out = new Map<string, { full_name: string; phone: string | null }>();
  const uniq = [...new Set(classIds.filter(Boolean))];
  if (uniq.length === 0) return out;
  try {
    const admin = createAdminClient();
    const { data: rows, error } = await admin
      .from("classes")
      .select("id, class_teacher_id")
      .in("id", uniq);
    if (error || !rows?.length) return out;
    const teacherIds = [
      ...new Set(
        (rows as { id: string; class_teacher_id: string | null }[])
          .map((r) => r.class_teacher_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (teacherIds.length === 0) return out;
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", teacherIds);
    const byTeacher = new Map(
      ((profs ?? []) as {
        id: string;
        full_name: string;
        phone: string | null;
      }[]).map((p) => [
        p.id,
        {
          full_name: p.full_name?.trim() || "Class teacher",
          phone: p.phone?.trim() ? p.phone.trim() : null,
        },
      ])
    );
    for (const r of rows as {
      id: string;
      class_teacher_id: string | null;
    }[]) {
      if (!r.class_teacher_id) continue;
      const c = byTeacher.get(r.class_teacher_id);
      if (c) out.set(r.id, c);
    }
  } catch {
    /* no service role */
  }
  return out;
}
