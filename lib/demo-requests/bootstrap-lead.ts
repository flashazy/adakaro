import { createAdminClient } from "@/lib/supabase/admin";
import { recordDemoTimelineEvent } from "@/lib/demo-requests/timeline";
import { notifySuperAdminsOfNewDemoRequest } from "@/lib/demo-requests/notify-super-admin";
import type {
  DemoRequestLeadSource,
  DemoRequestRequestType,
} from "@/lib/demo-requests/types";

export interface NewDemoRequestPayload {
  id: string;
  full_name: string;
  school_name: string;
  phone: string;
  email: string | null;
  school_type: string | null;
  student_count: number | null;
  source?: DemoRequestLeadSource | string;
  request_type?: DemoRequestRequestType | string;
}

export async function bootstrapNewDemoRequest(
  payload: NewDemoRequestPayload
): Promise<void> {
  try {
    const admin = createAdminClient();
    const source = payload.source ?? "contact_page";
    const requestType = payload.request_type ?? "demo";
    const isSupport = requestType === "support";

    await recordDemoTimelineEvent(admin, {
      demoRequestId: payload.id,
      eventType: "lead_created",
      label: "Lead Created",
      detail: isSupport
        ? `Inbound support request from ${payload.full_name}`
        : `Inbound demo request from ${payload.full_name}`,
      metadata: {
        source,
        request_type: requestType,
      },
    });

    await notifySuperAdminsOfNewDemoRequest(admin, {
      ...payload,
      source,
      request_type: requestType,
    });
  } catch (error) {
    console.error("[demo-requests] bootstrap lead failed:", error);
  }
}
