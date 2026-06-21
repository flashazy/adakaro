import { createAdminClient } from "@/lib/supabase/admin";
import { recordDemoTimelineEvent } from "@/lib/demo-requests/timeline";
import { notifySuperAdminsOfNewDemoRequest } from "@/lib/demo-requests/notify-super-admin";

export interface NewDemoRequestPayload {
  id: string;
  full_name: string;
  school_name: string;
  phone: string;
  email: string | null;
  school_type: string | null;
  student_count: number | null;
}

export async function bootstrapNewDemoRequest(
  payload: NewDemoRequestPayload
): Promise<void> {
  try {
    const admin = createAdminClient();

    await recordDemoTimelineEvent(admin, {
      demoRequestId: payload.id,
      eventType: "lead_created",
      label: "Lead Created",
      detail: `Inbound demo request from ${payload.full_name}`,
      metadata: {
        source: "contact_page",
      },
    });

    await notifySuperAdminsOfNewDemoRequest(admin, payload);
  } catch (error) {
    console.error("[demo-requests] bootstrap lead failed:", error);
  }
}
