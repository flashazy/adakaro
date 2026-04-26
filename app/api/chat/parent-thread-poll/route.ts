import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { runParentThreadPoll } from "@/lib/chat/poll-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversationId =
    request.nextUrl.searchParams.get("conversationId")?.trim() ?? "";
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 }
    );
  }

  const result = await runParentThreadPoll(user.id, conversationId);
  if (!result.ok) {
    const status = result.error === "Not allowed" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
