import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side check for the Adakaro Copilot rollout flag.
 *
 * Reads `schools.copilot_enabled` with the service role so the result is not
 * affected by RLS. Returns `false` whenever the school is missing, the flag is
 * off, or the service role is not configured (fail-closed for private rollout).
 */
export async function isSchoolCopilotEnabled(
  schoolId: string | null | undefined
): Promise<boolean> {
  if (!schoolId) return false;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("schools")
      .select("copilot_enabled")
      .eq("id", schoolId)
      .maybeSingle();
    return Boolean((data as { copilot_enabled: boolean | null } | null)?.copilot_enabled);
  } catch {
    return false;
  }
}
