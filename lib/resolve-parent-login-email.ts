import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { buildParentAuthEmail } from "@/lib/parent-auth-email";

type Admin = SupabaseClient<Database>;

function escapeIlikeExact(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Map parent login identifier (admission number) to the synthetic Supabase Auth email.
 * Supports approved and pending students so parents can sign in before approval.
 */
export async function resolveParentLoginEmailFromAdmission(
  admin: Admin,
  admissionInput: string
): Promise<
  { ok: true; email: string } | { ok: false; error: string; skip?: boolean }
> {
  const adm = admissionInput.trim();
  if (!adm || adm.includes("@")) {
    return { ok: false, error: "skip", skip: true };
  }

  const pattern = escapeIlikeExact(adm);

  const { data: rows, error } = await admin
    .from("students")
    .select("school_id, admission_number, approval_status")
    .in("approval_status", ["approved", "pending"])
    .not("admission_number", "is", null)
    .ilike("admission_number", pattern);

  if (error) {
    return {
      ok: false,
      error:
        "Could not look up your admission number. Try signing in with your email instead.",
    };
  }

  const matches = (rows ?? []) as {
    school_id: string;
    admission_number: string;
    approval_status: string;
  }[];

  if (matches.length === 0) {
    return { ok: false, error: "skip", skip: true };
  }

  const schools = new Set(matches.map((m) => m.school_id));
  if (schools.size > 1) {
    return {
      ok: false,
      error:
        "This admission number exists in more than one school. Sign in with the email address on your account instead.",
    };
  }

  const first = matches[0];
  const email = buildParentAuthEmail(first.school_id, first.admission_number);
  if (!email) {
    return {
      ok: false,
      error:
        "Could not resolve login for this admission number. Ask your school or sign in with email.",
    };
  }

  return { ok: true, email };
}
