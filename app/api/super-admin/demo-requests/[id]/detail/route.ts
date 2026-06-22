import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { loadDemoRequestById } from "@/lib/demo-requests/load-demo-request-rows";
import type { DemoRequestNote } from "@/lib/demo-requests/types";
import type { DemoRequestTimelineEvent } from "@/lib/demo-requests/timeline";

export const dynamic = "force-dynamic";

function isMissingRelationError(error: { code?: string } | null): boolean {
  return error?.code === "42P01";
}

async function loadNotesAndTimeline(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<{ notes: DemoRequestNote[]; timeline: DemoRequestTimelineEvent[] }> {
  const notesSelect =
    "id, demo_request_id, author_id, author_name, content, created_at";
  const timelineSelect =
    "id, demo_request_id, event_type, label, detail, actor_id, actor_name, metadata, created_at";

  const [notesRes, timelineRes] = await Promise.all([
    supabase
      .from("demo_request_notes")
      .select(notesSelect)
      .eq("demo_request_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("demo_request_timeline_events")
      .select(timelineSelect)
      .eq("demo_request_id", id)
      .order("created_at", { ascending: false }),
  ]);

  let notes = (notesRes.data ?? []) as DemoRequestNote[];
  let timeline = (timelineRes.data ?? []) as DemoRequestTimelineEvent[];

  const notesFailed =
    notesRes.error && !isMissingRelationError(notesRes.error);
  const timelineFailed =
    timelineRes.error && !isMissingRelationError(timelineRes.error);

  if (notesFailed || timelineFailed) {
    try {
      const admin = createAdminClient();
      const [adminNotes, adminTimeline] = await Promise.all([
        notesFailed
          ? admin
              .from("demo_request_notes")
              .select(notesSelect)
              .eq("demo_request_id", id)
              .order("created_at", { ascending: false })
          : Promise.resolve(notesRes),
        timelineFailed
          ? admin
              .from("demo_request_timeline_events")
              .select(timelineSelect)
              .eq("demo_request_id", id)
              .order("created_at", { ascending: false })
          : Promise.resolve(timelineRes),
      ]);

      if (notesFailed && !adminNotes.error) {
        notes = (adminNotes.data ?? []) as DemoRequestNote[];
      } else if (notesFailed) {
        console.error("[demo-requests] notes load:", adminNotes.error);
      }

      if (timelineFailed && !adminTimeline.error) {
        timeline = (adminTimeline.data ?? []) as DemoRequestTimelineEvent[];
      } else if (timelineFailed) {
        console.error("[demo-requests] timeline load:", adminTimeline.error);
      }
    } catch (e) {
      console.error("[demo-requests] detail notes/timeline admin:", e);
    }
  }

  if (notesRes.error && isMissingRelationError(notesRes.error)) {
    notes = [];
  }
  if (timelineRes.error && isMissingRelationError(timelineRes.error)) {
    timeline = [];
  }

  return { notes, timeline };
}

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

  const { row, error: rowError } = await loadDemoRequestById(supabase, id);
  if (rowError || !row) {
    const status = rowError === "Request not found." ? 404 : 500;
    return NextResponse.json(
      { error: rowError ?? "Request not found." },
      { status }
    );
  }

  const { notes, timeline } = await loadNotesAndTimeline(supabase, id);

  return NextResponse.json({
    row,
    notes,
    timeline,
  });
}
