import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { normalizeTeacherDisplayName } from "@/lib/teacher-display-name";

/**
 * Supabase sign-in uses email. Teachers may type their display name instead;
 * this resolves a unique teacher row to the auth email (including synthetic
 * emails for admin-created accounts).
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
    .eq("role", "teacher");

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
        "No teacher account matches that name. Check spelling or sign in with email.",
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error:
        "More than one teacher matches that name. Please sign in with the email address on your account, or ask your school administrator.",
    };
  }
  return { ok: true, email: matches[0].email!.trim() };
}
