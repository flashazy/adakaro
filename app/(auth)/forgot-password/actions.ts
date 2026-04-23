"use server";

import { randomBytes, randomInt } from "crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneDigits } from "@/lib/parent-recovery-phone";
import {
  isParentRecoveryPhoneRateLimited,
  PARENT_RECOVERY_RATE_LIMIT_EXCEEDED,
  recordParentRecoveryCodeIssued,
} from "@/lib/parent-recovery-in-memory-rate-limit";

const CODE_TTL_MS = 6 * 60 * 1000;

export type RequestRecoveryState = {
  error?: string;
  success?: {
    requestId: string;
    code: string;
  };
};

export type VerifyRecoveryState = {
  error?: string;
};

export async function requestParentRecoveryCode(
  _prev: RequestRecoveryState,
  formData: FormData
): Promise<RequestRecoveryState> {
  void _prev;
  const admissionRaw = String(formData.get("admission_number") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  if (!admissionRaw || !phoneRaw) {
    return { error: "Admission number and phone number are required." };
  }

  const targetDigits = normalizePhoneDigits(phoneRaw);
  if (targetDigits.length < 5) {
    return { error: "Enter a valid phone number." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return { error: "You are already signed in. Log out to recover a different account." };
  }

  // Unauthenticated users cannot call this RPC with the user client — it is
  // granted to `authenticated` only. Use the service role for this lookup.
  const { data: result, error: rpcError } = await admin.rpc(
    "lookup_student_by_admission",
    { adm_number: admissionRaw, p_prefer_school_id: null } as never
  );
  if (rpcError) {
    console.error(
      "[parent-recovery] lookup_student_by_admission",
      rpcError.message,
      rpcError
    );
    return { error: "Something went wrong. Please try again." };
  }
  const resultTyped = result as { student_id: string; school_id: string }[] | null;
  if (!resultTyped?.length) {
    return {
      error: "No student found with that admission number. Check and try again.",
    };
  }
  const { student_id } = resultTyped[0];

  const { data: links, error: linksErr } = await admin
    .from("parent_students")
    .select("parent_id")
    .eq("student_id", student_id);
  if (linksErr) {
    return { error: "Could not verify your link to this student." };
  }
  const parentIds = [
    ...new Set(
      (links as { parent_id: string }[] | null | undefined)?.map(
        (r) => r.parent_id
      ) ?? []
    ),
  ];
  if (parentIds.length === 0) {
    return {
      error:
        "We could not match a parent account to this student. If you are new, your school must approve a link first.",
    };
  }

  const { data: profs, error: profErr } = await admin
    .from("profiles")
    .select("id, email, phone, role")
    .in("id", parentIds);
  if (profErr) {
    return { error: "Could not load account details. Try again." };
  }
  const rows = (profs ?? []) as {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
  }[];
  const parentRow = rows.find(
    (r) =>
      r.role === "parent" && normalizePhoneDigits(r.phone) === targetDigits
  );
  if (!parentRow?.id) {
    return {
      error: "The phone number does not match a parent linked to this student.",
    };
  }
  if (!parentRow.email?.trim()) {
    return {
      error: "This account has no email on file. Please contact your school for help.",
    };
  }

  if (isParentRecoveryPhoneRateLimited(targetDigits)) {
    return { error: PARENT_RECOVERY_RATE_LIMIT_EXCEEDED };
  }

  await admin
    .from("password_reset_codes")
    .delete()
    .eq("parent_id", parentRow.id)
    .is("used_at", null);

  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { data: insertRows, error: insErr } = await admin
    .from("password_reset_codes")
    .insert({
      parent_id: parentRow.id,
      admission_number: admissionRaw,
      phone: targetDigits,
      code,
      expires_at: expiresAt,
    } as never)
    .select("id");

  const insertRow = insertRows?.[0] as { id: string } | undefined;
  if (insErr || !insertRow) {
    console.error("[parent-recovery] insert code", insErr);
    return { error: "Could not create a recovery code. Try again." };
  }

  recordParentRecoveryCodeIssued(targetDigits);

  return {
    success: {
      requestId: insertRow.id,
      code,
    },
  };
}

export async function verifyParentRecoveryCode(
  _prev: VerifyRecoveryState,
  formData: FormData
): Promise<VerifyRecoveryState> {
  void _prev;
  const requestId = String(formData.get("request_id") ?? "").trim();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "").trim();
  if (!requestId || !code) {
    return { error: "Request ID and 6-digit code are required." };
  }
  if (code.length !== 6) {
    return { error: "Enter the 6-digit code." };
  }

  const supabaseCheck = await createClient();
  const {
    data: { user: existing },
  } = await supabaseCheck.auth.getUser();
  if (existing) {
    return { error: "You are already signed in. Log out first to recover another account." };
  }

  const admin = createAdminClient();
  const { data: row, error: loadErr } = await admin
    .from("password_reset_codes")
    .select("id, parent_id, code, expires_at, used_at")
    .eq("id", requestId)
    .maybeSingle();

  if (loadErr || !row) {
    return { error: "This recovery request is invalid. Start over from the beginning." };
  }
  const r = row as {
    id: string;
    parent_id: string;
    code: string;
    expires_at: string;
    used_at: string | null;
  };
  if (r.used_at) {
    return { error: "This code was already used. Start a new recovery if needed." };
  }
  if (new Date(r.expires_at).getTime() <= Date.now()) {
    return { error: "This code has expired. Request a new one." };
  }
  if (r.code !== code) {
    return { error: "The code is incorrect. Try again or request a new code." };
  }

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("email, role")
    .eq("id", r.parent_id)
    .maybeSingle();
  if (pErr) {
    return { error: "Could not load your account. Try again." };
  }
  const p = profile as { email: string | null; role: string } | null;
  if (p?.role !== "parent" || !p.email?.trim()) {
    return { error: "This recovery path is not available for your account type." };
  }
  const email = p.email.trim();

  const tempPassword = randomBytes(32).toString("base64url");

  const { error: updErr } = await admin.auth.admin.updateUserById(r.parent_id, {
    password: tempPassword,
  });
  if (updErr) {
    console.error("[parent-recovery] updateUser", updErr);
    return { error: "Could not sign you in. Please try again." };
  }

  const supabase = await createClient();
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password: tempPassword,
  });
  if (signErr) {
    console.error("[parent-recovery] signIn", signErr);
    return { error: "Sign-in failed. Please try again or contact support." };
  }

  const { error: delErr } = await admin
    .from("password_reset_codes")
    .delete()
    .eq("id", r.id);
  if (delErr) {
    console.error("[parent-recovery] delete code", delErr);
  }

  const { error: recErr } = await admin
    .from("profiles")
    .update({ recovery_reset_required: true } as never)
    .eq("id", r.parent_id);
  if (recErr) {
    console.error("[parent-recovery] flag profile", recErr);
  }

  redirect("/reset-password");
}
