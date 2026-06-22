import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import {
  DEMO_REQUEST_SELECT_COLS,
  type DemoRequestRequestType,
  type DemoRequestRow,
} from "@/lib/demo-requests/types";

const DEMO_REQUEST_SELECT_COLS_LEGACY =
  "id, created_at, full_name, school_name, phone, email, school_type, student_count, message, status, source, notes, updated_at, next_action, next_action_date, demo_date, demo_time, meeting_link, last_contact_at, lost_reason, won_reason, assigned_to_id, assigned_to_name";

function isMissingRequestTypeColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42703" &&
    (error.message?.includes("request_type") ?? false)
  );
}

function normalizeRequestType(value: unknown): DemoRequestRequestType {
  return value === "support" ? "support" : "demo";
}

function normalizeRows(rows: Record<string, unknown>[]): DemoRequestRow[] {
  return rows.map((row) => ({
    ...(row as unknown as DemoRequestRow),
    request_type: normalizeRequestType(row.request_type),
  }));
}

async function selectDemoRequests(
  client: SupabaseClient<Database>,
  columns: string
) {
  return client
    .from("demo_requests")
    .select(columns)
    .order("created_at", { ascending: false });
}

export async function loadDemoRequestRows(
  userClient: SupabaseClient<Database>
): Promise<{ rows: DemoRequestRow[]; error: string | null }> {
  const first = await selectDemoRequests(userClient, DEMO_REQUEST_SELECT_COLS);

  if (!first.error && first.data) {
    return { rows: normalizeRows(first.data as Record<string, unknown>[]), error: null };
  }

  if (first.error && !isMissingRequestTypeColumn(first.error)) {
    try {
      const admin = createAdminClient();
      const second = await selectDemoRequests(admin, DEMO_REQUEST_SELECT_COLS);
      if (!second.error && second.data) {
        return {
          rows: normalizeRows(second.data as Record<string, unknown>[]),
          error: null,
        };
      }
      if (second.error && !isMissingRequestTypeColumn(second.error)) {
        console.error("[demo-requests] load:", second.error);
        return { rows: [], error: "Could not load demo requests." };
      }
    } catch (e) {
      console.error("[demo-requests] admin client:", e);
      return { rows: [], error: "Server configuration error." };
    }
  }

  const legacy = await selectDemoRequests(userClient, DEMO_REQUEST_SELECT_COLS_LEGACY);
  if (!legacy.error && legacy.data) {
    return { rows: normalizeRows(legacy.data as Record<string, unknown>[]), error: null };
  }

  try {
    const admin = createAdminClient();
    const legacyAdmin = await selectDemoRequests(admin, DEMO_REQUEST_SELECT_COLS_LEGACY);
    if (!legacyAdmin.error && legacyAdmin.data) {
      return {
        rows: normalizeRows(legacyAdmin.data as Record<string, unknown>[]),
        error: null,
      };
    }
    if (legacyAdmin.error) {
      console.error("[demo-requests] load:", legacyAdmin.error);
    }
  } catch (e) {
    console.error("[demo-requests] admin client:", e);
    return { rows: [], error: "Server configuration error." };
  }

  return { rows: [], error: "Could not load demo requests." };
}
