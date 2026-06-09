import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { SubjectEnrollmentTerm } from "@/lib/student-subject-enrollment";
import { todayIsoLocal } from "@/lib/enrollment-date";
import { reportStudentSubjectEnrollmentFailure } from "@/lib/watchdog/health-alert-reporters";

export async function assertSubjectsAllowedForClass(
  supabase: SupabaseClient<Database>,
  classId: string,
  subjectIds: string[]
): Promise<void> {
  if (subjectIds.length === 0) return;
  const { data, error } = await supabase
    .from("subject_classes")
    .select("subject_id")
    .eq("class_id", classId)
    .in("subject_id", subjectIds);
  if (error) throw new Error(error.message);
  const allowed = new Set(
    (data ?? []).map((r) => (r as { subject_id: string }).subject_id)
  );
  for (const id of subjectIds) {
    if (!allowed.has(id)) {
      throw new Error(
        "One or more selected subjects are not offered for this class."
      );
    }
  }
}

/**
 * Replace all subject enrolments for a student for one academic year + term.
 * Deletes existing rows for that slice, then inserts the given subjects.
 */
export async function replaceStudentSubjectEnrollments(
  supabase: SupabaseClient<Database>,
  params: {
    studentId: string;
    classId: string;
    subjectIds: string[];
    academicYear: number;
    term: SubjectEnrollmentTerm;
    enrolledFrom?: string | null;
  }
): Promise<void> {
  const { studentId, classId, subjectIds, academicYear, term, enrolledFrom } =
    params;
  const uniqueIds = [...new Set(subjectIds.filter(Boolean))];
  await assertSubjectsAllowedForClass(supabase, classId, uniqueIds);

  const { error: delErr } = await supabase
    .from("student_subject_enrollment")
    .delete()
    .eq("student_id", studentId)
    .eq("academic_year", academicYear)
    .eq("term", term);

  if (delErr) {
    reportStudentSubjectEnrollmentFailure({
      phase: "delete_before_replace",
      student_id: studentId,
      class_id: classId,
      academic_year: academicYear,
      term,
      error: delErr.message,
    });
    throw new Error(delErr.message);
  }

  if (uniqueIds.length === 0) return;

  const from =
    enrolledFrom && enrolledFrom.trim() !== ""
      ? enrolledFrom.trim()
      : todayIsoLocal();

  const rows = uniqueIds.map((subject_id) => ({
    student_id: studentId,
    subject_id,
    class_id: classId,
    academic_year: academicYear,
    term,
    enrolled_from: from,
  }));

  const { error: insErr } = await supabase
    .from("student_subject_enrollment")
    .insert(rows as never);

  if (insErr) {
    reportStudentSubjectEnrollmentFailure({
      phase: "insert_after_delete",
      student_id: studentId,
      class_id: classId,
      academic_year: academicYear,
      term,
      subject_count: uniqueIds.length,
      error: insErr.message,
    });
    throw new Error(insErr.message);
  }
}
