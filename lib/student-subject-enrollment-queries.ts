import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  orderStudentsByGenderThenName,
  sortStudentsByGenderThenName,
} from "@/lib/student-list-order";
import {
  type SubjectEnrollmentTerm,
  currentAcademicYear,
  getCurrentAcademicYearAndTerm,
} from "@/lib/student-subject-enrollment";

export type EnrollmentDb = SupabaseClient<Database>;

export { getCurrentAcademicYearAndTerm };

/** Map report-card academic year string (e.g. "2025/2026") to enrolment integer year. */
export function reportAcademicYearToEnrollmentYear(reportYear: string): number {
  const m = reportYear.trim().match(/\d{4}/);
  return m ? parseInt(m[0], 10) : currentAcademicYear();
}

async function studentHasAnyEnrollmentForClassTerm(
  client: EnrollmentDb,
  studentId: string,
  classId: string,
  academicYear: number,
  term: SubjectEnrollmentTerm
): Promise<boolean> {
  const { data, error } = await client
    .from("student_subject_enrollment")
    .select("id")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("academic_year", academicYear)
    .eq("term", term)
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * Students in a class for attendance/marks, filtered by subject enrolment when
 * `subjectId` is set. If a student has **no** rows in `student_subject_enrollment`
 * for this class/year/term, they are treated as taking **all** subjects (backward compatible).
 */
export async function getStudentsForSubject(
  client: EnrollmentDb,
  params: {
    classId: string;
    subjectId: string | null;
    academicYear: number;
    term: SubjectEnrollmentTerm;
    enrollmentDateOnOrBefore?: string | null;
  }
): Promise<{ id: string; full_name: string; gender: string | null }[]> {
  const {
    classId,
    subjectId,
    academicYear,
    term,
    enrollmentDateOnOrBefore,
  } = params;

  let q = client
    .from("students")
    .select("id, full_name, gender")
    .eq("class_id", classId)
    .eq("status", "active");
  if (enrollmentDateOnOrBefore) {
    q = q.lte("enrollment_date", enrollmentDateOnOrBefore);
  }
  const { data: studentRows, error } = await orderStudentsByGenderThenName(q);
  if (error || !studentRows?.length) return [];

  let list = studentRows as {
    id: string;
    full_name: string;
    gender: string | null;
  }[];

  if (!subjectId) {
    return sortStudentsByGenderThenName(list).map(({ id, full_name, gender }) => ({
      id,
      full_name,
      gender,
    }));
  }

  const { data: enrollRows } = await client
    .from("student_subject_enrollment")
    .select("student_id, subject_id")
    .eq("class_id", classId)
    .eq("academic_year", academicYear)
    .eq("term", term);

  const rows = (enrollRows ?? []) as {
    student_id: string;
    subject_id: string;
  }[];
  const studentsWithAny = new Set(rows.map((r) => r.student_id));
  const inSubject = new Set(
    rows.filter((r) => r.subject_id === subjectId).map((r) => r.student_id)
  );

  list = list.filter((s) => {
    if (!studentsWithAny.has(s.id)) return true;
    return inSubject.has(s.id);
  });

  return sortStudentsByGenderThenName(list).map(({ id, full_name, gender }) => ({
    id,
    full_name,
    gender,
  }));
}

/**
 * Subject labels (teacher’s class list) visible for this student’s report card,
 * restricted to enrolled subjects when the student has enrolment rows for the
 * class/period. Otherwise returns `teacherSubjectLabels` unchanged.
 */
export async function getStudentEnrolledSubjects(
  client: EnrollmentDb,
  params: {
    studentId: string;
    classId: string;
    academicYear: number;
    term: SubjectEnrollmentTerm;
    teacherSubjectLabels: string[];
  }
): Promise<string[]> {
  const { studentId, classId, academicYear, term, teacherSubjectLabels } =
    params;
  const labels = [...new Set(teacherSubjectLabels.map((s) => s.trim()).filter(Boolean))];
  if (labels.length === 0) return [];

  const hasAny = await studentHasAnyEnrollmentForClassTerm(
    client,
    studentId,
    classId,
    academicYear,
    term
  );
  if (!hasAny) return labels;

  const { data: enrollRows } = await client
    .from("student_subject_enrollment")
    .select("subjects(name)")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("academic_year", academicYear)
    .eq("term", term);

  const names = new Set<string>();
  for (const r of (enrollRows ?? []) as { subjects: { name: string } | null }[]) {
    const n = r.subjects?.name?.trim();
    if (n) names.add(n);
  }

  const lowerToCanonical = new Map(
    labels.map((s) => [s.toLowerCase(), s] as const)
  );
  const out: string[] = [];
  for (const n of names) {
    const canon = lowerToCanonical.get(n.toLowerCase());
    if (canon) out.push(canon);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out.length > 0 ? out : labels;
}
