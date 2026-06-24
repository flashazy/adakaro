import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateChatStream } from "@/lib/ai/generate";
import type { AIProduct, ChatRequestBody } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AI_SESSION_COOKIE = "adakaro_ai_session";

function encodeSse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/** Lightweight health check so clients can verify the route is registered. */
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/ai/chat" });
}

export async function POST(request: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const product = body.product;
  if (product !== "public" && product !== "copilot") {
    return new Response(JSON.stringify({ error: "Invalid product." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = body.message?.trim();
  if (!message) {
    return new Response(JSON.stringify({ error: "Message is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (product === "copilot" && !user) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let anonymousSessionId = body.anonymousSessionId ?? null;
  if (product === "public" && !anonymousSessionId) {
    anonymousSessionId =
      request.cookies.get(AI_SESSION_COOKIE)?.value ??
      crypto.randomUUID();
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of generateChatStream({
          supabase,
          product: product as AIProduct,
          message,
          conversationId: body.conversationId,
          userId: user?.id ?? null,
          anonymousSessionId,
        })) {
          controller.enqueue(encoder.encode(encodeSse(event)));
        }
      } catch (err) {
        console.error("[ai/chat] stream:", err);
        controller.enqueue(
          encoder.encode(
            encodeSse({ type: "error", error: "Something went wrong." })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };

  if (product === "public" && anonymousSessionId) {
    headers["Set-Cookie"] =
      `${AI_SESSION_COOKIE}=${anonymousSessionId}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax; HttpOnly`;
  }

  return new Response(stream, { headers });
}
