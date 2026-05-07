import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  getCurrentAcademicYearAndTerm,
  parseSubjectEnrollmentTerm,
  type SubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";

export interface CaptureCardInitialSubjectEnrollment {
  academic_year: number;
  term: SubjectEnrollmentTerm;
  subject_ids: string[];
}

/**
 * Prefer the current calendar academic year/term bucket if the student has
 * rows there; otherwise use the latest (year, term) pair in the DB.
 */
export async function resolveCaptureCardInitialSubjectEnrollment(
  admin: SupabaseClient<Database>,
  studentId: string
): Promise<CaptureCardInitialSubjectEnrollment> {
  const { data, error } = await admin
    .from("student_subject_enrollment")
    .select("academic_year, term, subject_id")
    .eq("student_id", studentId);

  if (error || !data?.length) {
    const d = getCurrentAcademicYearAndTerm();
    return { academic_year: d.academicYear, term: d.term, subject_ids: [] };
  }

  const rows = data as {
    academic_year: number;
    term: string;
    subject_id: string;
  }[];

  const byPair = new Map<string, Set<string>>();
  for (const r of rows) {
    const termOk = parseSubjectEnrollmentTerm(r.term);
    if (!termOk) continue;
    const k = `${r.academic_year}|${termOk}`;
    const set = byPair.get(k) ?? new Set<string>();
    set.add(r.subject_id);
    byPair.set(k, set);
  }

  const cur = getCurrentAcademicYearAndTerm();
  const curKey = `${cur.academicYear}|${cur.term}`;
  if (byPair.has(curKey)) {
    return {
      academic_year: cur.academicYear,
      term: cur.term,
      subject_ids: [...byPair.get(curKey)!],
    };
  }

  const pairs = [...byPair.keys()].sort((a, b) => {
    const [ya, ta] = a.split("|");
    const [yb, tb] = b.split("|");
    const yn = Number(ya) - Number(yb);
    if (yn !== 0) return -yn;
    return tb.localeCompare(ta);
  });
  const best = pairs[0];
  if (!best) {
    return {
      academic_year: cur.academicYear,
      term: cur.term,
      subject_ids: [],
    };
  }
  const [y, t] = best.split("|");
  const term = parseSubjectEnrollmentTerm(t);
  if (!term) {
    return {
      academic_year: cur.academicYear,
      term: cur.term,
      subject_ids: [],
    };
  }
  return {
    academic_year: Number(y),
    term,
    subject_ids: [...byPair.get(best)!],
  };
}
