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
import { resolveClassCluster } from "@/lib/class-cluster";

export type EnrollmentDb = SupabaseClient<Database>;

export { getCurrentAcademicYearAndTerm };

/**
 * In-memory ascending sort by `admission_number`. Missing / blank numbers are
 * pushed to the end so they don't hijack the top of the list. Numeric-looking
 * numbers compare numerically so "A002" < "A010".
 */
function compareAdmissionNumbers(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const ax = (a ?? "").trim();
  const bx = (b ?? "").trim();
  if (!ax && !bx) return 0;
  if (!ax) return 1;
  if (!bx) return -1;
  const an = Number(ax);
  const bn = Number(bx);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return ax.localeCompare(bx, undefined, { numeric: true, sensitivity: "base" });
}

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

  // Multi-stream: only expand the roster when `classId` is itself a parent
  // class (e.g. FORM ONE) with child streams. A stream-specific exam (e.g.
  // FORM 1A) must keep its roster scoped to that one class so teachers don't
  // accidentally enter scores for the whole cohort.
  const cluster = await resolveClassCluster(client, classId);
  const clusterHasStreams =
    cluster.isParent && cluster.childClassIds.length > 0;
  const effectiveClassIds = clusterHasStreams ? cluster.classIds : [classId];

  let q = client
    .from("students")
    .select("id, full_name, gender, admission_number, class_id")
    .eq("status", "active")
    .in("class_id", effectiveClassIds);
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
    admission_number: string | null;
  }[];

  // Cross-stream mode: sort strictly by admission_number so a parent-class
  // exam shows every student across streams in a single numeric order (per
  // the Phase 3 spec). Single-class mode keeps the existing gender/name sort
  // to avoid changing behaviour for schools that never adopt streams.
  if (!subjectId) {
    if (clusterHasStreams) {
      const ordered = [...list].sort((a, b) =>
        compareAdmissionNumbers(a.admission_number, b.admission_number)
      );
      return ordered.map(({ id, full_name, gender }) => ({
        id,
        full_name,
        gender,
      }));
    }
    return sortStudentsByGenderThenName(list).map(({ id, full_name, gender }) => ({
      id,
      full_name,
      gender,
    }));
  }

  const { data: enrollRows, error: enrollError } = await client
    .from("student_subject_enrollment")
    .select("student_id")
    .in("class_id", effectiveClassIds)
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
      clusterClassCount: effectiveClassIds.length,
    })
  );

  if (clusterHasStreams) {
    const ordered = [...list].sort((a, b) =>
      compareAdmissionNumbers(a.admission_number, b.admission_number)
    );
    return ordered.map(({ id, full_name, gender }) => ({
      id,
      full_name,
      gender,
    }));
  }

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
