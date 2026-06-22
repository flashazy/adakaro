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

const DEMO_REQUEST_SELECT_COLS_MINIMAL =
  "id, created_at, full_name, school_name, phone, email, school_type, student_count, message, status, source, updated_at";

const DEMO_REQUEST_COLUMN_TIERS = [
  DEMO_REQUEST_SELECT_COLS,
  DEMO_REQUEST_SELECT_COLS_LEGACY,
  DEMO_REQUEST_SELECT_COLS_MINIMAL,
] as const;

function isMissingColumnError(
  error: { code?: string; message?: string } | null
): boolean {
  return error?.code === "42703";
}

function normalizeRequestType(value: unknown): DemoRequestRequestType {
  return value === "support" ? "support" : "demo";
}

function normalizeRow(row: Record<string, unknown>): DemoRequestRow {
  return {
    ...(row as unknown as DemoRequestRow),
    request_type: normalizeRequestType(row.request_type),
    email: (row.email as string | null | undefined) ?? null,
    school_type: (row.school_type as string | null | undefined) ?? null,
    student_count: (row.student_count as number | null | undefined) ?? null,
    message: (row.message as string | null | undefined) ?? null,
    notes: (row.notes as string | null | undefined) ?? null,
    next_action: (row.next_action as string | null | undefined) ?? null,
    next_action_date: (row.next_action_date as string | null | undefined) ?? null,
    demo_date: (row.demo_date as string | null | undefined) ?? null,
    demo_time: (row.demo_time as string | null | undefined) ?? null,
    meeting_link: (row.meeting_link as string | null | undefined) ?? null,
    last_contact_at: (row.last_contact_at as string | null | undefined) ?? null,
    lost_reason: (row.lost_reason as string | null | undefined) ?? null,
    won_reason: (row.won_reason as string | null | undefined) ?? null,
    assigned_to_id: (row.assigned_to_id as string | null | undefined) ?? null,
    assigned_to_name: (row.assigned_to_name as string | null | undefined) ?? null,
    source: (row.source as DemoRequestRow["source"]) ?? "contact_page",
  };
}

function normalizeRows(rows: Record<string, unknown>[]): DemoRequestRow[] {
  return rows.map((row) => normalizeRow(row));
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

async function selectDemoRequestById(
  client: SupabaseClient<Database>,
  id: string,
  columns: string
) {
  return client.from("demo_requests").select(columns).eq("id", id).maybeSingle();
}

async function fetchDemoRequestByIdWithColumns(
  client: SupabaseClient<Database>,
  id: string,
  columns: string
) {
  return selectDemoRequestById(client, id, columns);
}

export async function loadDemoRequestById(
  userClient: SupabaseClient<Database>,
  id: string
): Promise<{ row: DemoRequestRow | null; error: string | null }> {
  for (const columns of DEMO_REQUEST_COLUMN_TIERS) {
    const first = await fetchDemoRequestByIdWithColumns(userClient, id, columns);
    if (!first.error && first.data) {
      return {
        row: normalizeRow(first.data as Record<string, unknown>),
        error: null,
      };
    }
    if (!first.error && !first.data) {
      return { row: null, error: "Request not found." };
    }
    if (first.error && !isMissingColumnError(first.error)) {
      try {
        const admin = createAdminClient();
        const second = await fetchDemoRequestByIdWithColumns(admin, id, columns);
        if (!second.error && second.data) {
          return {
            row: normalizeRow(second.data as Record<string, unknown>),
            error: null,
          };
        }
        if (second.error && !isMissingColumnError(second.error)) {
          if (!second.data) {
            return { row: null, error: "Request not found." };
          }
          console.error("[demo-requests] detail load:", second.error);
          return { row: null, error: "Could not load lead details." };
        }
      } catch (e) {
        console.error("[demo-requests] admin client:", e);
        return { row: null, error: "Server configuration error." };
      }
    }
  }

  return { row: null, error: "Could not load lead details." };
}

export async function loadDemoRequestRows(
  userClient: SupabaseClient<Database>
): Promise<{ rows: DemoRequestRow[]; error: string | null }> {
  const first = await selectDemoRequests(userClient, DEMO_REQUEST_SELECT_COLS);

  if (!first.error && first.data) {
    return { rows: normalizeRows(first.data as Record<string, unknown>[]), error: null };
  }

  if (first.error && !isMissingColumnError(first.error)) {
    try {
      const admin = createAdminClient();
      const second = await selectDemoRequests(admin, DEMO_REQUEST_SELECT_COLS);
      if (!second.error && second.data) {
        return {
          rows: normalizeRows(second.data as Record<string, unknown>[]),
          error: null,
        };
      }
      if (second.error && !isMissingColumnError(second.error)) {
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
