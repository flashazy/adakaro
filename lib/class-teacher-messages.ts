import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchClassesWhereUserIsClassTeacher } from "@/lib/class-teacher";

export type ClassTeacherMessageParentRow = {
  parentId: string;
  classId: string;
  className: string;
  parentName: string;
};

/**
 * Unique (parent, class) pairs for classes where `userId` is the class teacher,
 * for messaging UI (server-side; uses service role).
 */
export async function loadClassTeacherMessageParentRows(
  userId: string
): Promise<ClassTeacherMessageParentRow[]> {
  const classes = await fetchClassesWhereUserIsClassTeacher(userId);
  if (classes.length === 0) return [];

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const byKey = new Map<string, ClassTeacherMessageParentRow>();

  for (const cl of classes) {
    const { data: studs, error: sErr } = await admin
      .from("students")
      .select("id")
      .eq("class_id", cl.id)
      .eq("status", "active");
    if (sErr || !studs?.length) continue;

    const studentIds = (studs as { id: string }[]).map((s) => s.id);
    const { data: links, error: lErr } = await admin
      .from("parent_students")
      .select("parent_id")
      .in("student_id", studentIds);
    if (lErr || !links?.length) continue;

    const parentIds = [
      ...new Set((links as { parent_id: string }[]).map((x) => x.parent_id)),
    ];
    if (parentIds.length === 0) continue;

    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", parentIds);

    const nameById = new Map<string, string>();
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
      nameById.set(p.id, p.full_name?.trim() || "Parent");
    }

    for (const pid of parentIds) {
      const key = `${pid}:${cl.id}`;
      if (byKey.has(key)) continue;
      byKey.set(key, {
        parentId: pid,
        classId: cl.id,
        className: cl.name?.trim() || "Class",
        parentName: nameById.get(pid) ?? "Parent",
      });
    }
  }

  return [...byKey.values()].sort((a, b) => {
    const c = a.className.localeCompare(b.className, undefined, {
      sensitivity: "base",
    });
    if (c !== 0) return c;
    return a.parentName.localeCompare(b.parentName, undefined, {
      sensitivity: "base",
    });
  });
}
