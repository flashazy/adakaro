import "server-only";

import { letterGradeFromPercent } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-grades";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

export interface HistoricalMarkEntry {
  subject: string;
  assignmentTitle: string;
  scoreDisplay: string | null;
  scorePercent: number | null;
  gradeLabel: string | null;
  recordedByName: string | null;
  recordedDate: string;
}

export interface HistoricalMarksClassGroup {
  classId: string;
  className: string;
  entries: HistoricalMarkEntry[];
}

function collectPreviousClassOrder(
  historyRows: {
    from_class_id: string | null;
    to_class_id: string;
    effective_at: string;
  }[],
  currentClassId: string
): { classId: string; sortKey: string }[] {
  const leftAtByClass = new Map<string, string>();

  for (const row of historyRows) {
    const fromId = row.from_class_id?.trim();
    if (fromId && fromId !== currentClassId) {
      const prev = leftAtByClass.get(fromId);
      if (!prev || row.effective_at > prev) {
        leftAtByClass.set(fromId, row.effective_at);
      }
    }
  }

  const classIds = new Set<string>();
  for (const row of historyRows) {
    const fromId = row.from_class_id?.trim();
    const toId = row.to_class_id?.trim();
    if (fromId && fromId !== currentClassId) classIds.add(fromId);
    if (toId && toId !== currentClassId) classIds.add(toId);
  }

  return [...classIds]
    .map((classId) => ({
      classId,
      sortKey: leftAtByClass.get(classId) ?? "",
    }))
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

function previousClassIdsForStudent(
  historyRows: {
    from_class_id: string | null;
    to_class_id: string;
    effective_at: string;
  }[],
  currentClassId: string
): Set<string> {
  const ordered = collectPreviousClassOrder(historyRows, currentClassId);
  return new Set(ordered.map((c) => c.classId));
}

function parseScore(raw: unknown): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function scorePercent(score: number, maxScore: number): number | null {
  if (!Number.isFinite(maxScore) || maxScore <= 0) return null;
  return Math.round((score / maxScore) * 1000) / 10;
}

function formatScoreDisplay(
  score: number | null,
  maxScore: number,
  percent: number | null
): string | null {
  if (score == null) return null;
  if (percent != null) {
    return `${percent}%`;
  }
  return `${score} / ${maxScore}`;
}

/**
 * Read-only prior gradebook marks for the current class teacher.
 * Uses admin client after the caller has verified class-teacher access.
 */
export async function loadHistoricalMarksForClassTeacher(
  studentId: string,
  currentClassId: string,
  schoolId: string
): Promise<{
  groups: HistoricalMarksClassGroup[];
  error: string | null;
}> {
  const trimmedStudent = studentId?.trim();
  const trimmedCurrent = currentClassId?.trim();
  const trimmedSchool = schoolId?.trim();
  if (!trimmedStudent || !trimmedCurrent || !trimmedSchool) {
    return { groups: [], error: null };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { groups: [], error: msg };
  }

  const { data: schoolRow, error: schoolErr } = await admin
    .from("schools")
    .select("school_level")
    .eq("id", trimmedSchool)
    .maybeSingle();
  if (schoolErr) {
    return { groups: [], error: schoolErr.message };
  }
  const schoolLevel =
    (schoolRow as { school_level: string } | null)?.school_level ?? "secondary";

  const { data: historyRows, error: historyErr } = await admin
    .from("student_class_history")
    .select("from_class_id, to_class_id, effective_at")
    .eq("student_id", trimmedStudent)
    .eq("school_id", trimmedSchool)
    .order("effective_at", { ascending: false });

  if (historyErr) {
    return { groups: [], error: historyErr.message };
  }

  const orderedPrevious = collectPreviousClassOrder(
    (historyRows ?? []) as {
      from_class_id: string | null;
      to_class_id: string;
      effective_at: string;
    }[],
    trimmedCurrent
  );

  if (orderedPrevious.length === 0) {
    return { groups: [], error: null };
  }

  const previousClassIds = orderedPrevious.map((c) => c.classId);

  const { data: classRows, error: classErr } = await admin
    .from("classes")
    .select("id, name, school_id")
    .in("id", previousClassIds);
  if (classErr) {
    return { groups: [], error: classErr.message };
  }

  const classNameById = new Map<string, string>();
  const allowedClassIds = new Set<string>();
  for (const c of (classRows ?? []) as {
    id: string;
    name: string;
    school_id: string;
  }[]) {
    if (c.school_id !== trimmedSchool) continue;
    allowedClassIds.add(c.id);
    classNameById.set(c.id, c.name?.trim() || "Class");
  }

  const classIdsToLoad = previousClassIds.filter((id) => allowedClassIds.has(id));
  if (classIdsToLoad.length === 0) {
    return { groups: [], error: null };
  }

  const assignments = await fetchAllRows<{
    id: string;
    class_id: string;
    subject: string;
    title: string;
    max_score: number;
    teacher_id: string;
  }>({
    label: "historical-marks:assignments by prior class",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_gradebook_assignments")
        .select("id, class_id, subject, title, max_score, teacher_id")
        .in("class_id", classIdsToLoad)
        .order("created_at", { ascending: false })
        .range(from, to),
  });

  if (assignments.length === 0) {
    return { groups: [], error: null };
  }

  const assignmentIds = assignments.map((a) => a.id);
  const assignmentMeta = new Map<
    string,
    {
      classId: string;
      subject: string;
      title: string;
      maxScore: number;
      teacherId: string;
    }
  >();
  for (const a of assignments) {
    if (!allowedClassIds.has(a.class_id)) continue;
    assignmentMeta.set(a.id, {
      classId: a.class_id,
      subject: a.subject?.trim() || "—",
      title: a.title?.trim() || "—",
      maxScore: Number(a.max_score),
      teacherId: a.teacher_id,
    });
  }

  const teacherIds = [
    ...new Set(assignments.map((a) => a.teacher_id).filter(Boolean)),
  ];
  const teacherNameById = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", teacherIds);
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
      teacherNameById.set(p.id, p.full_name?.trim() || "Teacher");
    }
  }

  const scoreRows = await fetchAllRows<{
    assignment_id: string;
    score: unknown;
    created_at: string;
  }>({
    label: "historical-marks:teacher_scores by student",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_scores")
        .select("assignment_id, score, created_at")
        .eq("student_id", trimmedStudent)
        .in("assignment_id", assignmentIds)
        .order("created_at", { ascending: false })
        .range(from, to),
  });

  const entriesByClass = new Map<string, HistoricalMarkEntry[]>();
  for (const row of scoreRows) {
    const meta = assignmentMeta.get(row.assignment_id);
    if (!meta || !allowedClassIds.has(meta.classId)) continue;

    const score = parseScore(row.score);
    const maxScore = meta.maxScore;
    const percent =
      score != null ? scorePercent(score, maxScore) : null;
    const gradeLabel =
      percent != null ? letterGradeFromPercent(percent, schoolLevel) : null;

    const list = entriesByClass.get(meta.classId) ?? [];
    list.push({
      subject: meta.subject,
      assignmentTitle: meta.title,
      scoreDisplay: formatScoreDisplay(score, maxScore, percent),
      scorePercent: percent,
      gradeLabel: gradeLabel && gradeLabel !== "—" ? gradeLabel : null,
      recordedByName: teacherNameById.get(meta.teacherId) ?? null,
      recordedDate: row.created_at,
    });
    entriesByClass.set(meta.classId, list);
  }

  const groups: HistoricalMarksClassGroup[] = [];
  for (const { classId } of orderedPrevious) {
    if (!allowedClassIds.has(classId)) continue;
    const entries = entriesByClass.get(classId) ?? [];
    if (entries.length === 0) continue;
    entries.sort((a, b) => b.recordedDate.localeCompare(a.recordedDate));
    groups.push({
      classId,
      className: classNameById.get(classId) ?? "Class",
      entries,
    });
  }

  return { groups, error: null };
}

