"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminActionFromServerAction } from "@/lib/admin-activity-log";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { escapeRegExp } from "@/lib/admission-number";
import { checkStudentLimit } from "@/lib/plan-limits";
import {
  parseOptionalEnrollmentDate,
  todayIsoLocal,
} from "@/lib/enrollment-date";
import {
  currentAcademicYear,
  parseSubjectEnrollmentTerm,
  type SubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function getSchoolId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) throw new Error("No school found");

  return { supabase, schoolId, userId: user.id };
}

async function assertSubjectsAllowedForClass(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
  subjectIds: string[]
) {
  if (subjectIds.length === 0) return;
  const { data, error } = await supabase
    .from("subject_classes")
    .select("subject_id")
    .eq("class_id", classId)
    .in("subject_id", subjectIds);
  if (error) throw new Error(error.message);
  const allowed = new Set((data ?? []).map((r) => (r as { subject_id: string }).subject_id));
  for (const id of subjectIds) {
    if (!allowed.has(id)) {
      throw new Error("One or more selected subjects are not offered for this class.");
    }
  }
}

async function replaceStudentSubjectEnrollments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    studentId: string;
    classId: string;
    subjectIds: string[];
    academicYear: number;
    term: SubjectEnrollmentTerm;
    enrolledFrom?: string | null;
  }
) {
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

  if (delErr) throw new Error(delErr.message);

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

  if (insErr) throw new Error(insErr.message);
}

/**
 * Subjects linked to the class via `subject_classes` (same source as Manage Subjects).
 * Uses the service-role admin client after verifying the class belongs to the caller's
 * school so RLS cannot hide rows that admins can configure on the Subjects page.
 */
export async function getSubjectsForClass(classId: string): Promise<
  { id: string; name: string }[]
> {
  try {
    const { schoolId } = await getSchoolId();
    const admin = createAdminClient() as Db;

    const { data: klass } = await admin
      .from("classes")
      .select("id, school_id")
      .eq("id", classId)
      .maybeSingle();

    const c = klass as { id: string; school_id: string } | null;
    if (!c || c.school_id !== schoolId) return [];

    const { data: linkRows, error: linkErr } = await admin
      .from("subject_classes")
      .select("subject_id")
      .eq("class_id", classId);

    if (linkErr) return [];

    const subjectIds = [
      ...new Set(
        (linkRows ?? []).map((r: { subject_id: string }) => r.subject_id)
      ),
    ].filter(Boolean);

    if (subjectIds.length === 0) return [];

    const { data: subjectRows, error: subErr } = await admin
      .from("subjects")
      .select("id, name")
      .eq("school_id", schoolId)
      .in("id", subjectIds);

    if (subErr) return [];

    const out = (subjectRows ?? [])
      .map((s: { id: string; name: string }) => s)
      .filter((s: { id: string; name: string }) =>
        Boolean(s.id && (s.name ?? "").trim() !== "")
      );
    out.sort((a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name)
    );
    return out;
  } catch {
    return [];
  }
}

export interface StudentSubjectRow {
  subject_id: string;
  name: string;
}

export async function getStudentSubjects(
  studentId: string,
  academicYear: number,
  term: SubjectEnrollmentTerm
): Promise<StudentSubjectRow[]> {
  try {
    const { supabase, schoolId } = await getSchoolId();
    const { data: st, error: stErr } = await supabase
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (stErr || !st) return [];

    const { data, error } = await supabase
      .from("student_subject_enrollment")
      .select("subject_id, subject:subjects(name)")
      .eq("student_id", studentId)
      .eq("academic_year", academicYear)
      .eq("term", term);

    if (error) return [];

    return (data ?? []).map((row) => {
      const r = row as {
        subject_id: string;
        subject: { name: string } | null;
      };
      return {
        subject_id: r.subject_id,
        name: r.subject?.name ?? "Subject",
      };
    });
  } catch {
    return [];
  }
}

