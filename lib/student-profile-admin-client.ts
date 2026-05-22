import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, UserRole } from "@/types/supabase";

export type ProfileDataClient = SupabaseClient<Database>;

type ProfilePick = {
  id: string;
  full_name: string | null;
  role: UserRole;
};

/**
 * Service-role client for student profile reads (bypasses profiles RLS).
 * Falls back to the session client when the admin client is unavailable.
 */
export function getStudentProfileDataClient(
  sessionClient: SupabaseClient<Database>
): ProfileDataClient {
  try {
    return createAdminClient();
  } catch (err) {
    console.warn(
      "[getStudentProfileDataClient] admin client unavailable, using session client",
      err instanceof Error ? err.message : err
    );
    return sessionClient;
  }
}

async function queryProfilesByIds(
  client: SupabaseClient<Database>,
  ids: string[]
): Promise<{ data: ProfilePick[] | null; error: { message: string } | null }> {
  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, role")
    .in("id", ids);
  return {
    data: (data ?? null) as ProfilePick[] | null,
    error: error ? { message: error.message } : null,
  };
}

/**
 * Load profile rows by id — admin first, then session client.
 */
export async function fetchProfilesByIds(
  sessionClient: SupabaseClient<Database>,
  ids: string[]
): Promise<Map<string, { full_name: string | null; role: UserRole }>> {
  const map = new Map<string, { full_name: string | null; role: UserRole }>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;

  try {
    const admin = createAdminClient();
    const { data, error } = await queryProfilesByIds(admin, unique);
    if (!error && data) {
      for (const r of data) {
        map.set(r.id, { full_name: r.full_name, role: r.role });
      }
      return map;
    }
    if (error) {
      console.warn("[fetchProfilesByIds] admin query failed:", error.message);
    }
  } catch (err) {
    console.warn(
      "[fetchProfilesByIds] admin client unavailable",
      err instanceof Error ? err.message : err
    );
  }

  const { data, error } = await queryProfilesByIds(sessionClient, unique);
  if (error) {
    console.warn("[fetchProfilesByIds] session fallback failed:", error.message);
    return map;
  }
  for (const r of data ?? []) {
    map.set(r.id, { full_name: r.full_name, role: r.role });
  }
  return map;
}

/**
 * Load the signed-in user's profile row — admin first, then session client.
 */
export async function fetchUserProfileForStudentPage(
  sessionClient: SupabaseClient<Database>,
  userId: string
): Promise<{
  profile: { full_name: string | null; role: UserRole } | null;
  error: string | null;
}> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("full_name, role")
      .eq("id", userId)
      .maybeSingle();
    if (!error && data) {
      return {
        profile: data as { full_name: string | null; role: UserRole },
        error: null,
      };
    }
    if (error) {
      console.warn(
        "[fetchUserProfileForStudentPage] admin query failed:",
        error.message
      );
    }
  } catch (err) {
    console.warn(
      "[fetchUserProfileForStudentPage] admin client unavailable",
      err instanceof Error ? err.message : err
    );
  }

  const { data, error } = await sessionClient
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { profile: null, error: error.message };
  }
  return {
    profile: (data as { full_name: string | null; role: UserRole } | null) ?? null,
    error: null,
  };
}

export type SchoolProfileRow = {
  currency: string | null;
  timezone: string | null;
  name: string | null;
};

/**
 * School row for student profile header — admin only.
 * Session client is not used as fallback: schools RLS calls helpers that read
 * profiles and can recurse ("infinite recursion detected in policy for relation profiles").
 */
export async function fetchSchoolForStudentProfile(
  schoolId: string
): Promise<{ row: SchoolProfileRow | null; error: string | null }> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("schools")
      .select("currency, timezone, name")
      .eq("id", schoolId)
      .maybeSingle();
    if (error) {
      return { row: null, error: error.message };
    }
    return { row: (data as SchoolProfileRow | null) ?? null, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[fetchSchoolForStudentProfile] admin client failed:", msg);
    return { row: null, error: msg };
  }
}