/**
 * Returns student ids (subset of `studentIds`) that have at least one
 * teacher_scores row for an assignment in a prior class from student_class_history.
 */
export async function listStudentIdsWithHistoricalMarks(
  currentClassId: string,
  schoolId: string,
  studentIds: string[]
): Promise<Set<string>> {
  const trimmedCurrent = currentClassId?.trim();
  const trimmedSchool = schoolId?.trim();
  const trimmedIds = [...new Set(studentIds.map((id) => id?.trim()).filter(Boolean))];
  if (!trimmedCurrent || !trimmedSchool || trimmedIds.length === 0) {
    return new Set();
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return new Set();
  }

  const { data: historyRows, error: historyErr } = await admin
    .from("student_class_history")
    .select("student_id, from_class_id, to_class_id, effective_at")
    .eq("school_id", trimmedSchool)
    .in("student_id", trimmedIds);

  if (historyErr || !historyRows?.length) {
    return new Set();
  }

  const previousByStudent = new Map<string, Set<string>>();
  const allPreviousClassIds = new Set<string>();

  for (const sid of trimmedIds) {
    const rows = (historyRows as {
      student_id: string;
      from_class_id: string | null;
      to_class_id: string;
      effective_at: string;
    }[]).filter((r) => r.student_id === sid);
    const prev = previousClassIdsForStudent(rows, trimmedCurrent);
    if (prev.size > 0) {
      previousByStudent.set(sid, prev);
      for (const cid of prev) allPreviousClassIds.add(cid);
    }
  }

  if (previousByStudent.size === 0 || allPreviousClassIds.size === 0) {
    return new Set();
  }

  const assignments = await fetchAllRows<{
    id: string;
    class_id: string;
  }>({
    label: "historical-marks:flags assignments",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_gradebook_assignments")
        .select("id, class_id")
        .in("class_id", [...allPreviousClassIds])
        .range(from, to),
  });

  if (assignments.length === 0) {
    return new Set();
  }

  const assignmentToClass = new Map<string, string>();
  for (const a of assignments) {
    assignmentToClass.set(a.id, a.class_id);
  }
  const assignmentIds = assignments.map((a) => a.id);

  const scoreRows = await fetchAllRows<{
    student_id: string;
    assignment_id: string;
  }>({
    label: "historical-marks:flags teacher_scores",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_scores")
        .select("student_id, assignment_id")
        .in("student_id", trimmedIds)
        .in("assignment_id", assignmentIds)
        .range(from, to),
  });

  const withHistory = new Set<string>();
  for (const row of scoreRows) {
    const prev = previousByStudent.get(row.student_id);
    const classId = assignmentToClass.get(row.assignment_id);
    if (prev && classId && prev.has(classId)) {
      withHistory.add(row.student_id);
    }
  }

  return withHistory;
}
