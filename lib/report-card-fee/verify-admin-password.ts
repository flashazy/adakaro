import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logReportCardFeeAudit } from "./audit";

const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export type VerifySchoolAdminPasswordResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      invalidPassword?: boolean;
      rateLimited?: boolean;
      attemptsRemaining?: number;
    };

async function countRecentFailedPasswordAttempts(
  adminDb: SupabaseClient,
  schoolId: string,
  performedBy: string
): Promise<number> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await adminDb
    .from("report_card_fee_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("performed_by", performedBy)
    .eq("action", "admin_password_failed")
    .gte("created_at", since);

  if (error) {
    console.error("[countRecentFailedPasswordAttempts]", error.message);
    return 0;
  }
  return count ?? 0;
}

async function loadSchoolAdminAuthEmails(
  adminDb: SupabaseClient,
  schoolId: string
): Promise<string[]> {
  const { data: members } = await adminDb
    .from("school_members")
    .select("user_id")
    .eq("school_id", schoolId)
    .eq("role", "admin");

  const adminIds = [
    ...new Set(
      (members ?? []).map((m) => (m as { user_id: string }).user_id).filter(Boolean)
    ),
  ];

  const { data: schoolRow } = await adminDb
    .from("schools")
    .select("created_by")
    .eq("id", schoolId)
    .maybeSingle();

  const createdBy = (schoolRow as { created_by?: string | null } | null)
    ?.created_by;
  if (createdBy) adminIds.push(createdBy);

  const uniqueIds = [...new Set(adminIds)];
  if (uniqueIds.length === 0) return [];

  const emails: string[] = [];
  for (const userId of uniqueIds) {
    const { data: authData, error: authErr } =
      await adminDb.auth.admin.getUserById(userId);
    if (authErr) {
      console.error("[loadSchoolAdminAuthEmails] getUserById", authErr.message);
      continue;
    }
    const email = authData.user?.email?.trim();
    if (email) emails.push(email);
  }

  return [...new Set(emails)];
}

/**
 * Verifies a school admin password for fee-rule override (same check as login).
 * Uses Supabase Auth signInWithPassword against each school admin account.
 */
export async function verifySchoolAdminPasswordForOverride(
  adminDb: SupabaseClient,
  params: {
    schoolId: string;
    performedBy: string;
    password: string;
    classId?: string;
    term?: string;
    academicYear?: string;
    sendIntent?: string;
  }
): Promise<VerifySchoolAdminPasswordResult> {
  const trimmed = params.password.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Invalid admin password",
      invalidPassword: true,
      attemptsRemaining: MAX_ATTEMPTS,
    };
  }

  const failedCount = await countRecentFailedPasswordAttempts(
    adminDb,
    params.schoolId,
    params.performedBy
  );
  if (failedCount >= MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "Too many failed attempts. Try again in a few minutes.",
      rateLimited: true,
      attemptsRemaining: 0,
    };
  }

  const emails = await loadSchoolAdminAuthEmails(adminDb, params.schoolId);
  if (emails.length === 0) {
    return {
      ok: false,
      error: "No school admin account is configured for password verification.",
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return {
      ok: false,
      error: "Server configuration error. Contact support.",
    };
  }

  const probe = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let matched = false;
  for (const email of emails) {
    const { data, error } = await probe.auth.signInWithPassword({
      email,
      password: trimmed,
    });
    if (!error && data.session?.access_token) {
      matched = true;
      await probe.auth.signOut();
      break;
    }
    if (!error) {
      await probe.auth.signOut();
    }
  }

  if (matched) {
    return { ok: true };
  }

  const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - failedCount - 1);

  await logReportCardFeeAudit(adminDb, {
    schoolId: params.schoolId,
    classId: params.classId ?? null,
    performedBy: params.performedBy,
    action: "admin_password_failed",
    details: {
      term: params.term ?? null,
      academic_year: params.academicYear ?? null,
      send_intent: params.sendIntent ?? null,
      attempts_remaining: attemptsRemaining,
    },
  });

  return {
    ok: false,
    error: "Invalid admin password",
    invalidPassword: true,
    attemptsRemaining,
  };
}
