"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isParentProfileRole,
  isTeacherProfileRole,
  parentMustChangePassword,
  teacherMustChangePassword,
} from "@/lib/auth-password-gate";
import { fetchProfilePasswordGateRowForUser } from "@/lib/fetch-profile-password-gate-row";
import type { Database } from "@/types/supabase";

const PASSWORD_CHANGED_SUCCESS_MESSAGE =
  "Password changed successfully! Redirecting to your dashboard...";

export type ChangePasswordState =
  | { ok: true; message: string; redirectTo: string }
  | { ok: false; error: string };

function dashboardPathForRole(role: string | null | undefined): string {
  const r = (role ?? "").toLowerCase();
  if (r === "parent") return "/parent-dashboard";
  if (r === "super_admin") return "/super-admin";
  if (r === "admin" || r === "finance" || r === "accounts") return "/dashboard";
  return "/teacher-dashboard";
}

export async function changeForcedPasswordAction(
  _prev: ChangePasswordState | null,
  formData: FormData
): Promise<ChangePasswordState> {
  const password = String(formData.get("password") ?? "").trim();
  const confirm = String(formData.get("confirm_password") ?? "").trim();

  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  const pr = await fetchProfilePasswordGateRowForUser(
    user.id,
    user.user_metadata
  );

  if (!pr) {
    return { ok: false, error: "Could not load your profile. Try signing in again." };
  }

  if (pr.role === "super_admin") {
    redirect("/super-admin");
  }
  if (pr.role === "admin") {
    redirect("/dashboard");
  }

  const isTeacher = isTeacherProfileRole(pr.role);
  const isParent = isParentProfileRole(pr.role);

  if (!isTeacher && !isParent) {
    return {
      ok: false,
      error: "This password setup page is not available for your account.",
    };
  }

  const mustChange =
    teacherMustChangePassword(pr) || parentMustChangePassword(pr);

  if (!mustChange) {
    if (isParent) redirect("/parent-dashboard");
    redirect("/teacher-dashboard");
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      error:
        process.env.NODE_ENV === "development"
          ? "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is required."
          : "Password change is temporarily unavailable. Please try again later.",
    };
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const { error: authErr } = await supabase.auth.updateUser({
    password,
    data: {
      ...meta,
      password_changed: true,
      must_change_password: false,
      password_forced_reset: false,
    },
  });
  if (authErr) {
    return { ok: false, error: authErr.message };
  }

  type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
  const profilePatch: ProfileUpdate = {
    password_changed: true,
    password_forced_reset: false,
    must_change_password: false,
    last_sign_in_at: new Date().toISOString(),
    ...(isTeacher ? { teacher_temp_password_expires_at: null } : {}),
  };

  const { error: profErr } = await admin
    .from("profiles")
    // Supabase v2 sometimes narrows update payload to `never` with our generated types.
    // Keep `profilePatch` strongly typed, and cast only at the callsite.
    .update(profilePatch as ProfileUpdate as never)
    .eq("id", user.id);

  if (profErr) {
    return {
      ok: false,
      error:
        profErr.message ||
        "Password was updated but your profile could not be marked complete. Contact support.",
    };
  }

  return {
    ok: true,
    message: PASSWORD_CHANGED_SUCCESS_MESSAGE,
    redirectTo: dashboardPathForRole(pr.role),
  };
}
