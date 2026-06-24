import { NextResponse } from "next/server";
import { loadCopilotSnapshot } from "@/lib/ai/copilot/snapshot";
import { resolveCopilotContext } from "@/lib/ai/permissions";
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

  const ctx = await resolveCopilotContext(supabase, user.id);
  if (!ctx?.schoolId || !ctx.copilotEnabled || !ctx.roleResolved) {
    return NextResponse.json({
      schoolName: ctx?.schoolName ?? "Your School",
      studentCount: 0,
      attendanceRate: 0,
      outstandingFees: 0,
      syllabusAlerts: 0,
      actions: [],
    });
  }

  const snapshot = await loadCopilotSnapshot(
    supabase,
    ctx.schoolId,
    ctx.schoolName ?? "Your School"
  );

  return NextResponse.json(snapshot);
}
