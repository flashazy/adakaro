import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeSchoolLevel,
  type SchoolLevel,
} from "@/lib/school-level";
import { tanzaniaLetterGrade, tanzaniaPercentFromScore } from "@/lib/tanzania-grades";
import type { StudentMarksSummaryRow } from "@/lib/teacher-student-reports-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const CHUNK = 300;

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Builds per-student averages from `teacher_scores` + `teacher_gradebook_assignments`,
 * scoped to classes in the same school as the student (matches Marks/profile logic).
 */
export async function loadStudentMarksSummariesForSchools(
  schoolIds: string[]
): Promise<StudentMarksSummaryRow[]> {
  if (schoolIds.length === 0) return [];

  const admin = createAdminClient() as Db;

  const { data: schoolRows } = await admin
    .from("schools")
    .select("id, school_level")
    .in("id", schoolIds);
  const schoolLevelById = new Map<string, SchoolLevel>();
  for (const r of (schoolRows ?? []) as {
    id: string;
    school_level: string | null;
  }[]) {
    schoolLevelById.set(r.id, normalizeSchoolLevel(r.school_level));
  }

  const { data: studentRows } = await admin
    .from("students")
    .select("id, full_name, admission_number, class_id, gender, school_id")
    .in("school_id", schoolIds)
    .order("full_name", { ascending: true });

  const students = (studentRows ?? []) as {
    id: string;
    full_name: string;
    admission_number: string | null;
    class_id: string;
    gender: "male" | "female" | null;
    school_id: string;
  }[];

  if (students.length === 0) return [];

  const classIds = [...new Set(students.map((s) => s.class_id))];
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

  const studentIds = students.map((s) => s.id);
  const schoolIdByStudent = new Map(
    students.map((s) => [s.id, s.school_id] as const)
  );

  /** studentId -> list of percentages */
  const pctLists = new Map<string, number[]>();

  for (const idGroup of chunkIds(studentIds, CHUNK)) {
    const { data: scoreRows } = await admin
      .from("teacher_scores")
      .select("student_id, assignment_id, score")
      .in("student_id", idGroup);

    const scores = (scoreRows ?? []) as {
      student_id: string;
      assignment_id: string;
      score: number | null;
    }[];
    if (scores.length === 0) continue;

    const assignmentIds = [...new Set(scores.map((s) => s.assignment_id))];
    const { data: assignRows } = await admin
      .from("teacher_gradebook_assignments")
      .select("id, max_score, class_id")
      .in("id", assignmentIds);

    const assigns = (assignRows ?? []) as {
      id: string;
      max_score: number | null;
      class_id: string;
    }[];
    const assignById = new Map(assigns.map((a) => [a.id, a]));

    const assignClassIds = [...new Set(assigns.map((a) => a.class_id))];
    const { data: classSchoolRows } = await admin
      .from("classes")
      .select("id, school_id")
      .in("id", assignClassIds);
    const schoolByClassId = new Map(
      (classSchoolRows ?? []).map((c: { id: string; school_id: string }) => [
        c.id,
        c.school_id,
      ])
    );

    for (const row of scores) {
      const sid = row.student_id;
      const studentSchool = schoolIdByStudent.get(sid);
      if (!studentSchool) continue;

      const a = assignById.get(row.assignment_id);
      if (!a) continue;
      const classSchool = schoolByClassId.get(a.class_id);
      if (classSchool !== studentSchool) continue;

      const max = Number(a.max_score);
      const sc = row.score;
      if (!Number.isFinite(max) || max <= 0 || sc == null || !Number.isFinite(sc))
        continue;
      const pct = tanzaniaPercentFromScore(sc, max);
      if (pct == null) continue;
      const list = pctLists.get(sid) ?? [];
      list.push(pct);
      pctLists.set(sid, list);
    }
  }

  return students.map((s) => {
    const list = pctLists.get(s.id) ?? [];
    const marksCount = list.length;
    let marksAveragePercent: number | null = null;
    let approximateGrade: string | null = null;
    if (marksCount > 0) {
      const sum = list.reduce((a, b) => a + b, 0);
      marksAveragePercent = Math.round((sum / marksCount) * 10) / 10;
      const level =
        schoolLevelById.get(s.school_id) ?? ("secondary" as SchoolLevel);
      approximateGrade = tanzaniaLetterGrade(marksAveragePercent, level);
    }
    return {
      id: s.id,
      full_name: s.full_name,
      admission_number: s.admission_number,
      class_name: classNameById.get(s.class_id) ?? "—",
      gender: s.gender,
      marksAveragePercent,
      marksCount,
      approximateGrade,
    };
  });
}
