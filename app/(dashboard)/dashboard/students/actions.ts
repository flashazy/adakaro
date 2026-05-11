"use server";

import { revalidatePath, unstable_noStore as noStore } from "next/cache";
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
import { replaceStudentSubjectEnrollments } from "@/lib/student-subject-enrollment-write";
import { ensureParentAccountForEnrolledStudent } from "@/lib/ensure-parent-account";
import type { ParentCredentialSheetPayload } from "@/lib/parent-credential-sheet-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * Resolves the signed-in user for school-scoped server actions.
 *
 * Prefer `getSession()` first: it reads the session from cookies without a round
 * trip to Supabase Auth. `getUser()` always calls Auth and can return no user
 * when the network times out (common in dev) even though the dashboard page
 * loaded with a valid cookie session — which surfaced as "Not authenticated".
 */
async function getSchoolId() {
  noStore();
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  let userId = session?.user?.id ?? null;

  if (!userId) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      // Auth server unreachable; session cookie may still be usable below.
      userId = null;
    }
  }

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const schoolId = await getSchoolIdForUser(supabase, userId);
  if (!schoolId) throw new Error("No school found");

  return { supabase, schoolId, userId };
}

async function requireAdminForSchool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role ?? "";
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("Only admins can approve or reject students.");
  }
}

async function allocateAdmissionNumberIfMissing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  existing: string | null
): Promise<string | null> {
  const current = (existing ?? "").trim();
  if (current) return current;
  const { data: generated, error } = await supabase.rpc(
    "get_next_admission_number",
    { p_school_id: schoolId } as never
  );
  if (error) throw new Error(error.message);
  const genText = generated as string | null | undefined;
  const out = typeof genText === "string" ? genText.trim() : "";
  return out || null;
}

