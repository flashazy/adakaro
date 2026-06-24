import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { logAdminAction } from "@/lib/admin-activity-log";
import { loadCopilotRollout } from "@/lib/ai/copilot-rollout";

export const dynamic = "force-dynamic";

/** GET /api/super-admin/schools/copilot — rollout stats + per-school status. */
export async function GET() {
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

  const rollout = await loadCopilotRollout();
  if (!rollout) {
    return NextResponse.json(
      {
        error:
          "Could not load Copilot rollout. Ensure SUPABASE_SERVICE_ROLE_KEY is set.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, rollout });
}

/**
 * POST /api/super-admin/schools/copilot
 * Body: { schoolId: string, enabled: boolean }
 * Enables/disables Adakaro Copilot for a single school. Super admin only.
 */
export async function POST(request: NextRequest) {
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

  let body: { schoolId?: unknown; enabled?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const schoolId =
    typeof body.schoolId === "string" ? body.schoolId.trim() : "";
  const enabled = body.enabled === true;

  if (!schoolId) {
    return NextResponse.json(
      { error: "schoolId is required." },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[copilot-toggle] service role client", e);
    return NextResponse.json(
      {
        error:
          "Server configuration error. Ensure SUPABASE_SERVICE_ROLE_KEY is set.",
      },
      { status: 500 }
    );
  }

  const { data, error } = await admin
    .from("schools")
    .update({
      copilot_enabled: enabled,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", schoolId)
    .select("id, name, copilot_enabled")
    .maybeSingle();

  if (error) {
    console.error("[copilot-toggle]", error);
    return NextResponse.json(
      { error: error.message || "Update failed." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }

  const row = data as {
    id: string;
    name: string;
    copilot_enabled: boolean;
  };

  void logAdminAction({
    userId: user.id,
    action: enabled ? "enable_copilot" : "disable_copilot",
    schoolId,
    details: { copilot_enabled: enabled },
    request,
  });

  return NextResponse.json({
    ok: true,
    school: {
      id: row.id,
      name: row.name,
      copilotEnabled: Boolean(row.copilot_enabled),
    },
  });
}
