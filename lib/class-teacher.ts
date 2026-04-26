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
