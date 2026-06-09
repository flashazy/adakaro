import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { reportHealthAlert } from "@/lib/watchdog/report-health-alert";
import { HEALTH_FEATURES } from "@/lib/watchdog/features";

export interface HealthCheckResultItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface RunHealthChecksResult {
  ok: boolean;
  ranAt: string;
  checks: HealthCheckResultItem[];
}

function envPresent(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Safe read-only health probes for super admins. Does not modify school data.
 */
export async function runHealthChecks(): Promise<RunHealthChecksResult> {
  const ranAt = new Date().toISOString();
  const checks: HealthCheckResultItem[] = [];
  let admin: ReturnType<typeof createAdminClient> | null = null;

  try {
    admin = createAdminClient();
  } catch (e) {
    checks.push({
      id: "admin_client",
      label: "Service role client",
      ok: false,
      detail: (e as Error).message || "Could not create admin client.",
    });
    return { ok: false, ranAt, checks };
  }

  // Database connectivity
  try {
    const { error } = await admin.from("schools").select("id").limit(1);
    checks.push({
      id: "database",
      label: "Database connection",
      ok: !error,
      detail: error?.message ?? "Connected — schools table readable.",
    });
  } catch (e) {
    checks.push({
      id: "database",
      label: "Database connection",
      ok: false,
      detail: (e as Error).message,
    });
  }

  // Environment (names only — never expose secret values)
  const envOk =
    envPresent("NEXT_PUBLIC_SUPABASE_URL") &&
    envPresent("SUPABASE_SERVICE_ROLE_KEY");
  checks.push({
    id: "environment",
    label: "Required environment variables",
    ok: envOk,
    detail: envOk
      ? "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
      : "Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.",
  });

  // Recent report cards consistency (read-only)
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: rcErr } = await admin
      .from("report_cards")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);

    const { count: incompleteCount, error: incErr } = await admin
      .from("report_cards")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .eq("is_complete", false)
      .lt("completed_subjects_count", 7);

    const ok = !rcErr && !incErr;
    checks.push({
      id: "report_cards",
      label: "Recent report cards (7 days)",
      ok,
      detail: ok
        ? `${recentCount ?? 0} card(s) created; ${incompleteCount ?? 0} with fewer than 7 completed subjects.`
        : rcErr?.message ?? incErr?.message ?? "Could not query report cards.",
    });

    if (ok && (incompleteCount ?? 0) > 0) {
      await reportHealthAlert({
        feature: HEALTH_FEATURES.healthCheck,
        severity: "medium",
        title: "Incomplete secondary report cards detected",
        message: `${incompleteCount} report card(s) created in the last 7 days have fewer than 7 completed subjects.`,
        dedupeKey: "health_check:report_cards_incomplete_7d",
        metadata: { incomplete_count: incompleteCount, window_days: 7 },
      });
    }
  } catch (e) {
    checks.push({
      id: "report_cards",
      label: "Recent report cards (7 days)",
      ok: false,
      detail: (e as Error).message,
    });
  }

  // Notifications table health
  try {
    const { count, error } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true });
    checks.push({
      id: "notifications",
      label: "In-app notifications table",
      ok: !error,
      detail: error?.message ?? `${count ?? 0} notification row(s) on file.`,
    });
  } catch (e) {
    checks.push({
      id: "notifications",
      label: "In-app notifications table",
      ok: false,
      detail: (e as Error).message,
    });
  }

  // Parent report fee rules table (parent report access gating)
  try {
    const { count, error } = await admin
      .from("report_card_fee_rules")
      .select("id", { count: "exact", head: true });
    checks.push({
      id: "parent_report_access",
      label: "Parent report fee rules",
      ok: !error,
      detail: error?.message ?? `${count ?? 0} fee rule row(s) configured.`,
    });
  } catch (e) {
    checks.push({
      id: "parent_report_access",
      label: "Parent report fee rules",
      ok: false,
      detail: (e as Error).message,
    });
  }

  const ok = checks.every((c) => c.ok);
  return { ok, ranAt, checks };
}
