import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifies a school admin password without mutating the caller's session.
 * Tries sign-in against each school admin email for the school.
 */
export async function verifySchoolAdminPassword(
  adminDb: SupabaseClient,
  schoolId: string,
  password: string
): Promise<boolean> {
  const trimmed = password.trim();
  if (!trimmed) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;

  const { data: members } = await adminDb
    .from("school_members")
    .select("user_id")
    .eq("school_id", schoolId)
    .eq("role", "admin");

  const adminIds = (members ?? []).map(
    (m) => (m as { user_id: string }).user_id
  );
  if (adminIds.length === 0) return false;

  const { data: profiles } = await adminDb
    .from("profiles")
    .select("id, email")
    .in("id", adminIds);

  const emails = (profiles ?? [])
    .map((p) => (p as { email?: string | null }).email?.trim())
    .filter((e): e is string => Boolean(e));

  if (emails.length === 0) return false;

  const probe = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const email of emails) {
    const { error } = await probe.auth.signInWithPassword({
      email,
      password: trimmed,
    });
    if (!error) return true;
  }
  return false;
}
