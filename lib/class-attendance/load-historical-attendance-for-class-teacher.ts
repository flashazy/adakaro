import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import {
  CLASS_ATTENDANCE_STATUS_LABELS,
  type ClassAttendanceStatus,
} from "./class-attendance-types";
import { isClassAttendanceStatus } from "./class-attendance-utils";

export interface HistoricalAttendanceEntry {
  attendanceDate: string;
  statusLabel: string;
  note: string | null;
}

export interface HistoricalAttendanceClassGroup {
  classId: string;
  className: string;
  entries: HistoricalAttendanceEntry[];
}

function statusLabel(raw: string): string {
  if (isClassAttendanceStatus(raw)) {
    return CLASS_ATTENDANCE_STATUS_LABELS[raw as ClassAttendanceStatus];
  }
  const trimmed = raw.trim();
  if (!trimmed) return "—";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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

/**
 * Read-only prior official class attendance for the current class teacher.
 * Uses admin client after the caller has verified class-teacher access.
 */
export async function loadHistoricalAttendanceForClassTeacher(
  studentId: string,
  currentClassId: string,
  schoolId: string
): Promise<{
  groups: HistoricalAttendanceClassGroup[];
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

  const attendanceRows = await fetchAllRows<{
    class_id: string;
    attendance_date: string;
    status: string;
    notes: string | null;
  }>({
    label: "historical-attendance:class_attendance by student",
    fetchPage: async (from, to) =>
      await admin
        .from("class_attendance")
        .select("class_id, attendance_date, status, notes")
        .eq("student_id", trimmedStudent)
        .eq("school_id", trimmedSchool)
        .in("class_id", classIdsToLoad)
        .order("attendance_date", { ascending: false })
        .range(from, to),
  });

  const entriesByClass = new Map<string, HistoricalAttendanceEntry[]>();
  for (const row of attendanceRows) {
    if (!allowedClassIds.has(row.class_id)) continue;
    const list = entriesByClass.get(row.class_id) ?? [];
    list.push({
      attendanceDate: row.attendance_date,
      statusLabel: statusLabel(row.status),
      note: row.notes?.trim() ? row.notes.trim() : null,
    });
    entriesByClass.set(row.class_id, list);
  }

  const groups: HistoricalAttendanceClassGroup[] = [];
  for (const { classId } of orderedPrevious) {
    if (!allowedClassIds.has(classId)) continue;
    const entries = entriesByClass.get(classId) ?? [];
    if (entries.length === 0) continue;
    entries.sort((a, b) =>
      b.attendanceDate.localeCompare(a.attendanceDate)
    );
    groups.push({
      classId,
      className: classNameById.get(classId) ?? "Class",
      entries,
    });
  }

  return { groups, error: null };
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

/**
 * Returns student ids (subset of `studentIds`) that have at least one
 * class_attendance row in a prior class from student_class_history.
 */
export async function listStudentIdsWithHistoricalAttendance(
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

  const attendanceRows = await fetchAllRows<{
    student_id: string;
    class_id: string;
  }>({
    label: "historical-attendance:flags class_attendance",
    fetchPage: async (from, to) =>
      await admin
        .from("class_attendance")
        .select("student_id, class_id")
        .eq("school_id", trimmedSchool)
        .in("student_id", trimmedIds)
        .in("class_id", [...allPreviousClassIds])
        .range(from, to),
  });

  const withHistory = new Set<string>();
  for (const row of attendanceRows) {
    const prev = previousByStudent.get(row.student_id);
    if (prev?.has(row.class_id)) {
      withHistory.add(row.student_id);
    }
  }

  return withHistory;
}
