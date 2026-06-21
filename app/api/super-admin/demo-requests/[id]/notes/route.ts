import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { recordDemoTimelineEvent } from "@/lib/demo-requests/timeline";
import type { DemoRequestNote } from "@/lib/demo-requests/types";

export const dynamic = "force-dynamic";

async function resolveActorName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  const profile = data as { full_name: string | null; email: string | null } | null;
  return profile?.full_name?.trim() || profile?.email?.trim() || "Super Admin";
}

export async function POST(
  request: NextRequest,
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

  const body = (await request.json().catch(() => ({}))) as { content?: string };
  const content = String(body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "Note content is required." }, { status: 400 });
  }

  const authorName = await resolveActorName(supabase, user.id);

  const { data, error } = await supabase
    .from("demo_request_notes")
    .insert({
      demo_request_id: id,
      author_id: user.id,
      author_name: authorName,
      content,
    } as never)
    .select("id, demo_request_id, author_id, author_name, content, created_at")
    .maybeSingle();

  if (error) {
    console.error("[demo-requests] note insert:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Could not save note." }, { status: 500 });
  }

  await recordDemoTimelineEvent(supabase, {
    demoRequestId: id,
    eventType: "notes_added",
    label: "Notes Added",
    detail: content.length > 120 ? `${content.slice(0, 117)}…` : content,
    actorId: user.id,
    actorName: authorName,
  });

  return NextResponse.json({ note: data as DemoRequestNote });
}
