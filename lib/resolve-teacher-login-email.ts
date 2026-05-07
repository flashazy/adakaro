import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { resolveParentLoginEmailFromAdmission } from "@/lib/resolve-parent-login-email";
import { normalizeTeacherDisplayName } from "@/lib/teacher-display-name";

/**
 * Supabase sign-in uses email. Resolution order for non-email input:
 * 1) `capture_card_users` by username (case-insensitive), then
 * 2) teacher/admin `profiles` by normalized full name.
 */
export async function resolveLoginEmailForSignIn(
  admin: SupabaseClient<Database>,
  loginInput: string
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const trimmed = loginInput.trim();
  if (!trimmed) {
    return { ok: false, error: "Email or name and password are required." };
  }
  if (trimmed.includes("@")) {
    return { ok: true, email: trimmed };
  }

  const { data: ccRows, error: ccErr } = await admin
    .from("capture_card_users")
    .select("auth_email, is_active, expires_at")
    .ilike("username", trimmed);

  if (!ccErr && ccRows && ccRows.length > 0) {
    if (ccRows.length > 1) {
      return {
        ok: false,
        error:
          "That username exists for more than one school. Open the capture card link from your school, or sign in with your email address.",
      };
    }
    const row = ccRows[0] as {
      auth_email: string;
      is_active: boolean;
      expires_at: string | null;
    };
    if (!row.is_active) {
      return {
        ok: false,
        error:
          "This capture account is turned off. Ask your school admin for help.",
      };
    }
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      return {
        ok: false,
        error:
          "This capture account has expired. Ask your school admin for a new one.",
      };
    }
    const em = row.auth_email?.trim();
    if (!em) {
      return {
        ok: false,
        error:
          "Could not resolve this capture account. Ask your school admin for help.",
      };
    }
    return { ok: true, email: em };
  }

  const parentResolved = await resolveParentLoginEmailFromAdmission(
    admin,
    trimmed
  );
  if (parentResolved.ok) {
    return { ok: true, email: parentResolved.email };
  }
  if (!parentResolved.skip) {
    return { ok: false, error: parentResolved.error };
  }

  const normalized = normalizeTeacherDisplayName(trimmed);
  if (!normalized) {
    return {
      ok: false,
      error:
        "Enter your full name exactly as your school registered it, or your email address.",
    };
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .in("role", ["teacher", "admin"]);

  if (error) {
    return {
      ok: false,
      error:
        "Could not look up your account. Try again, or sign in with your email address.",
    };
  }

  const rows = (data ?? []) as {
    id: string;
    email: string | null;
    full_name: string | null;
  }[];

  const matches = rows.filter(
    (r) =>
      normalizeTeacherDisplayName(r.full_name ?? "") === normalized &&
      Boolean(r.email?.trim())
  );

  if (matches.length === 0) {
    return {
      ok: false,
      error:
        "No school account matches that name. Check spelling or sign in with email.",
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error:
        "More than one account matches that name. Please sign in with the email address on your account, or ask your school administrator.",
    };
  }
  return { ok: true, email: matches[0].email!.trim() };
}
