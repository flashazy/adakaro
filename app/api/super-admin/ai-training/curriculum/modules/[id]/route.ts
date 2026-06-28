import { NextRequest, NextResponse } from "next/server";
import { CURRICULUM_MODULES } from "@/lib/ai-training/knowledge-curriculum";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const valid = CURRICULUM_MODULES.some((m) => m.id === id);
  if (!valid) {
    return NextResponse.json({ error: "Unknown curriculum module." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    targetLessons?: number;
  };

  if (
    body.targetLessons == null ||
    !Number.isFinite(body.targetLessons) ||
    body.targetLessons < 1
  ) {
    return NextResponse.json(
      { error: "targetLessons must be a positive number." },
      { status: 400 }
    );
  }

  const { dataClient } = auth;

  const { error } = await dataClient.from("ai_curriculum_module_targets").upsert(
    {
      module_id: id,
      target_lessons: Math.round(body.targetLessons),
    } as never,
    { onConflict: "module_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    moduleId: id,
    targetLessons: Math.round(body.targetLessons),
  });
}
