import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Manual widen — admin select with nested relation. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type TeacherClassOption = {
  assignmentId: string;
  classId: string;
  className: string;
  subject: string;
  academicYear: string;
};

export async function getTeacherClassOptions(
  userId: string
): Promise<TeacherClassOption[]> {
  const admin = createAdminClient();
  const { data: assignments } = await (admin as Db)
    .from("teacher_assignments")
    .select(
      `
      id,
      class_id,
      subject,
      academic_year,
      subject_id,
      subjects ( name )
    `
    )
    .eq("teacher_id", userId);

  const rows =
    (assignments ?? []) as {
      id: string;
      class_id: string;
      subject: string;
      academic_year: string;
      subject_id: string | null;
      subjects: { name: string } | null;
    }[];

  const classIds = [...new Set(rows.map((r) => r.class_id))];
  const classNameById = new Map<string, string>();
  if (classIds.length > 0) {
    const { data: classRows } = await admin
      .from("classes")
      .select("id, name")
      .in("id", classIds);
    for (const c of classRows ?? []) {
      const row = c as { id: string; name: string };
      classNameById.set(row.id, row.name);
    }
  }

  return rows.map((a) => ({
    assignmentId: a.id,
    classId: a.class_id,
    className: classNameById.get(a.class_id) ?? "Class",
    subject:
      a.subjects?.name?.trim() ||
      a.subject?.trim() ||
      "General",
    academicYear: a.academic_year?.trim() || "",
  }));
}
