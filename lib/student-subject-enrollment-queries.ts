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
 * Students in a class for attendance/marks. When `subjectId` is set, only students
 * with a `student_subject_enrollment` row for that class, subject, academic year, and
 * term are returned. Students with no subject enrolments for the period are never
 * included for a specific subject.
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
  if (error || !studentRows?.length) {
    if (subjectId) {
      console.log(
        "[getStudentsForSubject] class roster empty or error",
        JSON.stringify({
          classId,
          subjectId,
          academicYear,
          term,
          classStudentsExpected: 0,
          enrolledForSubjectCount: 0,
          rosterReturned: 0,
          studentQueryError: error?.message ?? null,
        })
      );
    }
    return [];
  }

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

  const { data: enrollRows, error: enrollError } = await client
    .from("student_subject_enrollment")
    .select("student_id")
    .eq("class_id", classId)
    .eq("academic_year", academicYear)
    .eq("term", term)
    .eq("subject_id", subjectId);

  if (enrollError) {
    console.log(
      "[getStudentsForSubject] enrollment query failed — returning no students for subject",
      JSON.stringify({
        classId,
        subjectId,
        academicYear,
        term,
        classStudentsBeforeFilter: list.length,
        enrollError: enrollError.message,
      })
    );
    return [];
  }

  const inSubject = new Set(
    ((enrollRows ?? []) as { student_id: string }[]).map((r) => r.student_id)
  );

  const before = list.length;
  list = list.filter((s) => inSubject.has(s.id));

  console.log(
    "[getStudentsForSubject] roster vs subject enrollment",
    JSON.stringify({
      classId,
      subjectId,
      academicYear,
      term,
      classStudentsBeforeFilter: before,
      enrolledForSubjectRowCount: inSubject.size,
      rosterAfterIntersection: list.length,
    })
  );

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