async function maybeEmailParentOnApproval(params: {
  parentEmail: string | null;
  studentName: string;
  schoolId: string;
}) {
  const { parentEmail, studentName } = params;
  const email = String(parentEmail ?? "").trim();
  if (!email) return;
  // We only send if SMTP is configured. This avoids breaking approval flows
  // in dev or schools that don't configure outbound mail.
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.GMAIL_APP_PASSWORD;
  if (!host || !user || !pass) return;

  try {
    const nodemailer = (await import("nodemailer")).default;
    const port = Number(process.env.SMTP_PORT ?? "587");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"Adakaro" <${process.env.EMAIL_FROM ?? user}>`,
      to: email,
      subject: `Student approved: ${studentName}`,
      text: `Good news — ${studentName} has been approved and is now on the school list.`,
      html: `<p>Good news — <strong>${studentName}</strong> has been approved and is now on the school list.</p>`,
    });
  } catch (e) {
    console.error("[students] parent email notify failed", e);
  }
}

export async function approveStudent(studentId: string): Promise<{ error?: string; ok?: true }> {
  try {
    const { supabase, schoolId, userId } = await getSchoolId();
    await requireAdminForSchool(supabase, userId);

    const { data: st, error: stErr } = await supabase
      .from("students")
      .select("id, approval_status, admission_number, full_name, parent_email")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (stErr || !st) return { error: "Student not found." };

    const row = st as {
      id: string;
      approval_status: string;
      admission_number: string | null;
      full_name: string;
      parent_email: string | null;
    };
    if (row.approval_status !== "pending") {
      return { error: "This student is not pending approval." };
    }

    const limitCheck = await checkStudentLimit(supabase, schoolId);
    if (!limitCheck.allowed) {
      return { error: "This school has reached its student limit. Upgrade to approve more students." };
    }

    const admission = await allocateAdmissionNumberIfMissing(
      supabase,
      schoolId,
      row.admission_number
    );

    const { error: upErr } = await supabase
      .from("students")
      .update({
        approval_status: "approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
        rejected_at: null,
        rejection_reason: null,
        admission_number: admission,
      } as never)
      .eq("id", studentId)
      .eq("school_id", schoolId);
    if (upErr) return { error: upErr.message };

    void logAdminActionFromServerAction(
      userId,
      "approve_student",
      { student_id: studentId },
      schoolId
    );

    void maybeEmailParentOnApproval({
      parentEmail: row.parent_email,
      studentName: row.full_name,
      schoolId,
    });

    revalidatePath("/dashboard/students");
    return { ok: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function rejectStudent(
  studentId: string,
  reason?: string | null
): Promise<{ error?: string; ok?: true }> {
  try {
    const { supabase, schoolId, userId } = await getSchoolId();
    await requireAdminForSchool(supabase, userId);

    const { data: st, error: stErr } = await supabase
      .from("students")
      .select("id, approval_status")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (stErr || !st) return { error: "Student not found." };

    const row = st as { id: string; approval_status: string };
    if (row.approval_status !== "pending") {
      return { error: "This student is not pending approval." };
    }

    const { error: upErr } = await supabase
      .from("students")
      .update({
        approval_status: "rejected",
        rejected_at: new Date().toISOString(),
        rejection_reason: nullableTrimmedText(reason),
        approved_by: null,
        approved_at: null,
      } as never)
      .eq("id", studentId)
      .eq("school_id", schoolId);
    if (upErr) return { error: upErr.message };

    void logAdminActionFromServerAction(
      userId,
      "reject_student",
      { student_id: studentId, reason: nullableTrimmedText(reason) ?? undefined },
      schoolId
    );

    revalidatePath("/dashboard/students");
    revalidatePath("/capture-card");
    return { ok: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function bulkApprovePendingStudents(): Promise<{ error?: string; ok?: true; count?: number }> {
  try {
    const { supabase, schoolId, userId } = await getSchoolId();
    await requireAdminForSchool(supabase, userId);

    const { data: pendingRows, error: loadErr } = await supabase
      .from("students")
      .select("id, admission_number, full_name, parent_email")
      .eq("school_id", schoolId)
      .eq("approval_status", "pending")
      .limit(500);
    if (loadErr) return { error: loadErr.message };
    const rows = (pendingRows ?? []) as Array<{
      id: string;
      admission_number: string | null;
      full_name: string;
      parent_email: string | null;
    }>;
    if (rows.length === 0) return { ok: true as const, count: 0 };

    const limitCheck = await checkStudentLimit(supabase, schoolId);
    if (limitCheck.limit != null && limitCheck.current + rows.length > limitCheck.limit) {
      return { error: "Approving all pending students would exceed your plan limit." };
    }

    let approved = 0;
    for (const r of rows) {
      const admission = await allocateAdmissionNumberIfMissing(
        supabase,
        schoolId,
        r.admission_number
      );
      const { error: upErr } = await supabase
        .from("students")
        .update({
          approval_status: "approved",
          approved_by: userId,
          approved_at: new Date().toISOString(),
          rejected_at: null,
          rejection_reason: null,
          admission_number: admission,
        } as never)
        .eq("id", r.id)
        .eq("school_id", schoolId)
        .eq("approval_status", "pending");
      if (!upErr) {
        approved++;
        void maybeEmailParentOnApproval({
          parentEmail: r.parent_email,
          studentName: r.full_name,
          schoolId,
        });
      }
    }

    void logAdminActionFromServerAction(
      userId,
      "bulk_approve_students",
      { count: approved },
      schoolId
    );

    revalidatePath("/dashboard/students");
    return { ok: true as const, count: approved };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

function nullableTrimmedText(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  return t === "" ? null : t;
}

/** Matches Enrollment Desk: optional health text stored uppercase. */
function nullableTrimmedUppercase(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  return t === "" ? null : t.toUpperCase();
}

function optionalVarchar(
  formData: FormData,
  key: string,
  max: number
): string | null {
  const t = nullableTrimmedText(formData.get(key) as string | undefined);
  if (t == null) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function optionalVarcharUppercase(
  formData: FormData,
  key: string,
  max: number
): string | null {
  const t = nullableTrimmedUppercase(formData.get(key) as string | undefined);
  if (t == null) return null;
  return t.length > max ? t.slice(0, max) : t;
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
  /**
   * Real server-issued id of the just-created student. Filled in by
   * `addStudent`. Required by the offline sync queue (Phase 3) so the
   * client can map a `temp_…` id to the real UUID and rewrite any
   * downstream queued mutations (attendance, grades, payments).
   */
  studentId?: string;
  /**
   * True when the action stopped because a likely duplicate already
   * exists in the same school. The offline sync layer surfaces this in
   * the conflict UI; the user can then either accept the existing row
   * (point the temp id at it) or force-create by submitting again with
   * `force_duplicate=1`.
   */
  conflict?: boolean;
  /**
   * True when `parent_phone` matches another student; online form shows
   * Proceed/Cancel. Re-submit with `force_duplicate_phone=1` to insert.
   * Still sets `conflict` + `duplicateCandidates` for offline sync.
   */
  phoneDuplicateConflict?: boolean;
  /** First matching student's name when `phoneDuplicateConflict` is true. */
  existingStudentForPhone?: string;
  /**
   * Existing rows that triggered the duplicate match — used to render
   * "Possible duplicate of …" in the conflict modal. Only populated
   * when `conflict === true`.
   */
  duplicateCandidates?: Array<{
    id: string;
    full_name: string;
    admission_number: string | null;
    parent_phone: string | null;
    class_id: string | null;
  }>;
  /** Shown once after admin enrollment when parent portal auto-provisioning ran */
  parentCredentialSheet?: ParentCredentialSheetPayload;
  parentCredentialWarning?: string;
  parentCredentialError?: string;
}

/** Escape `%` / `_` / `\` for use as an ILIKE pattern (exact match, case-insensitive). */
function escapeIlikeExact(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

async function findStudentsByParentPhone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  parentPhone: string | null
): Promise<
  Array<{
    id: string;
    full_name: string;
    admission_number: string | null;
    parent_phone: string | null;
    class_id: string | null;
  }>
> {
  const trimmed = parentPhone?.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, admission_number, parent_phone, class_id")
    .eq("school_id", schoolId)
    .eq("approval_status", "approved")
    .eq("parent_phone", trimmed)
    .limit(5);

  if (error || !data) return [];
  return data as Array<{
    id: string;
    full_name: string;
    admission_number: string | null;
    parent_phone: string | null;
    class_id: string | null;
  }>;
}

/**
 * Lightweight check for the add-student form: same full name (case-insensitive)
 * already exists. Does not block creation; used for an inline warning only.
 */
export async function peekStudentCreateNameDuplicate(
  fullName: string
): Promise<{ matches: string[] }> {
  const trimmed = fullName.trim();
  if (trimmed.length < 2) return { matches: [] };
  try {
    const { supabase, schoolId } = await getSchoolId();
    const pattern = escapeIlikeExact(trimmed);
    const { data, error } = await supabase
      .from("students")
      .select("full_name")
      .eq("school_id", schoolId)
      .eq("approval_status", "approved")
      .ilike("full_name", pattern)
      .limit(15);

    if (error || !data?.length) return { matches: [] };
    const names = [
      ...new Set(
        (data as { full_name: string }[])
          .map((r) => r.full_name.trim())
          .filter(Boolean)
      ),
    ];
    return { matches: names };
  } catch {
    return { matches: [] };
  }
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

  const dobRaw = (formData.get("date_of_birth") as string)?.trim() ?? "";
  if (dobRaw === "") {
    return { error: "Date of birth is required." };
  }
  const dobParsed = parseOptionalEnrollmentDate(dobRaw);
  if (dobParsed.error || !dobParsed.iso) {
    return {
      error: dobParsed.error ?? "Enter a valid date of birth (YYYY-MM-DD).",
    };
  }

  const allergies = nullableTrimmedUppercase(formData.get("allergies") as string);
  const disability = nullableTrimmedUppercase(formData.get("disability") as string);
  const insurance_provider = optionalVarcharUppercase(
    formData,
    "insurance_provider",
    255
  );
  const insurance_policy = optionalVarchar(formData, "insurance_policy", 255);

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

    // Parent phone duplicate: block until confirmed online (`force_duplicate_phone=1`)
    // or bypassed for offline (`force_duplicate=1`). Admission uniqueness is
    // still enforced by the database (23505). Same-name siblings are allowed.
    const forceDuplicate =
      String(formData.get("force_duplicate") ?? "") === "1";
    const forceDuplicatePhone =
      String(formData.get("force_duplicate_phone") ?? "") === "1";
    if (!forceDuplicate && !forceDuplicatePhone) {
      const phoneDupes = await findStudentsByParentPhone(
        supabase,
        schoolId,
        parentPhone
      );
      if (phoneDupes.length > 0) {
        const existingName = phoneDupes[0].full_name;
        return {
          conflict: true,
          phoneDuplicateConflict: true,
          existingStudentForPhone: existingName,
          duplicateCandidates: phoneDupes,
        };
      }
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
        date_of_birth: dobParsed.iso,
        allergies,
        disability,
        insurance_provider,
        insurance_policy,
        enrolled_by: userId,
        approval_status: "approved",
      } as never)
      .select("id, admission_number, full_name")
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          error: "This admission number is already in use for another student.",
        };
      }
      return { error: error.message };
    }

    const insertedRow = inserted as {
      id: string;
      admission_number: string | null;
      full_name: string;
    } | null;
    const newId = insertedRow?.id;
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

    let parentCredentialSheet: ParentCredentialSheetPayload | undefined;
    let parentCredentialWarning: string | undefined;
    let parentCredentialError: string | undefined;
    if (newId) {
      try {
        const adminSvc = createAdminClient();
        const provision = await ensureParentAccountForEnrolledStudent(
          adminSvc,
          {
            schoolId,
            studentId: newId,
            admissionNumber:
              insertedRow?.admission_number ?? admissionNumber,
            parentName,
            parentPhoneRaw: parentPhone,
            studentFullName: insertedRow?.full_name ?? fullName,
          }
        );
        if (provision.sheet) parentCredentialSheet = provision.sheet;
        if (provision.warning) parentCredentialWarning = provision.warning;
        if (provision.error) parentCredentialError = provision.error;
      } catch {
        parentCredentialWarning =
          "Could not finish parent portal setup. You can link the parent manually later.";
      }
    }

    return {
      success: `Student "${fullName}" added.`,
      // Returned for the offline sync queue — see the field comment in
      // `StudentActionState`. Existing callers that ignore extra fields
      // (the standard `useActionState` pattern) are unaffected.
      studentId: newId ?? undefined,
      parentCredentialSheet,
      parentCredentialWarning,
      parentCredentialError,
    };
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

  const dobRaw = (formData.get("date_of_birth") as string)?.trim() ?? "";
  let date_of_birth: string | null = null;
  if (dobRaw !== "") {
    const dobParsed = parseOptionalEnrollmentDate(dobRaw);
    if (dobParsed.error || !dobParsed.iso) {
      return {
        error: dobParsed.error ?? "Enter a valid date of birth (YYYY-MM-DD).",
      };
    }
    date_of_birth = dobParsed.iso;
  }

  const allergies = nullableTrimmedText(formData.get("allergies") as string);
  const disability = nullableTrimmedText(formData.get("disability") as string);
  const insurance_provider = optionalVarchar(formData, "insurance_provider", 255);
  const insurance_policy = optionalVarchar(formData, "insurance_policy", 255);

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
        date_of_birth,
        allergies,
        disability,
        insurance_provider,
        insurance_policy,
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

/** Used by the delete confirmation UI and `deleteStudent` (plain-language copy for staff). */
export interface StudentDeletionEligibility {
  paymentCount: number;
  receiptCount: number;
  reportCardCommentCount: number;
  reportCardsCount: number;
  teacherScoreCount: number;
  teacherAttendanceCount: number;
  /** One-click delete: no fees on file and no teacher notes blocking. */
  canDelete: boolean;
  /** Fees clear but teacher notes exist — full remove needs the “all records” button or hide. */
  canDeleteWithReportCascade: boolean;
  /** Show “hide” when notes block full remove or when fees/receipts block full remove. */
  canArchiveInstead: boolean;
  /** Short headline for the dialog */
  summaryLine: string;
  /** Why full remove may not be available (fees / receipts). */
  financeBlockerLines: string[];
  /** Why an extra remove step is needed (teacher notes). */
  cascadeBlockerLines: string[];
  /** What else disappears if staff proceed with delete (scores, attendance, etc.). */
  includedWithDeleteLines: string[];
}

async function computeStudentDeletionEligibility(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string
): Promise<StudentDeletionEligibility> {
  const { count: paymentCountRaw, error: paymentErr } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (paymentErr) {
    throw new Error(paymentErr.message);
  }

  const paymentCount = paymentCountRaw ?? 0;

  let receiptCount = 0;
  if (paymentCount > 0) {
    const { data: paymentRows, error: prErr } = await supabase
      .from("payments")
      .select("id")
      .eq("student_id", studentId);
    if (prErr) {
      throw new Error(prErr.message);
    }
    const ids = (paymentRows ?? []).map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      const { count: receiptCountRaw, error: recErr } = await supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .in("payment_id", ids);
      if (recErr) {
        throw new Error(recErr.message);
      }
      receiptCount = receiptCountRaw ?? 0;
    }
  }

  const { count: commentCountRaw, error: commentErr } = await supabase
    .from("teacher_report_card_comments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (commentErr) {
    throw new Error(commentErr.message);
  }
  const reportCardCommentCount = commentCountRaw ?? 0;

  const { count: reportCardsRaw, error: rcErr } = await supabase
    .from("report_cards")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (rcErr) {
    throw new Error(rcErr.message);
  }
  const reportCardsCount = reportCardsRaw ?? 0;

  const { count: scoreCountRaw, error: scoreErr } = await supabase
    .from("teacher_scores")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (scoreErr) {
    throw new Error(scoreErr.message);
  }
  const teacherScoreCount = scoreCountRaw ?? 0;

  const { count: attCountRaw, error: attErr } = await supabase
    .from("teacher_attendance")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (attErr) {
    throw new Error(attErr.message);
  }
  const teacherAttendanceCount = attCountRaw ?? 0;

  const financeClear = paymentCount === 0 && receiptCount === 0;
  const commentsBlock = reportCardCommentCount > 0;
  const canDelete = financeClear && !commentsBlock;
  const canDeleteWithReportCascade = financeClear && commentsBlock;
  const canArchiveInstead = canDeleteWithReportCascade || !financeClear;

  const financeBlockerLines: string[] = [];
  if (paymentCount > 0) {
    financeBlockerLines.push("Has school fees recorded.");
  }
  if (receiptCount > 0) {
    financeBlockerLines.push("Has payment receipts on file.");
  }

  const cascadeBlockerLines: string[] = [];
  if (reportCardCommentCount > 0) {
    cascadeBlockerLines.push("Has teacher notes on the report card.");
  }

  const includedWithDeleteLines: string[] = [];
  if (financeClear) {
    if (teacherScoreCount > 0) {
      includedWithDeleteLines.push("Has exam scores — these will be removed if you delete.");
    }
    if (teacherAttendanceCount > 0) {
      includedWithDeleteLines.push(
        "Has attendance records — these will be removed if you delete."
      );
    }
    if (commentsBlock) {
      if (reportCardsCount > 0) {
        includedWithDeleteLines.push(
          "“Delete student and all records” also removes those teacher notes and the linked report card pages, along with scores and attendance above."
        );
      } else {
        includedWithDeleteLines.push(
          "“Delete student and all records” also removes those teacher notes, along with scores and attendance above."
        );
      }
    } else if (reportCardsCount > 0) {
      includedWithDeleteLines.push(
        "Report card pages on file will be removed with this student."
      );
    }
    if (
      teacherScoreCount === 0 &&
      teacherAttendanceCount === 0 &&
      !commentsBlock &&
      reportCardsCount === 0
    ) {
      includedWithDeleteLines.push(
        "No exam scores, attendance, or report card pages on file."
      );
    }
  }

  let summaryLine: string;
  if (canDelete) {
    summaryLine = "Ready to delete. No school fees recorded.";
  } else if (canDeleteWithReportCascade) {
    summaryLine =
      "This student has teacher notes on file. Delete them with the student, or hide the student and keep everything.";
  } else {
    summaryLine =
      "This student has school fees recorded. They can’t be fully removed from the system yet. You can hide them instead (keeps all records), or clear the fees first.";
  }

  return {
    paymentCount,
    receiptCount,
    reportCardCommentCount,
    reportCardsCount,
    teacherScoreCount,
    teacherAttendanceCount,
    canDelete,
    canDeleteWithReportCascade,
    canArchiveInstead,
    summaryLine,
    financeBlockerLines,
    cascadeBlockerLines,
    includedWithDeleteLines,
  };
}

/** Pre-delete check for the staff-facing remove / hide dialog (plain-language strings). */
export async function getStudentDeletionEligibility(
  studentId: string
): Promise<
  { ok: true; eligibility: StudentDeletionEligibility } | { ok: false; error: string }
> {
  try {
    const { supabase, schoolId } = await getSchoolId();

    const { data: student, error: stErr } = await supabase
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (stErr) {
      return { ok: false, error: stErr.message };
    }
    if (!student) {
      return {
        ok: false,
        error: "Student not found or you do not have access.",
      };
    }

    const eligibility = await computeStudentDeletionEligibility(
      supabase,
      studentId
    );
    return { ok: true, eligibility };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function removeReportCardRowsForStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string
): Promise<{ error?: string }> {
  const { error: cErr } = await supabase
    .from("teacher_report_card_comments")
    .delete()
    .eq("student_id", studentId);

  if (cErr) {
    return {
      error: `We couldn’t clear teacher notes before removing this student. ${cErr.message}`,
    };
  }

  const { error: rErr } = await supabase
    .from("report_cards")
    .delete()
    .eq("student_id", studentId);

  if (rErr) {
    return {
      error: `We couldn’t clear report card pages before removing this student. ${rErr.message}`,
    };
  }

  return {};
}

/**
 * Gradebook scores and class attendance reference the student. Repo migrations use
 * ON DELETE CASCADE, but some databases still have RESTRICT — remove explicitly
 * so accidental enrollments delete cleanly when finance is clear.
 */
async function removeGradebookScoresAndAttendanceForStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string
): Promise<{ error?: string }> {
  const { error: scoresErr } = await supabase
    .from("teacher_scores")
    .delete()
    .eq("student_id", studentId);

  if (scoresErr) {
    return {
      error: `We couldn’t clear exam scores before removing this student. ${scoresErr.message}`,
    };
  }

  const { error: attErr } = await supabase
    .from("teacher_attendance")
    .delete()
    .eq("student_id", studentId);

  if (attErr) {
    return {
      error: `We couldn’t clear attendance before removing this student. ${attErr.message}`,
    };
  }

  return {};
}

export async function deleteStudent(
  studentId: string,
  options?: { removeReportCardData?: boolean }
): Promise<StudentActionState> {
  try {
    const { supabase, schoolId, userId } = await getSchoolId();
    await requireAdminForSchool(supabase, userId);

    const { data: student, error: stErr } = await supabase
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (stErr) {
      return { error: stErr.message };
    }
    if (!student) {
      return { error: "Student not found or you do not have access." };
    }

    const elig = await computeStudentDeletionEligibility(supabase, studentId);
    const financeClear =
      elig.paymentCount === 0 && elig.receiptCount === 0;

    if (options?.removeReportCardData) {
      if (!financeClear) {
        return {
          error:
            "School fees or receipts are still on file. Clear those first, or hide the student instead.",
        };
      }
      const rm = await removeReportCardRowsForStudent(supabase, studentId);
      if (rm.error) {
        return { error: rm.error };
      }
    } else {
      if (!elig.canDelete) {
        if (elig.canDeleteWithReportCascade) {
          const parts = [
            ...elig.financeBlockerLines,
            ...elig.cascadeBlockerLines,
          ].join(" ");
          return {
            error: `${elig.summaryLine} ${parts}`.trim(),
          };
        }
        const extra = [
          ...elig.financeBlockerLines,
          ...elig.cascadeBlockerLines,
        ].join(" ");
        return {
          error: `${elig.summaryLine}${extra ? ` ${extra}` : ""}`.trim(),
        };
      }
    }

    if (financeClear) {
      const ga = await removeGradebookScoresAndAttendanceForStudent(
        supabase,
        studentId
      );
      if (ga.error) {
        return { error: ga.error };
      }
    }

    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId)
      .eq("school_id", schoolId);

    if (error) {
      if (error.code === "23503") {
        return {
          error:
            "Something is still tied to this student and we couldn’t finish the removal. Please try again shortly, or ask for help if it keeps happening.",
        };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/students");

    void logAdminActionFromServerAction(
      userId,
      "delete_student",
      {
        student_id: studentId,
        removed_report_card_data: Boolean(options?.removeReportCardData),
        removed_gradebook_scores_and_attendance: financeClear,
      },
      schoolId
    );

    return {
      success: options?.removeReportCardData
        ? "Student removed. Notes and report pages were cleared too."
        : "Student removed from the school list.",
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Soft-remove: sets `status` to `inactive` so the student drops off the default
 * dashboard list while keeping finance and academic history intact.
 */
export async function archiveStudent(
  studentId: string
): Promise<StudentActionState> {
  try {
    const { supabase, schoolId, userId } = await getSchoolId();
    await requireAdminForSchool(supabase, userId);

    const { data: student, error: stErr } = await supabase
      .from("students")
      .select("id, status")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (stErr) {
      return { error: stErr.message };
    }
    if (!student) {
      return { error: "Student not found or you do not have access." };
    }

    const { error } = await supabase
      .from("students")
      .update({ status: "inactive" } as never)
      .eq("id", studentId)
      .eq("school_id", schoolId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/students");

    void logAdminActionFromServerAction(
      userId,
      "archive_student",
      { student_id: studentId },
      schoolId
    );

    return {
      success:
        "Student hidden. They no longer show on this list, but all records stay in the system.",
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
