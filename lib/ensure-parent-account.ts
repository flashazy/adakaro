import type { createAdminClient } from "@/lib/supabase/admin";
import { buildParentAuthEmail } from "@/lib/parent-auth-email";
import { buildParentPortalLoginUrl } from "@/lib/parent-portal-login-url";
import type { ParentCredentialSheetPayload } from "@/lib/parent-credential-sheet-types";
import { normalizePhoneDigits } from "@/lib/validation";

type AdminClient = ReturnType<typeof createAdminClient>;

export type { ParentCredentialSheetPayload };

export interface EnsureParentAccountResult {
  sheet: ParentCredentialSheetPayload | null;
  /** Non-fatal: student row is still valid */
  warning?: string;
  /** Fatal for parent provisioning */
  error?: string;
}

const MIN_PHONE_PASSWORD_LEN = 6;

/**
 * After a student row exists: create or link parent by normalized phone,
 * admission-based login email, and initial password = phone digits (hashed by Supabase Auth only).
 */
export async function ensureParentAccountForEnrolledStudent(
  admin: AdminClient,
  params: {
    schoolId: string;
    studentId: string;
    admissionNumber: string | null;
    parentName: string | null;
    parentPhoneRaw: string | null;
    studentFullName: string;
  }
): Promise<EnsureParentAccountResult> {
  const {
    schoolId,
    studentId,
    admissionNumber,
    parentName,
    parentPhoneRaw,
    studentFullName,
  } = params;

  const empty: EnsureParentAccountResult = { sheet: null };

  const adm = (admissionNumber ?? "").trim();
  const parentNm = (parentName ?? "").trim();
  const phoneNorm = normalizePhoneDigits(String(parentPhoneRaw ?? ""));

  if (!parentNm || !phoneNorm) {
    return empty;
  }
  if (phoneNorm.length < MIN_PHONE_PASSWORD_LEN) {
    return {
      sheet: null,
      warning:
        "Parent phone is too short for a temporary password (min 6 digits). Parent portal account was not auto-created.",
    };
  }
  if (!adm) {
    return {
      sheet: null,
      warning:
        "No admission number on file; parent portal account was not auto-created.",
    };
  }

  const authEmail = buildParentAuthEmail(schoolId, adm);
  if (!authEmail) {
    return { sheet: null, error: "Could not build parent login identity." };
  }

  const { data: schoolRow } = await admin
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();
  const schoolName =
    (schoolRow as { name: string } | null)?.name?.trim() || "School";

  const { data: byPhoneRows } = await admin
    .from("profiles")
    .select("id, email, phone, full_name, role")
    .eq("role", "parent")
    .eq("phone", phoneNorm)
    .limit(2);

  const byPhone = byPhoneRows ?? [];
  if (byPhone.length > 1) {
    return {
      sheet: null,
      error:
        "Multiple parent accounts share this phone. Link this student manually from the dashboard.",
    };
  }

  async function linkParent(parentId: string): Promise<{ error?: string }> {
    const { error: linkErr } = await admin.from("parent_students").insert({
      parent_id: parentId,
      student_id: studentId,
    } as never);
    if (linkErr && linkErr.code !== "23505") {
      return { error: linkErr.message };
    }
    return {};
  }

  if (byPhone.length === 1) {
    const p = byPhone[0] as {
      id: string;
      full_name: string;
    };
    const link = await linkParent(p.id);
    if (link.error) {
      return { sheet: null, error: link.error };
    }
    return {
      sheet: {
        kind: "existing",
        parentName: p.full_name || parentNm,
        parentPhoneDisplay: phoneNorm,
        studentName: studentFullName,
        admissionNumber: adm,
        schoolName,
        message: "Student linked to existing parent account.",
      },
    };
  }

  const { data: profByEmail } = await admin
    .from("profiles")
    .select("id, phone, role, full_name")
    .eq("email", authEmail)
    .maybeSingle();

  const profEm = profByEmail as {
    id: string;
    phone: string | null;
    role: string;
    full_name: string;
  } | null;

  if (profEm) {
    if (profEm.role !== "parent") {
      return {
        sheet: null,
        error:
          "A parent login already exists for this admission number.",
      };
    }
    const emPhone = normalizePhoneDigits(profEm.phone ?? "");
    if (emPhone !== phoneNorm) {
      return {
        sheet: null,
        error:
          "A parent login already exists for this admission number.",
      };
    }
    const link = await linkParent(profEm.id);
    if (link.error) {
      return { sheet: null, error: link.error };
    }
    return {
      sheet: {
        kind: "existing",
        parentName: profEm.full_name || parentNm,
        parentPhoneDisplay: phoneNorm,
        studentName: studentFullName,
        admissionNumber: adm,
        schoolName,
        message: "Student linked to existing parent account.",
      },
    };
  }

  const tempPassword = phoneNorm;
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email: authEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: parentNm,
        phone: phoneNorm,
        role: "parent",
        password_changed: false,
      },
    });

  if (createErr) {
    const msg = createErr.message ?? "";
    if (
      msg.toLowerCase().includes("already") ||
      msg.toLowerCase().includes("registered") ||
      createErr.status === 422
    ) {
      return {
        sheet: null,
        error:
          "A parent login already exists for this admission number.",
      };
    }
    return { sheet: null, error: msg || "Could not create parent account." };
  }

  const userId = created.user?.id;
  if (!userId) {
    return {
      sheet: null,
      error: "Parent account creation returned no user id.",
    };
  }

  const link = await linkParent(userId);
  if (link.error) {
    return {
      sheet: null,
      error: `Parent account created but could not link student: ${link.error}`,
    };
  }

  const { error: profUpErr } = await admin
    .from("profiles")
    .update({
      must_change_password: true,
      password_changed: false,
      phone: phoneNorm,
      full_name: parentNm,
    } as never)
    .eq("id", userId);

  if (profUpErr) {
    return {
      sheet: null,
      warning: `Student linked to parent account, but profile flags could not be updated: ${profUpErr.message}`,
    };
  }

  return {
    sheet: {
      kind: "new",
      parentName: parentNm,
      parentPhoneDisplay: phoneNorm,
      studentName: studentFullName,
      admissionNumber: adm,
      username: adm,
      temporaryPassword: tempPassword,
      schoolName,
      loginUrl: buildParentPortalLoginUrl(),
    },
  };
}
