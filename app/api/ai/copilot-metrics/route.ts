import { NextResponse } from "next/server";
import { loadCopilotKnowledgeMetrics } from "@/lib/ai/copilot-metrics";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metrics = await loadCopilotKnowledgeMetrics();
  return NextResponse.json(metrics);
}
