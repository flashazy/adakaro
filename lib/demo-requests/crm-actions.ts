import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  buildDemoInvitation,
  generateGoogleMeetLink,
  generateZoomMeetingLink,
} from "@/lib/demo-requests/meeting-tools";
import { recordDemoTimelineEvent } from "@/lib/demo-requests/timeline";
import {
  DEMO_REQUEST_SELECT_COLS,
  type DemoRequestRow,
} from "@/lib/demo-requests/types";

export const CRM_ACTION_TYPES = [
  "demo_invitation_generated",
  "google_meet_created",
  "zoom_meeting_created",
] as const;

export type CrmActionType = (typeof CRM_ACTION_TYPES)[number];

export interface CrmActionContext {
  actorId: string;
  actorName: string;
}

export interface CrmActionResult {
  row?: DemoRequestRow;
  invitation?: { subject: string; body: string; mailto: string };
  meetingLink?: string;
  error?: string;
  status?: number;
}

export async function applyDemoCrmAction(
  client: SupabaseClient<Database>,
  id: string,
  action: CrmActionType,
  ctx: CrmActionContext
): Promise<CrmActionResult> {
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

  const row = previous as DemoRequestRow;
  const base = {
    demoRequestId: id,
    actorId: ctx.actorId,
    actorName: ctx.actorName,
  };

  if (action === "demo_invitation_generated") {
    const invitation = buildDemoInvitation(row);
    await recordDemoTimelineEvent(client, {
      ...base,
      eventType: "demo_invitation_generated",
      label: "Demo invitation generated",
      detail: invitation.subject,
    });
    return { row, invitation };
  }

  const meetingLink =
    action === "google_meet_created"
      ? generateGoogleMeetLink()
      : generateZoomMeetingLink();

  const { data, error } = await client
    .from("demo_requests")
    .update({ meeting_link: meetingLink } as never)
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
    ...base,
    eventType: action,
    label:
      action === "google_meet_created"
        ? "Google Meet created"
        : "Zoom meeting created",
    detail: meetingLink,
    metadata: { meeting_link: meetingLink },
  });

  return { row: data as DemoRequestRow, meetingLink };
}
