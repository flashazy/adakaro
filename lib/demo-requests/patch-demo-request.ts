import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { recordDemoTimelineEvent } from "@/lib/demo-requests/timeline";
import {
  DEMO_REQUEST_SELECT_COLS,
  DEMO_REQUEST_STATUSES,
  LOST_REASONS,
  WON_REASONS,
  type DemoRequestRow,
  type DemoRequestStatus,
} from "@/lib/demo-requests/types";

export interface DemoRequestPatchBody {
  status?: string;
  next_action?: string | null;
  next_action_date?: string | null;
  demo_date?: string | null;
  demo_time?: string | null;
  meeting_link?: string | null;
  lost_reason?: string | null;
  won_reason?: string | null;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
}

export interface PatchDemoRequestContext {
  actorId: string;
  actorName: string;
}

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function normalizeTime(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed;
}

export function buildDemoRequestPatchPayload(
  body: DemoRequestPatchBody
): {
  payload: Partial<DemoRequestRow>;
  error?: string;
} {
  const payload: Partial<DemoRequestRow> = {};

  if (body.status !== undefined) {
    if (!DEMO_REQUEST_STATUSES.includes(body.status as DemoRequestStatus)) {
      return { payload: {}, error: "Invalid status." };
    }
    payload.status = body.status as DemoRequestStatus;
  }

  const nextAction = normalizeOptionalText(body.next_action);
  if (nextAction !== undefined) payload.next_action = nextAction;

  const nextActionDate = normalizeDate(body.next_action_date);
  if (nextActionDate === undefined && body.next_action_date !== undefined) {
    return { payload: {}, error: "Invalid next action date." };
  }
  if (nextActionDate !== undefined) payload.next_action_date = nextActionDate;

  const demoDate = normalizeDate(body.demo_date);
  if (demoDate === undefined && body.demo_date !== undefined) {
    return { payload: {}, error: "Invalid demo date." };
  }
  if (demoDate !== undefined) payload.demo_date = demoDate;

  const demoTime = normalizeTime(body.demo_time);
  if (demoTime !== undefined) payload.demo_time = demoTime;

  const meetingLink = normalizeOptionalText(body.meeting_link);
  if (meetingLink !== undefined) payload.meeting_link = meetingLink;

  const lostReason = normalizeOptionalText(body.lost_reason);
  if (lostReason !== undefined) payload.lost_reason = lostReason;

  if (lostReason !== undefined && lostReason && !LOST_REASONS.includes(lostReason as (typeof LOST_REASONS)[number])) {
    return { payload: {}, error: "Invalid lost reason." };
  }

  const wonReason = normalizeOptionalText(body.won_reason);
  if (wonReason !== undefined) payload.won_reason = wonReason;

  if (wonReason !== undefined && wonReason && !WON_REASONS.includes(wonReason as (typeof WON_REASONS)[number])) {
    return { payload: {}, error: "Invalid won reason." };
  }

  if (body.assigned_to_name !== undefined) {
    const name = normalizeOptionalText(body.assigned_to_name);
    payload.assigned_to_name = name ?? null;
  }

  if (body.assigned_to_id !== undefined) {
    payload.assigned_to_id = body.assigned_to_id ?? null;
  }

  return { payload };
}

