import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { runTeacherInboxPoll } from "@/lib/chat/poll-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("conversationId");
  const activeConversationId =
    raw && raw.trim().length > 0 ? raw.trim() : null;

  const result = await runTeacherInboxPoll(user.id, activeConversationId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