export async function enrollStudentInSubjects(
  studentId: string,
  classId: string,
  subjectIds: string[],
  academicYear: number,
  term: SubjectEnrollmentTerm,
  enrolledFrom?: string | null
): Promise<{ error?: string }> {
  try {
    const { supabase, schoolId } = await getSchoolId();

    const { data: st, error: stErr } = await supabase
      .from("students")
      .select("id, class_id")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (stErr || !st) {
      return { error: "Student not found." };
    }
    if ((st as { class_id: string }).class_id !== classId) {
      return { error: "Class does not match the student record." };
    }

    await replaceStudentSubjectEnrollments(supabase, {
      studentId,
      classId,
      subjectIds,
      academicYear,
      term,
      enrolledFrom,
    });

    revalidatePath("/dashboard/students");
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateStudentSubjects(
  studentId: string,
  subjectIds: string[],
  academicYear: number,
  term: SubjectEnrollmentTerm
): Promise<{ error?: string; success?: string }> {
  try {
    const { supabase, schoolId } = await getSchoolId();

    const { data: st, error: stErr } = await supabase
      .from("students")
      .select("class_id")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (stErr || !st) {
      return { error: "Student not found." };
    }

    const classId = (st as { class_id: string }).class_id;

    await replaceStudentSubjectEnrollments(supabase, {
      studentId,
      classId,
      subjectIds,
      academicYear,
      term,
      enrolledFrom: null,
    });

    revalidatePath("/dashboard/students");
    return { success: "Subject enrolment saved." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export interface StudentActionState {
  error?: string;
  success?: string;
}

export async function addStudent(
  _prevState: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const fullName = (formData.get("full_name") as string)?.trim();
  const snapshotField = formData.get("admission_default_snapshot");
  const admissionDefaultSnapshot =
    typeof snapshotField === "string" ? snapshotField.trim() : "";
  const admissionNumberRaw =
    (formData.get("admission_number") as string)?.trim() || null;
  const classId = (formData.get("class_id") as string)?.trim();
  const genderRaw = (formData.get("gender") as string)?.trim();
  const parentName = (formData.get("parent_name") as string)?.trim() || null;
  const parentEmail = (formData.get("parent_email") as string)?.trim() || null;
  const parentPhone = (formData.get("parent_phone") as string)?.trim() || null;
  const enrollmentDateRaw =
    (formData.get("enrollment_date") as string)?.trim() ?? "";
  const enrollmentParsed = parseOptionalEnrollmentDate(enrollmentDateRaw);
  if (enrollmentParsed.error) {
    return { error: enrollmentParsed.error };
  }
  const enrollmentDate = enrollmentParsed.iso ?? todayIsoLocal();

  const subjectIds = formData
    .getAll("subject_ids")
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  const subjectYearRaw = (formData.get("subject_academic_year") as string)?.trim();
  const subjectYearParsed =
    subjectYearRaw !== "" ? Number(subjectYearRaw) : currentAcademicYear();
  const subjectTerm = parseSubjectEnrollmentTerm(
    formData.get("subject_term") as string
  );

  if (!fullName) return { error: "Student name is required." };
  if (!classId) return { error: "Please select a class." };
  if (genderRaw !== "male" && genderRaw !== "female") {
    return { error: "Please select a gender." };
  }
  const gender = genderRaw;

  if (subjectIds.length > 0) {
    if (
      !Number.isInteger(subjectYearParsed) ||
      subjectYearParsed < 2000 ||
      subjectYearParsed > 2100
    ) {
      return { error: "Enter a valid academic year for subject enrolment." };
    }
    if (!subjectTerm) {
      return { error: "Select Term 1 or Term 2 for subject enrolment." };
    }
  }

  try {
    const { supabase, schoolId, userId } = await getSchoolId();

    let admissionNumber: string | null = null;

    function inferPrefixFromFormatted(adm: string): string | null {
      const m = adm.trim().match(/^([A-Za-z]{2,10})-(\d+)$/);
      return m ? m[1].toUpperCase() : null;
    }

    async function allocateNextAdmission(): Promise<
      { ok: true; value: string } | { ok: false; message: string }
    > {
      const { data: generated, error: genErr } = await supabase.rpc(
        "get_next_admission_number",
        { p_school_id: schoolId } as never
      );
      if (genErr) {
        return { ok: false, message: genErr.message };
      }
      const genText = generated as string | null | undefined;
      if (typeof genText !== "string" || !genText.trim()) {
        return {
          ok: false,
          message: "Could not generate an admission number.",
        };
      }
      return { ok: true, value: genText.trim() };
    }

    const submitted = admissionNumberRaw ?? "";
    const snapshot = admissionDefaultSnapshot;
    const snapshotPrefix = inferPrefixFromFormatted(snapshot);
    const stillUsingSuggested =
      snapshot !== "" && submitted !== "" && submitted === snapshot;
    const cleared = submitted === "";

    if (snapshotPrefix) {
      if (stillUsingSuggested || cleared) {
        const alloc = await allocateNextAdmission();
        if (!alloc.ok) {
          return { error: alloc.message };
        }
        admissionNumber = alloc.value;
      } else if (submitted === "") {
        admissionNumber = null;
      } else {
        admissionNumber = submitted;
        const re = new RegExp(
          `^${escapeRegExp(snapshotPrefix)}-\\d+$`,
          "i"
        );
        if (!re.test(admissionNumber)) {
          return {
            error: `Admission number should match your school format (e.g. ${snapshotPrefix}-001).`,
          };
        }
      }
    } else {
      admissionNumber =
        submitted !== "" ? submitted : null;
    }

    const limitCheck = await checkStudentLimit(supabase, schoolId);
    if (!limitCheck.allowed) {
      return {
        error:
          "You've reached your plan limit. Upgrade to add more students.",
      };
    }

    const { data: inserted, error } = await supabase
      .from("students")
      .insert({
        school_id: schoolId,
        class_id: classId,
        full_name: fullName,
        admission_number: admissionNumber,
        gender,
        enrollment_date: enrollmentDate,
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone,
      } as never)
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          error: "This admission number is already in use for another student.",
        };
      }
      return { error: error.message };
    }

    const newId = (inserted as { id: string } | null)?.id;
    if (newId && subjectIds.length > 0 && subjectTerm) {
      const enr = await enrollStudentInSubjects(
        newId,
        classId,
        subjectIds,
        subjectYearParsed,
        subjectTerm,
        enrollmentDate
      );
      if (enr.error) {
        return {
          error: `Student was added, but subject enrolment failed: ${enr.error}`,
        };
      }
    }

    revalidatePath("/dashboard/students");

    void logAdminActionFromServerAction(
      userId,
      "create_student",
      {
        class_id: classId,
        admission_number: admissionNumber ?? undefined,
      },
      schoolId
    );

    return { success: `Student "${fullName}" added.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateStudent(
  studentId: string,
  formData: FormData
): Promise<StudentActionState> {
  const fullName = (formData.get("full_name") as string)?.trim();
  const admissionNumber =
    (formData.get("admission_number") as string)?.trim() || null;
  const classId = (formData.get("class_id") as string)?.trim();
  const genderRaw = (formData.get("gender") as string)?.trim();
  const parentName = (formData.get("parent_name") as string)?.trim() || null;
  const parentEmail = (formData.get("parent_email") as string)?.trim() || null;
  const parentPhone = (formData.get("parent_phone") as string)?.trim() || null;
  const enrollmentDateRaw =
    (formData.get("enrollment_date") as string)?.trim() ?? "";
  const enrollmentParsed = parseOptionalEnrollmentDate(enrollmentDateRaw);
  if (enrollmentParsed.error) {
    return { error: enrollmentParsed.error };
  }
  if (!enrollmentParsed.iso) {
    return { error: "Enrollment date is required (YYYY-MM-DD)." };
  }

  if (!fullName) return { error: "Student name is required." };
  if (!classId) return { error: "Please select a class." };
  if (genderRaw !== "male" && genderRaw !== "female") {
    return { error: "Please select a gender." };
  }
  const gender = genderRaw;

  try {
    const { supabase, schoolId, userId } = await getSchoolId();

    const { error } = await supabase
      .from("students")
      .update({
        full_name: fullName,
        admission_number: admissionNumber,
        class_id: classId,
        gender,
        enrollment_date: enrollmentParsed.iso,
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone,
      } as never)
      .eq("id", studentId);

    if (error) {
      if (error.code === "23505") {
        return { error: `Admission number "${admissionNumber}" is already in use.` };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/students");

    void logAdminActionFromServerAction(
      userId,
      "update_student",
      { student_id: studentId, class_id: classId },
      schoolId
    );

    return { success: "Student updated." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteStudent(
  studentId: string
): Promise<StudentActionState> {
  try {
    const { supabase, schoolId, userId } = await getSchoolId();

    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId);

    if (error) {
      if (error.code === "23503") {
        return {
          error: "Cannot delete a student with existing payments or fee records.",
        };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/students");

    void logAdminActionFromServerAction(
      userId,
      "delete_student",
      { student_id: studentId },
      schoolId
    );

    return { success: "Student deleted." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
