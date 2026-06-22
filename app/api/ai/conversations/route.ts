import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listUserConversations, loadConversationMessages } from "@/lib/ai/conversations";
import type { AIProduct } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const product = (request.nextUrl.searchParams.get("product") ??
    "copilot") as AIProduct;

  if (product === "copilot") {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const conversations = await listUserConversations(
      supabase,
      user.id,
      "copilot"
    );
    return NextResponse.json({ conversations });
  }

  return NextResponse.json({ conversations: [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let body: { conversationId?: string };
  try {
    body = (await request.json()) as { conversationId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (!body.conversationId) {
    return NextResponse.json({ error: "conversationId required." }, { status: 400 });
  }

  const messages = await loadConversationMessages(supabase, body.conversationId);
  return NextResponse.json({ messages, userId: user?.id ?? null });
}
