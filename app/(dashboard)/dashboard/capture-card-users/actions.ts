"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
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
