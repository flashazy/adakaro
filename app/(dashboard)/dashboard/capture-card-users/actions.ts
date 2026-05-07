"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import {
  generateEnrollmentDeskAccessRawToken,
  hashEnrollmentDeskAccessToken,
} from "@/lib/enrollment-desk/token-crypto";
import type { Database } from "@/types/supabase";

function randomPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const b = randomBytes(16);
  let s = "";
  for (let i = 0; i < 14; i++) {
    s += chars[b[i]! % chars.length];
  }
  return s;
}

/**
 * Synthetic email for Supabase Auth (unique per school + username).
 * Used with signInWithPassword; capture login resolves row by school + username.
 */
function buildCaptureAuthEmail(username: string, schoolId: string): string {
  const normalized =
    username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "user";
  const safeUser = normalized.slice(0, 80);
  return `capture_${safeUser}_${schoolId}@capture.local`;
}

async function requireSchoolAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.error("[capture-card-users] requireSchoolAdmin getUser:", authError);
  }
  if (!user) {
    throw new Error("Not authenticated.");
  }

  const { data: rpcSchoolId, error: schoolRpcError } =
    await supabase.rpc("get_my_school_id");
  if (schoolRpcError) {
    console.error(
      "[capture-card-users] requireSchoolAdmin get_my_school_id:",
      schoolRpcError
    );
  }
  let schoolId =
    rpcSchoolId != null && String(rpcSchoolId).length > 0
      ? (rpcSchoolId as string)
      : null;
  if (!schoolId) {
    schoolId = await getSchoolIdForUser(supabase, user.id);
  }
  if (!schoolId) {
    console.error("[capture-card-users] requireSchoolAdmin no school_id", {
      userId: user.id,
      rpcSchoolId,
      schoolRpcError: schoolRpcError?.message,
    });
    throw new Error("No school found.");
  }

  const { data: isAdmin, error: adminRpcError } = await supabase.rpc(
    "is_school_admin",
    { p_school_id: schoolId } as never
  );
  if (adminRpcError) {
    console.error(
      "[capture-card-users] requireSchoolAdmin is_school_admin:",
      adminRpcError
    );
  }
  if (!isAdmin) {
    console.error("[capture-card-users] requireSchoolAdmin forbidden", {
      userId: user.id,
      schoolId,
    });
    throw new Error("Forbidden.");
  }
  return { supabase, user, schoolId };
}

export async function createCaptureCardUserAction(formData: FormData): Promise<
  | { error: string }
  | {
      ok: true;
      username: string;
      password: string;
      loginUrl: string;
      schoolId: string;
    }
