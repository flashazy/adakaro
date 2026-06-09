import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HealthAlertsDb = any;

/**
 * Marks a health alert resolved by dedupe key. Never throws.
 */
export async function resolveHealthAlertByDedupeKey(
  dedupeKey: string
): Promise<void> {
  const key = dedupeKey?.trim();
  if (!key) return;

  try {
    const admin = createAdminClient() as HealthAlertsDb;
    const now = new Date().toISOString();
    await admin
      .from("health_alerts")
      .update({
        status: "resolved",
        resolved_at: now,
        last_seen_at: now,
      })
      .eq("dedupe_key", key)
      .eq("status", "open");
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[resolveHealthAlertByDedupeKey] failed", err);
    }
  }
}
