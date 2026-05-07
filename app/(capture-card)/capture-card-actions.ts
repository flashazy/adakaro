"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkStudentLimit } from "@/lib/plan-limits";
import { todayIsoLocal } from "@/lib/enrollment-date";
import type { Database } from "@/types/supabase";
import { STUDENT_AVATAR_MAX_BYTES } from "@/lib/student-avatar-canvas";
import { stripTrailingSlash } from "@/lib/utils";
import {
  clearCaptureCardSessionCookie,
  readCaptureCardSession,
} from "@/lib/capture-card/session";
import { formatPersonName } from "@/lib/format-person-name";
import {
  currentAcademicYear,
  parseSubjectEnrollmentTerm,
  type SubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";
import { replaceStudentSubjectEnrollments } from "@/lib/student-subject-enrollment-write";

const AVATAR_NAMES = ["avatar.webp", "avatar.jpg", "avatar.png"] as const;
const ACTION_TIMEOUT_MS = 15_000;
/** Max attempts to allocate + insert when admission_number collides (race or counter drift). */
const CAPTURE_CARD_ADMISSION_MAX_ATTEMPTS = 3;
const CAPTURE_CARD_LOG = "[capture-card createStudent]";

type StudentInsert = Database["public"]["Tables"]["students"]["Insert"];

function isAdmissionUniqueViolation(err: {
  code?: string;
  message?: string;
}): boolean {
  const msg = err.message ?? "";
  return (
    err.code === "23505" ||
    msg.includes("students_school_id_admission_number_key") ||
    msg.includes("duplicate key")
  );
}

function parseSubjectEnrollmentFields(formData: FormData): {
  subjectIds: string[];
  academicYear: number;
  term: SubjectEnrollmentTerm | null;
  error: string | null;
} {
  const subjectIds = formData
    .getAll("subject_ids")
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  const subjectYearRaw = (
    formData.get("subject_academic_year") as string | null
  )?.trim();
  const academicYear =
    subjectYearRaw !== "" && subjectYearRaw != null
      ? Number(subjectYearRaw)
      : currentAcademicYear();
  const term = parseSubjectEnrollmentTerm(
    formData.get("subject_term") as string
  );

  if (subjectIds.length === 0) {
    return { subjectIds, academicYear, term, error: null };
  }
  if (
    !Number.isInteger(academicYear) ||
    academicYear < 2000 ||
    academicYear > 2100
  ) {
    return {
      subjectIds,
      academicYear,
      term,
      error: "Enter a valid academic year for subject enrolment.",
    };
  }
  if (!term) {
    return {
      subjectIds,
      academicYear,
      term: null,
      error: "Select Term 1 or Term 2 for subject enrolment.",
    };
  }
  return { subjectIds, academicYear, term, error: null };
}

function friendlyAdmissionRpcError(message: string): string | null {
  if (
    message.includes("School has no admission prefix") ||
    message.includes("admission prefix set")
  ) {
    return "Could not create an admission number. Ask your admin to set a school admission prefix.";
  }
  if (message.includes("Not authenticated") || message.includes("Forbidden")) {
    return "Could not allocate an admission number. Please sign in again.";
  }
  return null;
}

async function withTimeout<T>(
  label: string,
  p: PromiseLike<T> | Promise<T>
): Promise<T> {
  let t: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out`)), ACTION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
}

function publicStudentAvatarUrl(studentId: string, objectName: string): string {
  const base = stripTrailingSlash(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const rev = Date.now();
  return `${base}/storage/v1/object/public/student-avatars/${studentId}/${objectName}?rev=${rev}`;
}

async function requireCaptureSession() {
  const session = await readCaptureCardSession();
  // Preferred: cookie session
  if (session) {
    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch {
      redirect("/login");
    }

    const { data: ccu } = await withTimeout(
      "capture_card_users lookup",
      admin
        .from("capture_card_users")
        .select(
          "id, school_id, requires_approval, is_active, expires_at, auth_user_id"
        )
        .eq("id", session.ccuId)
        .maybeSingle()
    );
    const row = ccu as {
      id: string;
      school_id: string;
      requires_approval: boolean;
      is_active: boolean;
      expires_at: string | null;
      auth_user_id: string;
    } | null;
    if (!row || !row.is_active) {
      await clearCaptureCardSessionCookie();
      redirect("/login");
    }
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      await clearCaptureCardSessionCookie();
      redirect("/login");
    }
    if (row.school_id !== session.schoolId) {
      await clearCaptureCardSessionCookie();
      redirect("/login");
    }
    return { admin, ccu: row };
  }

  // Fallback: Supabase-authenticated capture user
  const supabase = await createClient();
  const {
    data: { user },
  } = await withTimeout("auth.getUser", supabase.auth.getUser());
  if (!user) redirect("/login");
  const { data: profile } = await withTimeout(
    "profiles lookup",
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  );
  if ((profile as { role?: string } | null)?.role !== "capture_card_user") {
    redirect("/login");
  }
  const { data: ccuRow } = await withTimeout(
    "capture_card_users lookup",
    supabase
      .from("capture_card_users")
      .select(
        "id, school_id, requires_approval, is_active, expires_at, auth_user_id"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle()
  );
  const row = ccuRow as {
    id: string;
    school_id: string;
    requires_approval: boolean;
    is_active: boolean;
    expires_at: string | null;
    auth_user_id: string;
  } | null;
  if (!row || !row.is_active) redirect("/login");
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    redirect("/login");
  }
  // For legacy mode we will use the user-session client for DB mutations.
  return {
    admin: supabase as unknown as ReturnType<typeof createAdminClient>,
    ccu: row,
  };
}

function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest: unknown }).digest === "string" &&
    String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

/**
 * Subjects linked to the class via `subject_classes` (same as dashboard
 * `getSubjectsForClass` — verified against the capture card user's school).
 */
export async function getCaptureCardSubjectsForClass(
  classId: string
): Promise<{ id: string; name: string }[]> {
  try {
    const { admin, ccu } = await withTimeout(
      "requireCaptureSession subjects",
      requireCaptureSession()
    );
    const schoolId = ccu.school_id;
    const trimmedClassId = classId.trim();
    if (!trimmedClassId) return [];

    const { data: klass } = await admin
      .from("classes")
      .select("id, school_id")
      .eq("id", trimmedClassId)
      .maybeSingle();

    const c = klass as { id: string; school_id: string } | null;
    if (!c || c.school_id !== schoolId) return [];

    const { data: linkRows, error: linkErr } = await admin
      .from("subject_classes")
      .select("subject_id")
      .eq("class_id", trimmedClassId);

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
  } catch (e) {
    if (isNextRedirectError(e)) throw e;
    return [];
  }
}

/**
 * Uses DB atomic sequence (`schools.admission_prefix` + `school_admission_counters`),
 * same as dashboard enrollment via `get_next_admission_number`.
 */
async function allocateNextAdmissionNumber(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string
): Promise<{ admissionNumber: string } | { error: string }> {
  const { data, error } = await admin.rpc("get_next_admission_number", {
    p_school_id: schoolId,
  } as never);

  if (error) {
    const friendly = friendlyAdmissionRpcError(error.message);
    console.error(`${CAPTURE_CARD_LOG} get_next_admission_number RPC failed`, {
      schoolId,
      message: error.message,
      code: error.code,
    });
    return {
      error:
        friendly ??
        "Could not generate an admission number. Please try again or contact support.",
    };
  }

  const raw = data as string | null | undefined;
  const admissionNumber = typeof raw === "string" ? raw.trim() : "";
  if (!admissionNumber) {
    return {
      error:
        "Could not create an admission number. Ask your admin to set a school admission prefix.",
    };
  }

  console.info(
    `${CAPTURE_CARD_LOG} generated admission number`,
    { schoolId, admissionNumber }
  );

  return { admissionNumber };
}

async function admissionNumberExistsForSchool(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  admissionNumber: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .eq("admission_number", admissionNumber)
    .maybeSingle();

  if (error) {
    console.error(`${CAPTURE_CARD_LOG} admission duplicate check failed`, {
      schoolId,
      admissionNumber,
      message: error.message,
    });
    throw new Error(error.message);
  }

  return data != null;
}

async function createStudent(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  insertBase: Omit<StudentInsert, "admission_number">
): Promise<{ ok: true; studentId: string } | { error: string }> {
  for (
    let attempt = 1;
    attempt <= CAPTURE_CARD_ADMISSION_MAX_ATTEMPTS;
    attempt++
  ) {
    const allocated = await withTimeout(
      `get_next_admission_number attempt ${attempt}`,
      allocateNextAdmissionNumber(admin, schoolId)
    );

    if ("error" in allocated) {
      return { error: allocated.error };
    }

    const { admissionNumber } = allocated;

    let exists = false;
    try {
      exists = await withTimeout(
        `admission exists check attempt ${attempt}`,
        admissionNumberExistsForSchool(admin, schoolId, admissionNumber)
      );
    } catch (e) {
      return {
        error:
          e instanceof Error ? e.message : "Could not verify admission number.",
      };
    }

    if (exists) {
      console.warn(
        `${CAPTURE_CARD_LOG} admission number already exists for school; retrying`,
        { schoolId, admissionNumber, attempt }
      );
      continue;
    }

    const insertRow: StudentInsert = {
      ...insertBase,
      admission_number: admissionNumber,
    };

    const { data: inserted, error: insErr } = await withTimeout(
      `students insert attempt ${attempt}`,
      admin.from("students").insert(insertRow as never).select("id").single()
    );

    if (!insErr) {
      const studentId = (inserted as { id: string } | null)?.id ?? "";
      console.info(`${CAPTURE_CARD_LOG} inserted student`, {
        schoolId,
        admissionNumber,
        studentId,
        attempt,
      });
      return { ok: true as const, studentId };
    }

    if (isAdmissionUniqueViolation(insErr)) {
      console.warn(
        `${CAPTURE_CARD_LOG} insert duplicate admission_number; retrying`,
        {
          schoolId,
          admissionNumber,
          attempt,
          message: insErr.message,
        }
      );
      continue;
    }

    return { error: insErr.message };
  }

  return {
    error:
      "Could not assign a unique admission number after several attempts. Please try again or contact support.",
  };
}

export type CaptureCardLogoutState = { error?: string };

export async function signOutCaptureCardAction(
  _prevState: CaptureCardLogoutState,
  _formData: FormData
): Promise<CaptureCardLogoutState> {
  const trace = `[capture-logout] id=${Math.random().toString(36).slice(2, 10)}`;
  try {
    await clearCaptureCardSessionCookie();
  } catch (e) {
    console.error(`${trace} clearCaptureCardSessionCookie failed`, e);
    return { error: "Could not clear your session cookie. Please try again." };
  }

  try {
    const supabase = await createClient();
    // Prefer local sign-out (no network) to guarantee cookies are cleared even
    // if Supabase is temporarily unreachable.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.auth.signOut as any)({ scope: "local" });
    if (error) {
      console.error(`${trace} supabase signOut(local) error`, {
        message: error.message,
      });
      // Still redirect: cookie session is cleared; we don't want to strand users.
    } else {
      console.info(`${trace} supabase signOut(local) ok`);
    }
  } catch (e) {
    console.error(`${trace} supabase signOut threw`, e);
    // Still redirect: cookie session is cleared; user can proceed to /login.
  }

  console.info(`${trace} redirect /login`);
  redirect("/login");
}

export async function createCaptureCardStudentAction(formData: FormData) {
  let admin: ReturnType<typeof createAdminClient>;
  let ccu: {
    id: string;
    school_id: string;
    requires_approval: boolean;
    is_active: boolean;
    expires_at: string | null;
    auth_user_id: string;
  };
  try {
    ({ admin, ccu } = await withTimeout("requireCaptureSession", requireCaptureSession()));
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Your session could not be verified. Please sign in again.",
    };
  }

  const fullName = formatPersonName(
    String(formData.get("full_name") ?? "").trim()
  );
  const classId = String(formData.get("class_id") ?? "").trim();
  const genderRaw = String(formData.get("gender") ?? "").trim();
  const parentName = formatPersonName(
    String(formData.get("parent_name") ?? "").trim()
  );
  const parentPhone = String(formData.get("parent_phone") ?? "").trim();
  const parentEmail =
    String(formData.get("parent_email") ?? "").trim() || null;
  const dob = String(formData.get("date_of_birth") ?? "").trim();
  const allergiesRaw = String(formData.get("allergies") ?? "").trim();
  const allergies = allergiesRaw ? allergiesRaw.toUpperCase() : null;
  const disabilityRaw = String(formData.get("disability") ?? "").trim();
  const disability = disabilityRaw ? disabilityRaw.toUpperCase() : null;
  const insuranceProviderRaw =
    String(formData.get("insurance_provider") ?? "").trim();
  const insuranceProvider = insuranceProviderRaw
    ? insuranceProviderRaw.toUpperCase()
    : null;
  const insurancePolicy =
    String(formData.get("insurance_policy") ?? "").trim() || null;

  if (!fullName) return { error: "Student name is required." };
  if (!classId) return { error: "Please choose a class." };
  if (genderRaw !== "male" && genderRaw !== "female") {
    return { error: "Please choose a gender." };
  }
  if (!parentName) return { error: "Parent or guardian name is required." };
  if (!parentPhone) return { error: "Parent phone number is required." };
  if (!dob) return { error: "Date of birth is required." };

  const se = parseSubjectEnrollmentFields(formData);
  if (se.subjectIds.length > 0 && se.error) {
    return { error: se.error };
  }
  if (se.subjectIds.length > 0 && !se.term) {
    return {
      error: se.error ?? "Select Term 1 or Term 2 for subject enrolment.",
    };
  }

  const approvalStatus = ccu.requires_approval ? "pending" : "approved";

  if (approvalStatus === "approved") {
    const lim = await withTimeout(
      "checkStudentLimit",
      checkStudentLimit(admin, ccu.school_id)
    );
    if (!lim.allowed) {
      return {
        error:
          "This school has reached its student limit. Ask an admin before adding more.",
      };
    }
  }

  const insertBase: Omit<StudentInsert, "admission_number"> = {
    school_id: ccu.school_id,
    class_id: classId,
    full_name: fullName,
    gender: genderRaw,
    date_of_birth: dob,
    enrollment_date: todayIsoLocal(),
    parent_name: parentName,
    parent_phone: parentPhone,
    parent_email: parentEmail,
    allergies,
    disability,
    insurance_provider: insuranceProvider,
    insurance_policy: insurancePolicy,
    enrolled_by: ccu.auth_user_id,
    approval_status: approvalStatus,
  };

  const created = await createStudent(admin, ccu.school_id, insertBase);

  if ("error" in created) {
    return { error: created.error };
  }

  const studentId = created.studentId;
  if (studentId && se.subjectIds.length > 0 && se.term) {
    try {
      await withTimeout(
        "replaceStudentSubjectEnrollments",
        replaceStudentSubjectEnrollments(admin, {
          studentId,
          classId,
          subjectIds: se.subjectIds,
          academicYear: se.academicYear,
          term: se.term,
          enrolledFrom: todayIsoLocal(),
        })
      );
    } catch (e) {
      return {
        error: `Student was saved, but subject enrolment failed: ${
          e instanceof Error ? e.message : "Unknown error"
        }`,
      };
    }
  }

  revalidatePath("/capture-card");
  return {
    ok: true as const,
    studentId: studentId ?? "",
    message:
      approvalStatus === "pending"
        ? "Student captured and sent for approval."
        : "Student enrolled successfully.",
  };
}

export async function updateCaptureCardStudentAction(
  studentId: string,
  formData: FormData,
  resubmitForApproval: boolean
) {
  let admin: ReturnType<typeof createAdminClient>;
  let ccu: { auth_user_id: string };
  try {
    ({ admin, ccu } = await withTimeout("requireCaptureSession", requireCaptureSession()));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Session expired." };
  }

  const { data: existing, error: exErr } = await withTimeout(
    "students lookup",
    admin
      .from("students")
      .select("id, approval_status, enrolled_by")
      .eq("id", studentId)
      .maybeSingle()
  );

  const ex = existing as {
    id: string;
    approval_status: string;
    enrolled_by: string | null;
  } | null;

  if (exErr || !ex || ex.enrolled_by !== ccu.auth_user_id) {
    return { error: "You cannot edit this student." };
  }
  if (ex.approval_status === "approved") {
    return { error: "Approved students can only be edited by an admin." };
  }

  const fullName = formatPersonName(
    String(formData.get("full_name") ?? "").trim()
  );
  const classId = String(formData.get("class_id") ?? "").trim();
  const genderRaw = String(formData.get("gender") ?? "").trim();
  const parentName = formatPersonName(
    String(formData.get("parent_name") ?? "").trim()
  );
  const parentPhone = String(formData.get("parent_phone") ?? "").trim();
  const parentEmail =
    String(formData.get("parent_email") ?? "").trim() || null;
  const dob = String(formData.get("date_of_birth") ?? "").trim();
  const allergiesRaw = String(formData.get("allergies") ?? "").trim();
  const allergies = allergiesRaw ? allergiesRaw.toUpperCase() : null;
  const disabilityRaw = String(formData.get("disability") ?? "").trim();
  const disability = disabilityRaw ? disabilityRaw.toUpperCase() : null;
  const insuranceProviderRaw =
    String(formData.get("insurance_provider") ?? "").trim();
  const insuranceProvider = insuranceProviderRaw
    ? insuranceProviderRaw.toUpperCase()
    : null;
  const insurancePolicy =
    String(formData.get("insurance_policy") ?? "").trim() || null;

  if (!fullName) return { error: "Student name is required." };
  if (!classId) return { error: "Please choose a class." };
  if (genderRaw !== "male" && genderRaw !== "female") {
    return { error: "Please choose a gender." };
  }
  if (!parentName) return { error: "Parent or guardian name is required." };
  if (!parentPhone) return { error: "Parent phone number is required." };
  if (!dob) return { error: "Date of birth is required." };

  const patch: Record<string, unknown> = {
    full_name: fullName,
    class_id: classId,
    gender: genderRaw,
    date_of_birth: dob,
    parent_name: parentName,
    parent_phone: parentPhone,
    parent_email: parentEmail,
    allergies,
    disability,
    insurance_provider: insuranceProvider,
    insurance_policy: insurancePolicy,
  };

  if (resubmitForApproval && ex.approval_status === "rejected") {
    patch.approval_status = "pending";
    patch.rejected_at = null;
    patch.rejection_reason = null;
  }

  const { error: upErr } = await withTimeout(
    "students update",
    admin.from("students").update(patch as never).eq("id", studentId)
  );

  if (upErr) return { error: upErr.message };

  const subjectSync = String(formData.get("subject_sync") ?? "") === "1";
  if (subjectSync) {
    const se = parseSubjectEnrollmentFields(formData);
    if (se.subjectIds.length > 0 && se.error) {
      return { error: se.error };
    }
    if (se.subjectIds.length > 0 && !se.term) {
      return { error: "Select Term 1 or Term 2 for subject enrolment." };
    }
    if (se.term) {
      try {
        await withTimeout(
          "replaceStudentSubjectEnrollments",
          replaceStudentSubjectEnrollments(admin, {
            studentId,
            classId,
            subjectIds: se.subjectIds,
            academicYear: se.academicYear,
            term: se.term,
            enrolledFrom: null,
          })
        );
      } catch (e) {
        return {
          error: `Saved student details, but subjects failed: ${
            e instanceof Error ? e.message : "Unknown error"
          }`,
        };
      }
    }
  }

  revalidatePath("/capture-card");
  return {
    ok: true as const,
    message:
      resubmitForApproval && ex.approval_status === "rejected"
        ? "Sent for approval again."
        : "Changes saved.",
  };
}

export async function uploadCaptureCardStudentPhotoAction(
  studentId: string,
  formData: FormData
): Promise<{ error?: string; ok?: true }> {
  let admin: ReturnType<typeof createAdminClient>;
  let ccu: { auth_user_id: string };
  try {
    ({ admin, ccu } = await withTimeout("requireCaptureSession", requireCaptureSession()));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Session expired." };
  }

  const { data: st, error: stErr } = await withTimeout(
    "students lookup",
    admin
      .from("students")
      .select("id, enrolled_by, approval_status")
      .eq("id", studentId)
      .maybeSingle()
  );

  const row = st as {
    id: string;
    enrolled_by: string | null;
    approval_status: string;
  } | null;

  if (stErr || !row || row.enrolled_by !== ccu.auth_user_id) {
    return { error: "You cannot update this photo." };
  }
  if (
    row.approval_status !== "pending" &&
    row.approval_status !== "rejected"
  ) {
    return { error: "You cannot change the photo for this student." };
  }

  const raw = formData.get("avatar");
  if (!(raw instanceof Blob) || raw.size === 0) {
    return { error: "No photo file was uploaded." };
  }
  if (raw.size > STUDENT_AVATAR_MAX_BYTES) {
    return { error: "Image must be 2MB or smaller." };
  }

  const mime = raw.type;
  const objectName =
    mime === "image/webp"
      ? "avatar.webp"
      : mime === "image/jpeg"
        ? "avatar.jpg"
        : mime === "image/png"
          ? "avatar.png"
          : null;

  if (!objectName) {
    return { error: "Invalid image type (use WebP, JPEG, or PNG)." };
  }

  const storagePath = `${studentId}/${objectName}`;
  const paths = AVATAR_NAMES.map((n) => `${studentId}/${n}`);
  await withTimeout(
    "storage remove",
    admin.storage.from("student-avatars").remove(paths)
  );

  const buf = await raw.arrayBuffer();
  const { error: upErr } = await withTimeout(
    "storage upload",
    admin.storage.from("student-avatars").upload(storagePath, buf, {
      upsert: true,
      contentType: mime,
      cacheControl: "3600",
    })
  );

  if (upErr) {
    return { error: upErr.message };
  }

  const url = publicStudentAvatarUrl(studentId, objectName);
  const { error: dbErr } = await withTimeout(
    "students avatar update",
    admin
      .from("students")
      .update({ avatar_url: url } as never)
      .eq("id", studentId)
  );

  if (dbErr) return { error: dbErr.message };

  revalidatePath("/capture-card");
  return { ok: true as const };
}
