import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { runChatInboxUnreadCount } from "@/lib/chat/poll-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runChatInboxUnreadCount(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ count: result.count });
}
