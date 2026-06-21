import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  isMissingColumnError,
  normalizeBroadcastTargetRow,
  type BroadcastTargetRow,
} from "@/lib/broadcasts/broadcast-target-types";

const FULL_SELECT =
  "id, title, target_user_ids, target_type, target_school_id, target_school_ids, source, source_context";

const LEGACY_SELECT = "id, title, target_user_ids";

/**
 * Load broadcast targeting fields, falling back when migration columns are not yet applied.
 */
export async function loadBroadcastTargetRow(
  admin: SupabaseClient<Database>,
  broadcastId: string
): Promise<{ row: BroadcastTargetRow | null; error: string | null }> {
  const full = await admin
    .from("broadcasts")
    .select(FULL_SELECT)
    .eq("id", broadcastId)
    .maybeSingle();

  if (!full.error && full.data) {
    return {
      row: normalizeBroadcastTargetRow(full.data as Record<string, unknown>),
      error: null,
    };
  }

  if (full.error && isMissingColumnError(full.error)) {
    console.warn(
      "[broadcasts] targeting columns missing — using legacy select. Apply migration 00178_broadcast_targeting_columns.sql"
    );
    const legacy = await admin
      .from("broadcasts")
      .select(LEGACY_SELECT)
      .eq("id", broadcastId)
      .maybeSingle();

    if (legacy.error) {
      console.error("[broadcasts] legacy broadcast load", legacy.error);
      return { row: null, error: legacy.error.message };
    }
    if (!legacy.data) {
      return { row: null, error: null };
    }
    return {
      row: normalizeBroadcastTargetRow(legacy.data as Record<string, unknown>),
      error: null,
    };
  }

  if (full.error) {
    console.error("[broadcasts] broadcast load", full.error);
    return { row: null, error: full.error.message };
  }

  return { row: null, error: null };
}
