import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import {
  DEMO_REQUEST_SELECT_COLS,
  type DemoRequestNote,
  type DemoRequestRow,
} from "@/lib/demo-requests/types";
import type { DemoRequestTimelineEvent } from "@/lib/demo-requests/timeline";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await checkIsSuperAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [rowRes, notesRes, timelineRes] = await Promise.all([
    supabase
      .from("demo_requests")
      .select(DEMO_REQUEST_SELECT_COLS)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("demo_request_notes")
      .select("id, demo_request_id, author_id, author_name, content, created_at")
      .eq("demo_request_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("demo_request_timeline_events")
      .select(
        "id, demo_request_id, event_type, label, detail, actor_id, actor_name, metadata, created_at"
      )
      .eq("demo_request_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (rowRes.error) {
    console.error("[demo-requests] detail load:", rowRes.error);
    return NextResponse.json({ error: rowRes.error.message }, { status: 500 });
  }
  if (!rowRes.data) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  if (notesRes.error) {
    console.error("[demo-requests] notes load:", notesRes.error);
  }
  if (timelineRes.error) {
    console.error("[demo-requests] timeline load:", timelineRes.error);
  }

  return NextResponse.json({
    row: rowRes.data as DemoRequestRow,
    notes: (notesRes.data ?? []) as DemoRequestNote[],
    timeline: (timelineRes.data ?? []) as DemoRequestTimelineEvent[],
  });
}
