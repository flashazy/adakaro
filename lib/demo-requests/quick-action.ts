import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { recordDemoTimelineEvent } from "@/lib/demo-requests/timeline";
import {
  DEMO_REQUEST_SELECT_COLS,
  type DemoRequestRow,
  type DemoRequestStatus,
} from "@/lib/demo-requests/types";

export const QUICK_ACTION_TYPES = [
  "called",
  "whatsapp_sent",
  "email_sent",
  "demo_scheduled",
  "call_opened",
  "whatsapp_opened",
  "email_opened",
] as const;

export type QuickActionType = (typeof QUICK_ACTION_TYPES)[number];

const QUICK_ACTION_CONFIG: Record<
  QuickActionType,
  {
    label: string;
    eventType: string;
    nextAction?: string;
    status?: DemoRequestStatus;
    touchStatus: boolean;
  }
> = {
  called: {
    label: "Called School",
    eventType: "called",
    nextAction: "Follow up",
    status: "Contacted",
    touchStatus: true,
  },
  whatsapp_sent: {
    label: "WhatsApp Sent",
    eventType: "whatsapp_sent",
    nextAction: "Follow up",
    status: "Contacted",
    touchStatus: true,
  },
  email_sent: {
    label: "Email Sent",
    eventType: "email_sent",
    nextAction: "Follow up",
    status: "Contacted",
    touchStatus: true,
  },
  demo_scheduled: {
    label: "Demo Scheduled",
    eventType: "demo_scheduled",
    nextAction: "Schedule demo",
    status: "Demo Scheduled",
    touchStatus: true,
  },
  call_opened: {
    label: "Called school",
    eventType: "call_opened",
    touchStatus: true,
    status: "Contacted",
  },
  whatsapp_opened: {
    label: "WhatsApp opened",
    eventType: "whatsapp_opened",
    touchStatus: true,
    status: "Contacted",
  },
  email_opened: {
    label: "Email opened",
    eventType: "email_opened",
    touchStatus: true,
    status: "Contacted",
  },
};

export interface QuickActionContext {
  actorId: string;
  actorName: string;
}

export async function applyDemoQuickAction(
  client: SupabaseClient<Database>,
  id: string,
  action: QuickActionType,
  ctx: QuickActionContext
): Promise<{ row?: DemoRequestRow; error?: string; status?: number }> {
  if (!QUICK_ACTION_TYPES.includes(action)) {
    return { error: "Invalid quick action.", status: 400 };
  }

  const { data: previous, error: loadError } = await client
    .from("demo_requests")
    .select(DEMO_REQUEST_SELECT_COLS)
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return { error: loadError.message, status: 500 };
  }
  if (!previous) {
    return { error: "Request not found.", status: 404 };
  }

  const config = QUICK_ACTION_CONFIG[action];
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const prev = previous as DemoRequestRow;

  const payload: Partial<DemoRequestRow> = {
    last_contact_at: now,
  };

  if (config.nextAction) {
    payload.next_action = config.nextAction;
  }

  if (config.touchStatus) {
    if (config.status && prev.status === "New") {
      payload.status = config.status;
    } else if (action === "demo_scheduled") {
      payload.status = "Demo Scheduled";
      if (!prev.demo_date) payload.demo_date = today;
    }
  }

  const { data, error } = await client
    .from("demo_requests")
    .update(payload as never)
    .eq("id", id)
    .select(DEMO_REQUEST_SELECT_COLS)
    .maybeSingle();

  if (error) {
    return { error: error.message, status: 500 };
  }
  if (!data) {
    return { error: "Request not found.", status: 404 };
  }

  await recordDemoTimelineEvent(client, {
    demoRequestId: id,
    eventType: config.eventType,
    label: config.label,
    detail: null,
    actorId: ctx.actorId,
    actorName: ctx.actorName,
  });

  return { row: data as DemoRequestRow };
}
