import { NextRequest, NextResponse } from "next/server";
import { loadLessonPlanPdfInput } from "@/app/(dashboard)/teacher-dashboard/lesson-plans/lesson-plan-helpers";
import { buildLessonPlanPdf } from "@/lib/lesson-plan-pdf";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/lesson-plans/export?id=<lesson_plan_uuid>
 * Returns a PDF for the lesson plan if the signed-in user owns it.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id query parameter." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const loaded = await loadLessonPlanPdfInput(id, user.id);
  if (!loaded.ok) {
    const status =
      loaded.error === "Forbidden." || loaded.error.startsWith("Forbidden")
        ? 403
        : 404;
    return NextResponse.json({ error: loaded.error }, { status });
  }

  const bytes = buildLessonPlanPdf(loaded.input);
  const safeName = `lesson-plan-${id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36)}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
