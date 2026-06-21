import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export const DEMO_TIMELINE_EVENT_TYPES = [
  "lead_created",
  "status_changed",
  "demo_scheduled",
  "notes_added",
  "next_action_set",
  "called",
  "whatsapp_sent",
  "email_sent",
  "won",
  "lost",
  "demo_invitation_generated",
  "google_meet_created",
  "zoom_meeting_created",
  "lead_assigned",
  "call_initiated",
  "note_added",
  "meeting_created",
] as const;

export type DemoTimelineEventType = (typeof DEMO_TIMELINE_EVENT_TYPES)[number];

export interface DemoRequestTimelineEvent {
  id: string;
  demo_request_id: string;
  event_type: DemoTimelineEventType | string;
  label: string;
  detail: string | null;
  actor_id: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RecordTimelineInput {
  demoRequestId: string;
  eventType: DemoTimelineEventType | string;
  label: string;
  detail?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordDemoTimelineEvent(
  client: SupabaseClient<Database>,
  input: RecordTimelineInput
): Promise<void> {
  const { error } = await client.from("demo_request_timeline_events").insert({
    demo_request_id: input.demoRequestId,
    event_type: input.eventType,
    label: input.label,
    detail: input.detail ?? null,
    actor_id: input.actorId ?? null,
    actor_name: input.actorName ?? null,
    metadata: input.metadata ?? null,
  } as never);

  if (error) {
    console.error("[demo-requests] timeline insert:", error.message);
  }
}
