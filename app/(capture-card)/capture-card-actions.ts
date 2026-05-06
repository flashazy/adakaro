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

const AVATAR_NAMES = ["avatar.webp", "avatar.jpg", "avatar.png"] as const;
const ACTION_TIMEOUT_MS = 15_000;

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

  const fullName = String(formData.get("full_name") ?? "").trim();
  const classId = String(formData.get("class_id") ?? "").trim();
  const genderRaw = String(formData.get("gender") ?? "").trim();
  const parentName = String(formData.get("parent_name") ?? "").trim();
  const parentPhone = String(formData.get("parent_phone") ?? "").trim();
  const parentEmail =
    String(formData.get("parent_email") ?? "").trim() || null;
  const dob = String(formData.get("date_of_birth") ?? "").trim();
  const allergies =
    String(formData.get("allergies") ?? "").trim() || null;
  const disability =
    String(formData.get("disability") ?? "").trim() || null;
  const insuranceProvider =
    String(formData.get("insurance_provider") ?? "").trim() || null;
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

  const admissionNumber = await withTimeout(
    "getNextAdmissionNumber",
    getNextAdmissionNumber(admin, ccu.school_id)
  );
  if (!admissionNumber) {
    return {
      error:
        "Could not create an admission number. Ask your admin to set a school admission prefix.",
    };
  }

  const insertRow: Database["public"]["Tables"]["students"]["Insert"] = {
    school_id: ccu.school_id,
    class_id: classId,
    full_name: fullName,
    admission_number: admissionNumber,
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

  const { data: inserted, error: insErr } = await withTimeout(
    "students insert",
    admin.from("students").insert(insertRow as never).select("id").single()
  );

  if (insErr) {
    return { error: insErr.message };
  }

  const studentId = (inserted as { id: string } | null)?.id;
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

  const fullName = String(formData.get("full_name") ?? "").trim();
  const classId = String(formData.get("class_id") ?? "").trim();
  const genderRaw = String(formData.get("gender") ?? "").trim();
  const parentName = String(formData.get("parent_name") ?? "").trim();
  const parentPhone = String(formData.get("parent_phone") ?? "").trim();
  const parentEmail =
    String(formData.get("parent_email") ?? "").trim() || null;
  const dob = String(formData.get("date_of_birth") ?? "").trim();
  const allergies =
    String(formData.get("allergies") ?? "").trim() || null;
  const disability =
    String(formData.get("disability") ?? "").trim() || null;
  const insuranceProvider =
    String(formData.get("insurance_provider") ?? "").trim() || null;
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

async function getNextAdmissionNumber(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string
): Promise<string | null> {
  const { data: schoolRow } = await admin
    .from("schools")
    .select("admission_prefix")
    .eq("id", schoolId)
    .maybeSingle();
  const prefix = (schoolRow as { admission_prefix: string | null } | null)
    ?.admission_prefix;
  const p = String(prefix ?? "").trim();
  if (!p) return null;

  const { data: counterRow } = await admin
    .from("school_admission_counters")
    .select("next_number")
    .eq("school_id", schoolId)
    .maybeSingle();
  const next = (counterRow as { next_number: number } | null)?.next_number;

  if (typeof next !== "number" || !Number.isFinite(next) || next <= 0) {
    // Initialize counter; next_number stored as "next to assign".
    await admin
      .from("school_admission_counters")
      .insert({ school_id: schoolId, next_number: 2 } as never);
    return `${p}-${String(1).padStart(3, "0")}`;
  }

  await admin
    .from("school_admission_counters")
    .update({ next_number: next + 1, updated_at: new Date().toISOString() } as never)
    .eq("school_id", schoolId);

  return `${p}-${String(next).padStart(3, "0")}`;
}
