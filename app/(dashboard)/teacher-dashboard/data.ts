import "server-only";

import { fetchParentClassIdsWithChildrenForSchools } from "@/lib/teacher-leaf-classes";
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
  /** When set, enrolment-aware filters use this subject. */
  subjectId: string | null;
  /**
   * Marks page only: parent cohort (cross-stream) vs a single stream assignment.
   */
  markingScope?: "all_streams" | "single_stream";
};

type AssignmentRow = {
  id: string;
  class_id: string;
  school_id: string;
  subject: string;
  academic_year: string;
  subject_id: string | null;
  subjects: { name: string } | null;
};

async function fetchLeafAssignmentRows(
  userId: string
): Promise<{ admin: Db; leafRows: AssignmentRow[] }> {
  const admin = createAdminClient();
  const { data: assignments } = await (admin as Db)
    .from("teacher_assignments")
    .select(
      `
      id,
      class_id,
      school_id,
      subject,
      academic_year,
      subject_id,
      subjects ( name )
    `
    )
    .eq("teacher_id", userId);

  const rows = (assignments ?? []) as AssignmentRow[];

  const schoolIds = [...new Set(rows.map((r) => r.school_id).filter(Boolean))];
  const parentIds = await fetchParentClassIdsWithChildrenForSchools(
    admin,
    schoolIds
  );
  const leafRows = rows.filter((r) => !parentIds.has(r.class_id));

  return { admin, leafRows };
}

async function mapLeafRowsToOptions(
  admin: Db,
  leafRows: AssignmentRow[]
): Promise<TeacherClassOption[]> {
  const classIds = [...new Set(leafRows.map((r) => r.class_id))];
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

  return leafRows.map((a) => ({
    assignmentId: a.id,
    classId: a.class_id,
    className: classNameById.get(a.class_id) ?? "Class",
    subject:
      a.subjects?.name?.trim() ||
      a.subject?.trim() ||
      "General",
    academicYear: a.academic_year?.trim() || "",
    subjectId: a.subject_id,
  }));
}

/**
 * Classes this teacher is directly assigned to (child streams only — not parent
 * containers). Use for Attendance, Lesson Plans, dashboard shortcuts, and
 * student lists.
 */
export async function getTeacherTeachingClasses(
  userId: string
): Promise<TeacherClassOption[]> {
  const { admin, leafRows } = await fetchLeafAssignmentRows(userId);
  return mapLeafRowsToOptions(admin, leafRows);
}

/**
 * Classes for Marks / gradebook: assigned streams plus parent class rows for
 * cross-stream exams (one parent per subject/year when the teacher has a stream
 * under that parent).
 */
export async function getTeacherMarkingClasses(
  userId: string
): Promise<TeacherClassOption[]> {
  const { admin, leafRows } = await fetchLeafAssignmentRows(userId);
  const streamOptions: TeacherClassOption[] = (
    await mapLeafRowsToOptions(admin, leafRows)
  ).map((o) => ({ ...o, markingScope: "single_stream" as const }));

  const classIds = [...new Set(leafRows.map((r) => r.class_id))];
  const parentByChild = new Map<string, string | null>();
  if (classIds.length > 0) {
    const { data: classRows } = await admin
      .from("classes")
      .select("id, parent_class_id")
      .in("id", classIds);
    for (const c of classRows ?? []) {
      const row = c as { id: string; parent_class_id: string | null };
      parentByChild.set(row.id, row.parent_class_id ?? null);
    }
  }

  const parentIds = [
    ...new Set(
      [...parentByChild.values()].filter((v): v is string => typeof v === "string")
    ),
  ];
  const parentNameById = new Map<string, string>();
  if (parentIds.length > 0) {
    const { data: parentRows } = await admin
      .from("classes")
      .select("id, name")
      .in("id", parentIds);
    for (const p of parentRows ?? []) {
      const row = p as { id: string; name: string };
      parentNameById.set(row.id, row.name);
    }
  }

  const parentOptions: TeacherClassOption[] = [];
  const seenParentKey = new Set<string>();
  for (const opt of streamOptions) {
    const parentId = parentByChild.get(opt.classId) ?? null;
    if (!parentId) continue;
    const parentName = parentNameById.get(parentId);
    if (!parentName) continue;
    const key = `${parentId}\0${opt.subject.toLowerCase()}\0${opt.academicYear}`;
    if (seenParentKey.has(key)) continue;
    seenParentKey.add(key);
    parentOptions.push({
      assignmentId: opt.assignmentId,
      classId: parentId,
      className: parentName,
      subject: opt.subject,
      academicYear: opt.academicYear,
      subjectId: opt.subjectId,
      markingScope: "all_streams",
    });
  }

  const combined = [...streamOptions, ...parentOptions];
  combined.sort((a, b) => {
    const rank = (m: TeacherClassOption["markingScope"]) =>
      m === "all_streams" ? 0 : 1;
    const ra = rank(a.markingScope);
    const rb = rank(b.markingScope);
    if (ra !== rb) return ra - rb;
    return a.className.localeCompare(b.className, undefined, {
      sensitivity: "base",
    });
  });
  return combined;
}
