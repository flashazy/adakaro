import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneDigits } from "@/lib/validation";

/**
 * Validate and normalize a class teacher contact phone for `profiles.phone`.
 * Blank input clears the saved number.
 */
export function validateAndNormalizeClassTeacherPhone(
  raw: string
): { ok: true; phone: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, phone: null };
  }

  const compact = trimmed.replace(/\s/g, "");
  if (!/^\+?[0-9]+$/.test(compact)) {
    return {
      ok: false,
      error:
        "Use digits only, with an optional + at the start (e.g. +255712345678).",
    };
  }

  const digits = normalizePhoneDigits(compact);
  if (digits.length < 9) {
    return {
      ok: false,
      error: "Enter a valid phone number (e.g. +255712345678).",
    };
  }

  let normalized: string;
  if (digits.startsWith("255") && digits.length >= 12) {
    normalized = `+${digits.slice(0, 12)}`;
  } else if (digits.startsWith("0") && digits.length >= 10) {
    normalized = `+255${digits.slice(1, 10)}`;
  } else if (digits.length === 9) {
    normalized = `+255${digits}`;
  } else if (compact.startsWith("+")) {
    if (digits.length > 15) {
      return {
        ok: false,
        error: "That phone number looks too long. Check and try again.",
      };
    }
    normalized = `+${digits}`;
  } else {
    return {
      ok: false,
      error:
        "Enter a valid Tanzania phone number (e.g. +255712345678 or 0712345678).",
    };
  }

  return { ok: true, phone: normalized };
}

/** Load `profiles.phone` for the signed-in class teacher (server-only). */
export async function loadClassTeacherOwnPhone(
  teacherId: string
): Promise<string | null> {
  const id = teacherId.trim();
  if (!id) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const raw = (data as { phone: string | null }).phone?.trim();
  return raw && raw.length > 0 ? raw : null;
}