async function recordPatchTimelineEvents(
  client: SupabaseClient<Database>,
  previous: DemoRequestRow,
  next: DemoRequestRow,
  ctx: PatchDemoRequestContext
): Promise<void> {
  const base = {
    actorId: ctx.actorId,
    actorName: ctx.actorName,
    demoRequestId: next.id,
  };

  if (previous.status !== next.status) {
    const eventType =
      next.status === "Won"
        ? "won"
        : next.status === "Lost"
          ? "lost"
          : "status_changed";

    await recordDemoTimelineEvent(client, {
      ...base,
      eventType,
      label:
        next.status === "Won"
          ? "Won"
          : next.status === "Lost"
            ? "Lost"
            : "Status Changed",
      detail:
        next.status === "Won" && next.won_reason
          ? `Won — ${next.won_reason}`
          : next.status === "Lost" && next.lost_reason
            ? `Lost — ${next.lost_reason}`
            : `${previous.status} → ${next.status}`,
      metadata: {
        from: previous.status,
        to: next.status,
        lost_reason: next.lost_reason,
        won_reason: next.won_reason,
      },
    });
  }

  const ownerChanged =
    previous.assigned_to_name !== next.assigned_to_name ||
    previous.assigned_to_id !== next.assigned_to_id;

  if (ownerChanged) {
    const ownerLabel = next.assigned_to_name?.trim() || "Unassigned";
    await recordDemoTimelineEvent(client, {
      ...base,
      eventType: "lead_assigned",
      label: "Lead Assigned",
      detail: ownerLabel === "Unassigned" ? "Unassigned" : `Assigned to ${ownerLabel}`,
      metadata: {
        assigned_to_id: next.assigned_to_id,
        assigned_to_name: next.assigned_to_name,
      },
    });
  }

  const demoFieldsChanged =
    previous.demo_date !== next.demo_date ||
    previous.demo_time !== next.demo_time ||
    previous.meeting_link !== next.meeting_link;

  if (demoFieldsChanged && next.demo_date) {
    const parts = [next.demo_date];
    if (next.demo_time) parts.push(next.demo_time.slice(0, 5));
    await recordDemoTimelineEvent(client, {
      ...base,
      eventType: "demo_scheduled",
      label: "Demo Scheduled",
      detail: parts.join(" at "),
      metadata: {
        demo_date: next.demo_date,
        demo_time: next.demo_time,
        meeting_link: next.meeting_link,
      },
    });
  }

  const nextActionChanged =
    previous.next_action !== next.next_action ||
    previous.next_action_date !== next.next_action_date;

  if (
    nextActionChanged &&
    (next.next_action || next.next_action_date)
  ) {
    const detail = [next.next_action, next.next_action_date]
      .filter(Boolean)
      .join(" · ");
    await recordDemoTimelineEvent(client, {
      ...base,
      eventType: "next_action_set",
      label: "Next Action Set",
      detail: detail || null,
      metadata: {
        next_action: next.next_action,
        next_action_date: next.next_action_date,
      },
    });
  }
}

export async function patchDemoRequest(
  client: SupabaseClient<Database>,
  id: string,
  body: DemoRequestPatchBody,
  ctx: PatchDemoRequestContext
): Promise<{ row?: DemoRequestRow; error?: string; status?: number }> {
  const { payload, error: buildError } = buildDemoRequestPatchPayload(body);
  if (buildError) {
    return { error: buildError, status: 400 };
  }
  if (Object.keys(payload).length === 0) {
    return { error: "Nothing to update.", status: 400 };
  }

  const { data: previous, error: loadError } = await client
    .from("demo_requests")
    .select(DEMO_REQUEST_SELECT_COLS)
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("[demo-requests] load for patch:", loadError);
    return { error: loadError.message, status: 500 };
  }
  if (!previous) {
    return { error: "Request not found.", status: 404 };
  }

  const previousRow = previous as DemoRequestRow;
  const nextStatus = (payload.status ?? previousRow.status) as DemoRequestStatus;

  if (nextStatus === "Lost") {
    const effectiveLostReason =
      payload.lost_reason !== undefined
        ? payload.lost_reason
        : previousRow.lost_reason;
    if (!effectiveLostReason) {
      return {
        error: "Lost reason is required when marking a lead as Lost.",
        status: 400,
      };
    }
  }

  if (nextStatus === "Won") {
    const effectiveWonReason =
      payload.won_reason !== undefined
        ? payload.won_reason
        : previousRow.won_reason;
    if (!effectiveWonReason) {
      return {
        error: "Won reason is required when marking a lead as Won.",
        status: 400,
      };
    }
  }

  const { data, error } = await client
    .from("demo_requests")
    .update(payload as never)
    .eq("id", id)
    .select(DEMO_REQUEST_SELECT_COLS)
    .maybeSingle();

  if (error) {
    console.error("[demo-requests] update:", error);
    return { error: error.message, status: 500 };
  }
  if (!data) {
    return { error: "Request not found.", status: 404 };
  }

  await recordPatchTimelineEvents(
    client,
    previous as DemoRequestRow,
    data as DemoRequestRow,
    ctx
  );

  return { row: data as DemoRequestRow };
}
