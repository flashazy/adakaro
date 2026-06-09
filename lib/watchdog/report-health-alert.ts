import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/supabase";

export type HealthAlertSeverity = "low" | "medium" | "high" | "critical";

export interface ReportHealthAlertInput {
  feature: string;
  severity: HealthAlertSeverity;
  title: string;
  message: string;
  schoolId?: string | null;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
}

type HealthAlertInsert =
  Database["public"]["Tables"]["health_alerts"]["Insert"];
type HealthAlertUpdate =
  Database["public"]["Tables"]["health_alerts"]["Update"];

// Supabase client table union is capped; health_alerts is typed via Database above.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HealthAlertsDb = any;

/**
 * Persist or reopen a health alert. Never throws — safe to call from user flows.
 * Reuses an existing row when `dedupe_key` matches (updates last_seen_at, reopens if closed).
 */
export async function reportHealthAlert(
  input: ReportHealthAlertInput
): Promise<void> {
  try {
    const feature = input.feature?.trim();
    const dedupeKey = input.dedupeKey?.trim();
    const title = input.title?.trim();
    const message = input.message?.trim();
    if (!feature || !dedupeKey || !title || !message) return;

    const admin = createAdminClient() as HealthAlertsDb;
    const now = new Date().toISOString();

    const { data: existing } = await admin
      .from("health_alerts")
      .select("id, status, metadata")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    const existingMeta = (existing as { metadata?: Json | null } | null)
      ?.metadata as { occurrence_count?: number } | null | undefined;
    const occurrenceCount = (existingMeta?.occurrence_count ?? 0) + 1;

    const metadata = {
      ...(input.metadata ?? {}),
      occurrence_count: occurrenceCount,
    } as Json;

    const existingId = (existing as { id?: string } | null)?.id;
    if (existingId) {
      const patch: HealthAlertUpdate = {
        feature,
        severity: input.severity,
        title,
        message,
        school_id: input.schoolId ?? null,
        metadata,
        status: "open",
        last_seen_at: now,
        resolved_at: null,
      };
      await admin.from("health_alerts").update(patch).eq("id", existingId);
      return;
    }

    const row: HealthAlertInsert = {
      school_id: input.schoolId ?? null,
      feature,
      severity: input.severity,
      title,
      message,
      metadata,
      status: "open",
      dedupe_key: dedupeKey,
      first_seen_at: now,
      last_seen_at: now,
    };
    await admin.from("health_alerts").insert(row);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[reportHealthAlert] failed", err);
    }
  }
}