> {
  try {
    // Per-request cookie client (anon key + user session). Same pattern as
    // @supabase/ssr / deprecated createServerComponentClient — not service_role.
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
      console.error("[createCaptureCardUser] getUser:", userError);
    }
    if (!user) {
      console.error("[createCaptureCardUser] no session user");
      return {
        error:
          "Your session could not be verified. Please sign in again and retry.",
      };
    }

    const { data: schoolId, error: schoolError } =
      await supabase.rpc("get_my_school_id");
    if (schoolError) {
      console.error("[createCaptureCardUser] get_my_school_id:", schoolError);
      return {
        error: "Could not determine your school. Please contact support.",
      };
    }
    if (schoolId == null || String(schoolId).length === 0) {
      console.error("[createCaptureCardUser] get_my_school_id empty", {
        userId: user.id,
      });
      return {
        error: "Could not determine your school. Please contact support.",
      };
    }

    const { data: isAdmin, error: adminRpcError } = await supabase.rpc(
      "is_school_admin",
      { p_school_id: schoolId } as never
    );
    if (adminRpcError) {
      console.error("[createCaptureCardUser] is_school_admin:", adminRpcError);
      return {
        error: "Could not verify admin access. Please contact support.",
      };
    }
    if (!isAdmin) {
      console.error("[createCaptureCardUser] not school admin", {
        userId: user.id,
        schoolId,
      });
      return {
        error:
          "You don't have permission to create Enrollment Desk users for this school.",
      };
    }

    const username = String(formData.get("username") ?? "").trim();
    if (username.length < 2) {
      return { error: "Username must be at least 2 characters." };
    }

    const autoPassword =
      String(formData.get("auto_password") ?? "") === "1" ||
      String(formData.get("auto_password") ?? "") === "on";
    let password = String(formData.get("password") ?? "").trim();
    if (autoPassword) {
      password = randomPassword();
    } else if (password.length < 8) {
      return {
        error: "Password must be at least 8 characters when not auto-generated.",
      };
    }

    const expiresRaw = String(formData.get("expires_at") ?? "").trim();
    const expires_at =
      expiresRaw.length > 0 ? new Date(expiresRaw).toISOString() : null;
    if (expires_at && Number.isNaN(new Date(expires_at).getTime())) {
      return { error: "Enter a valid expiry date or leave it blank." };
    }

    const requiresApproval = formData.get("requires_approval") != null;

    const admin = createAdminClient();
    const id = crypto.randomUUID();
    const auth_email = buildCaptureAuthEmail(username, schoolId);

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: auth_email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "capture_card_user",
        full_name: username,
        password_changed: true,
      },
    });

    if (cErr || !created.user) {
      console.error("[createCaptureCardUser] auth.admin.createUser:", cErr);
      return {
        error: cErr?.message ?? "Could not create the sign-in for this user.",
      };
    }

    // handle_new_user trigger inserts profiles from JWT metadata; upsert ensures role + email.
    const { error: profileErr } = await admin.from("profiles").upsert(
      {
        id: created.user.id,
        full_name: username,
        email: auth_email,
        role: "capture_card_user",
        password_changed: true,
      } as never,
      { onConflict: "id" }
    );
    if (profileErr) {
      console.error("[createCaptureCardUser] profiles upsert:", profileErr);
      await admin.auth.admin.deleteUser(created.user.id);
      return { error: profileErr.message };
    }

    const row: Database["public"]["Tables"]["capture_card_users"]["Insert"] = {
      id,
      school_id: schoolId,
      username,
      auth_email,
      auth_user_id: created.user.id,
      created_by: user.id,
      expires_at,
      requires_approval: requiresApproval,
      is_active: true,
    };

    const { error: insErr } = await supabase
      .from("capture_card_users")
      .insert(row as never);

    if (insErr) {
      console.error("[createCaptureCardUser] capture_card_users insert:", insErr);
      await admin.auth.admin.deleteUser(created.user.id);
      return { error: insErr.message };
    }

    revalidatePath("/dashboard/capture-card-users");

    const loginUrl = `/capture-card/login?school=${encodeURIComponent(schoolId)}`;

    return {
      ok: true,
      username,
      password,
      loginUrl,
      schoolId,
    };
  } catch (e) {
    console.error("[createCaptureCardUser] unexpected:", e);
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function setCaptureCardUserActiveAction(
  captureUserId: string,
  isActive: boolean
): Promise<{ error?: string; ok?: true }> {
  try {
    const { schoolId, supabase } = await requireSchoolAdmin();
    const { data: row, error: qErr } = await supabase
      .from("capture_card_users")
      .select("id, school_id")
      .eq("id", captureUserId)
      .maybeSingle();

    const r = row as { id: string; school_id: string } | null;
    if (qErr || !r || r.school_id !== schoolId) {
      return { error: "User not found." };
    }

    const { error: uErr } = await supabase
      .from("capture_card_users")
      .update({ is_active: isActive } as never)
      .eq("id", captureUserId);

    if (uErr) return { error: uErr.message };
    revalidatePath("/dashboard/capture-card-users");
    return { ok: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function resetCaptureCardUserPasswordAction(
  captureUserId: string,
  newPassword: string
): Promise<{ error?: string; ok?: true; password?: string }> {
  try {
    const { schoolId, supabase } = await requireSchoolAdmin();
    const pw = newPassword.trim();
    if (pw.length < 8) {
      return { error: "Password must be at least 8 characters." };
    }

    const { data: row, error: qErr } = await supabase
      .from("capture_card_users")
      .select("school_id, auth_user_id")
      .eq("id", captureUserId)
      .maybeSingle();

    const r = row as { school_id: string; auth_user_id: string } | null;
    if (qErr || !r || r.school_id !== schoolId) {
      return { error: "User not found." };
    }

    const admin = createAdminClient();
    const { error: uErr } = await admin.auth.admin.updateUserById(
      r.auth_user_id,
      { password: pw }
    );
    if (uErr) return { error: uErr.message };
    revalidatePath("/dashboard/capture-card-users");
    return { ok: true as const, password: pw };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteCaptureCardUserAction(
  captureUserId: string
): Promise<{ error?: string; ok?: true }> {
  try {
    const { schoolId, supabase } = await requireSchoolAdmin();
    const { data: row, error: qErr } = await supabase
      .from("capture_card_users")
      .select("school_id, auth_user_id")
      .eq("id", captureUserId)
      .maybeSingle();

    const r = row as { school_id: string; auth_user_id: string } | null;
    if (qErr || !r || r.school_id !== schoolId) {
      return { error: "User not found." };
    }

    const { count, error: cntErr } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("enrolled_by", r.auth_user_id);

    if (!cntErr && count != null && count > 0) {
      return {
        error:
          "This account already captured students. Disable it instead of deleting.",
      };
    }

    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(r.auth_user_id);
    revalidatePath("/dashboard/capture-card-users");
    return { ok: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

function getPublicSiteOrigin(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (u) {
    return u.includes("://") ? u : `https://${u}`;
  }
  const v = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (v) {
    return v.includes("://") ? v : `https://${v}`;
  }
  return "http://localhost:3000";
}

function validateQrExpiry(exp: Date): string | null {
  const now = Date.now();
  const t = exp.getTime();
  if (Number.isNaN(t)) {
    return "Invalid expiry date.";
  }
  if (t <= now + 60_000) {
    return "Expiry must be at least one minute from now.";
  }
  if (t > now + 366 * 24 * 60 * 60 * 1000) {
    return "Expiry is too far in the future (max 1 year).";
  }
  return null;
}

async function issueEnrollmentDeskQrAccessToken(
  supabase: SupabaseClient<Database>,
  params: {
    adminUserId: string;
    schoolId: string;
    captureCardUserId: string;
    expiresAt: Date;
    revokeUnusedFirst: boolean;
  }
): Promise<{ rawToken: string } | { error: string }> {
  if (params.revokeUnusedFirst) {
    const nowIso = new Date().toISOString();
    await supabase
      .from("enrollment_desk_access_tokens")
      .update({ revoked_at: nowIso } as never)
      .eq("school_id", params.schoolId)
      .eq("capture_card_user_id", params.captureCardUserId)
      .is("revoked_at", null)
      .is("used_at", null);
  }

  const raw = generateEnrollmentDeskAccessRawToken();
  const tokenHash = hashEnrollmentDeskAccessToken(raw);

  const { error: insErr } = await supabase
    .from("enrollment_desk_access_tokens")
    .insert({
      capture_card_user_id: params.captureCardUserId,
      school_id: params.schoolId,
      token_hash: tokenHash,
      expires_at: params.expiresAt.toISOString(),
      created_by: params.adminUserId,
    } as never);

  if (insErr) {
    console.error("[issueEnrollmentDeskQrAccessToken] insert:", insErr);
    return { error: insErr.message };
  }
  return { rawToken: raw };
}

async function assertCaptureUserForQr(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  captureCardUserId: string
): Promise<
  | {
      ok: true;
      row: {
        id: string;
        school_id: string;
        is_active: boolean;
        expires_at: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const { data: row, error: qErr } = await supabase
    .from("capture_card_users")
    .select("id, school_id, is_active, expires_at")
    .eq("id", captureCardUserId)
    .maybeSingle();

  const r = row as {
    id: string;
    school_id: string;
    is_active: boolean;
    expires_at: string | null;
  } | null;

  if (qErr || !r || r.school_id !== schoolId) {
    return { ok: false, error: "User not found." };
  }
  if (!r.is_active) {
    return { ok: false, error: "Enable this account before generating QR access." };
  }
  if (r.expires_at && new Date(r.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: "This account is expired. Update expiry first." };
  }
  return { ok: true, row: r };
}

export async function generateEnrollmentDeskQrAccessAction(
  captureCardUserId: string,
  expiresAtIso: string
): Promise<
  { error: string } | { ok: true; accessUrl: string; expiresAt: string }
> {
  try {
    const { supabase, user, schoolId } = await requireSchoolAdmin();
    const exp = new Date(expiresAtIso);
    const expErr = validateQrExpiry(exp);
    if (expErr) {
      return { error: expErr };
    }

    const cc = await assertCaptureUserForQr(supabase, schoolId, captureCardUserId);
    if (!cc.ok) {
      return { error: cc.error };
    }

    if (cc.row.expires_at) {
      const accountExp = new Date(cc.row.expires_at).getTime();
      if (exp.getTime() > accountExp) {
        return {
          error:
            "QR expiry cannot be later than this desk account’s expiry. Extend the account first or pick an earlier time.",
        };
      }
    }

    const issued = await issueEnrollmentDeskQrAccessToken(supabase, {
      adminUserId: user.id,
      schoolId,
      captureCardUserId,
      expiresAt: exp,
      revokeUnusedFirst: false,
    });

    if ("error" in issued) {
      return { error: issued.error };
    }

    revalidatePath("/dashboard/capture-card-users");

    const origin = getPublicSiteOrigin();
    const accessUrl = `${origin}/enrollment-desk/access?token=${encodeURIComponent(issued.rawToken)}`;

    return {
      ok: true as const,
      accessUrl,
      expiresAt: exp.toISOString(),
    };
  } catch (e) {
    console.error("[generateEnrollmentDeskQrAccess]", e);
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/**
 * Revokes any unused (not yet scanned) QR links for this desk and issues one new link.
 */
export async function regenerateEnrollmentDeskQrLinkAction(
  captureCardUserId: string,
  expiresAtIso: string
): Promise<
  { error: string } | { ok: true; accessUrl: string; expiresAt: string }
> {
  try {
    const { supabase, user, schoolId } = await requireSchoolAdmin();
    const exp = new Date(expiresAtIso);
    const expErr = validateQrExpiry(exp);
    if (expErr) {
      return { error: expErr };
    }

    const cc = await assertCaptureUserForQr(supabase, schoolId, captureCardUserId);
    if (!cc.ok) {
      return { error: cc.error };
    }

    if (cc.row.expires_at) {
      const accountExp = new Date(cc.row.expires_at).getTime();
      if (exp.getTime() > accountExp) {
        return {
          error:
            "QR expiry cannot be later than this desk account’s expiry. Extend the account first or pick an earlier time.",
        };
      }
    }

    const issued = await issueEnrollmentDeskQrAccessToken(supabase, {
      adminUserId: user.id,
      schoolId,
      captureCardUserId,
      expiresAt: exp,
      revokeUnusedFirst: true,
    });

    if ("error" in issued) {
      return { error: issued.error };
    }

    revalidatePath("/dashboard/capture-card-users");

    const origin = getPublicSiteOrigin();
    const accessUrl = `${origin}/enrollment-desk/access?token=${encodeURIComponent(issued.rawToken)}`;

    return {
      ok: true as const,
      accessUrl,
      expiresAt: exp.toISOString(),
    };
  } catch (e) {
    console.error("[regenerateEnrollmentDeskQrLink]", e);
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

function quickDeskUsernameCandidate(): string {
  const part = randomBytes(8).toString("base64url").replace(/-/g, "x").slice(0, 12);
  return `desk_${part}`;
}

export async function createQuickQrDeskAction(input: {
  deskLabel: string;
  expiresAtIso: string;
  requiresApproval: boolean;
  helperNote: string;
}): Promise<
  | { error: string }
  | {
      ok: true;
      accessUrl: string;
      expiresAt: string;
      deskLabel: string;
      requiresApproval: boolean;
      username: string;
      password: string;
      captureCardUserId: string;
      helperNote: string | null;
    }
> {
  try {
    const { supabase, user, schoolId } = await requireSchoolAdmin();

    const deskLabel = input.deskLabel.trim();
    if (deskLabel.length < 1) {
      return { error: "Add a short desk name (for example Reception or Desk 1)." };
    }
    if (deskLabel.length > 80) {
      return { error: "Desk name is too long (max 80 characters)." };
    }

    const note = input.helperNote.trim();
    if (note.length > 500) {
      return { error: "Note is too long (max 500 characters)." };
    }
    const quick_qr_note = note.length > 0 ? note : null;

    const exp = new Date(input.expiresAtIso);
    const expErr = validateQrExpiry(exp);
    if (expErr) {
      return { error: expErr };
    }

    const expires_at = exp.toISOString();
    const password = randomPassword();
    const password_hash = await bcrypt.hash(password, 10);
    const admin = createAdminClient();

    let username = "";
    let insertErr: { message: string } | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      username = quickDeskUsernameCandidate();
      const auth_email = buildCaptureAuthEmail(username, schoolId);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: auth_email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "capture_card_user",
          full_name: deskLabel,
          password_changed: true,
        },
      });

      if (cErr || !created.user) {
        console.error("[createQuickQrDesk] auth.admin.createUser:", cErr);
        return {
          error: cErr?.message ?? "Could not create the sign-in for this desk.",
        };
      }

      const { error: profileErr } = await admin.from("profiles").upsert(
        {
          id: created.user.id,
          full_name: deskLabel,
          email: auth_email,
          role: "capture_card_user",
          password_changed: true,
        } as never,
        { onConflict: "id" }
      );
      if (profileErr) {
        console.error("[createQuickQrDesk] profiles upsert:", profileErr);
        await admin.auth.admin.deleteUser(created.user.id);
        return { error: profileErr.message };
      }

      const id = crypto.randomUUID();
      const row: Database["public"]["Tables"]["capture_card_users"]["Insert"] =
        {
          id,
          school_id: schoolId,
          username,
          auth_email,
          auth_user_id: created.user.id,
          created_by: user.id,
          expires_at,
          requires_approval: input.requiresApproval,
          is_active: true,
          is_quick_qr_user: true,
          quick_qr_label: deskLabel,
          quick_qr_note,
          password_hash,
        };

      const { error: insErr } = await supabase
        .from("capture_card_users")
        .insert(row as never);

      if (!insErr) {
        const issued = await issueEnrollmentDeskQrAccessToken(supabase, {
          adminUserId: user.id,
          schoolId,
          captureCardUserId: id,
          expiresAt: exp,
          revokeUnusedFirst: false,
        });

        if ("error" in issued) {
          await supabase.from("capture_card_users").delete().eq("id", id);
          await admin.auth.admin.deleteUser(created.user.id);
          return { error: issued.error };
        }

        revalidatePath("/dashboard/capture-card-users");

        const origin = getPublicSiteOrigin();
        const accessUrl = `${origin}/enrollment-desk/access?token=${encodeURIComponent(issued.rawToken)}`;

        return {
          ok: true as const,
          accessUrl,
          expiresAt: exp.toISOString(),
          deskLabel,
          requiresApproval: input.requiresApproval,
          username,
          password,
          captureCardUserId: id,
          helperNote: quick_qr_note,
        };
      }

      insertErr = insErr;
      await admin.auth.admin.deleteUser(created.user.id);

      const msg = insErr.message.toLowerCase();
      const isUniqueViolation =
        msg.includes("unique") ||
        msg.includes("duplicate") ||
        msg.includes("idx_capture_card_users");
      if (!isUniqueViolation) {
        console.error("[createQuickQrDesk] capture_card_users insert:", insErr);
        return { error: insErr.message };
      }
    }

    console.error("[createQuickQrDesk] exhausted username retries", insertErr);
    return {
      error:
        "Could not create a unique login name after several tries. Please try again.",
    };
  } catch (e) {
    console.error("[createQuickQrDesk] unexpected:", e);
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function revokeEnrollmentDeskQrAccessAction(
  captureCardUserId: string
): Promise<{ error?: string; ok?: true }> {
  try {
    const { schoolId, supabase } = await requireSchoolAdmin();

    const { data: row, error: qErr } = await supabase
      .from("capture_card_users")
      .select("id, school_id")
      .eq("id", captureCardUserId)
      .maybeSingle();

    const r = row as { id: string; school_id: string } | null;
    if (qErr || !r || r.school_id !== schoolId) {
      return { error: "User not found." };
    }

    const nowIso = new Date().toISOString();
    const { error: uErr } = await supabase
      .from("enrollment_desk_access_tokens")
      .update({ revoked_at: nowIso } as never)
      .eq("school_id", schoolId)
      .eq("capture_card_user_id", captureCardUserId)
      .is("revoked_at", null)
      .is("used_at", null);

    if (uErr) return { error: uErr.message };
    revalidatePath("/dashboard/capture-card-users");
    return { ok: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
