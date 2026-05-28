import {
  profilePasswordGateFromUserMetadata,
  type ProfilePasswordGateRow,
} from "@/lib/auth-password-gate";
import { normalizeServiceRoleKey } from "@/lib/supabase/admin";

/** Profile fields used for forced-password redirects (login, middleware, change-password). */
export type ProfilePasswordGateFetchRow = ProfilePasswordGateRow & {
  recovery_reset_required?: boolean | null;
  teacher_temp_password_expires_at?: string | null;
};

const PROFILE_PASSWORD_GATE_SELECT =
  "role,password_changed,password_forced_reset,recovery_reset_required,must_change_password,teacher_temp_password_expires_at";

/**
 * Read password-gate flags with the service role via PostgREST.
 * Session-scoped clients often get no row under profiles RLS in middleware / edge.
 */
export async function fetchProfilePasswordGateRow(
  userId: string
): Promise<ProfilePasswordGateFetchRow | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = normalizeServiceRoleKey(
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const restUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=${PROFILE_PASSWORD_GATE_SELECT}`;

  try {
    const restRes = await fetch(restUrl, {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const restBody: unknown = await restRes.json().catch(() => null);
    if (!restRes.ok || !Array.isArray(restBody) || !restBody[0]) {
      return null;
    }
    return restBody[0] as ProfilePasswordGateFetchRow;
  } catch {
    return null;
  }
}

/** Service-role DB read, then auth user_metadata when the row cannot be loaded. */
export async function fetchProfilePasswordGateRowForUser(
  userId: string,
  userMetadata?: Record<string, unknown> | null
): Promise<ProfilePasswordGateFetchRow | null> {
  const fromDb = await fetchProfilePasswordGateRow(userId);
  if (fromDb) return fromDb;
  const fromMeta = profilePasswordGateFromUserMetadata(userMetadata);
  return fromMeta as ProfilePasswordGateFetchRow | null;
}
