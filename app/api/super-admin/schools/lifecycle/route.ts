import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin-activity-log";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import {
  enrichSchoolLifecycle,
  loadSchoolLifecycleMetrics,
} from "@/lib/super-admin/load-school-lifecycle-metrics";
import { normalizeSchoolLifecycleStatus } from "@/lib/super-admin/school-lifecycle";

export const dynamic = "force-dynamic";

type LifecycleAction = "archive" | "restore" | "delete";

/**
 * POST /api/super-admin/schools/lifecycle
 * Body: { schoolId, action: archive|restore|delete, confirm?: "DELETE" }
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

  let body: { schoolId?: string; action?: LifecycleAction; confirm?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const schoolId = body.schoolId?.trim();
  const action = body.action;

  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required." }, { status: 400 });
  }
  if (action !== "archive" && action !== "restore" && action !== "delete") {
    return NextResponse.json(
      { error: "action must be archive, restore, or delete." },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[school-lifecycle] service role client", e);
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  const { data: school, error: schoolErr } = await admin
    .from("schools")
    .select("id, name, school_status")
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolErr) {
    return NextResponse.json({ error: schoolErr.message }, { status: 500 });
  }
  if (!school) {
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }

  const schoolName =
    (school as { name?: string }).name?.trim() || "School";
  const currentStatus = normalizeSchoolLifecycleStatus(
    (school as { school_status?: string }).school_status
  );

  if (action === "archive") {
    if (currentStatus === "archived") {
      return NextResponse.json({ error: "School is already archived." }, { status: 400 });
    }
    const { error } = await admin
      .from("schools")
      .update({
        school_status: "archived",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", schoolId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    void logAdminAction({
      userId: user.id,
      action: "archive_school",
      schoolId,
      details: { school_name: schoolName },
      request,
    });
    return NextResponse.json({ ok: true, school_status: "archived" });
  }

  if (action === "restore") {
    if (currentStatus !== "archived") {
      return NextResponse.json(
        { error: "Only archived schools can be restored." },
        { status: 400 }
      );
    }
    const { error } = await admin
      .from("schools")
      .update({
        school_status: "active",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", schoolId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    void logAdminAction({
      userId: user.id,
      action: "restore_school",
      schoolId,
      details: { school_name: schoolName },
      request,
    });
    return NextResponse.json({ ok: true, school_status: "active" });
  }

  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      { error: 'Typed confirmation required. Send confirm: "DELETE".' },
      { status: 400 }
    );
  }

  const metricsMap = await loadSchoolLifecycleMetrics(admin, [schoolId]);
  const metrics = metricsMap.get(schoolId);
  if (!metrics) {
    return NextResponse.json({ error: "Could not evaluate school data." }, { status: 500 });
  }

  const { data: schoolRow } = await admin
    .from("schools")
    .select("last_activity_at")
    .eq("id", schoolId)
    .maybeSingle();

  const enriched = enrichSchoolLifecycle(
    currentStatus,
    (schoolRow as { last_activity_at?: string | null } | null)?.last_activity_at ??
      null,
    metrics
  );

  if (!enriched.deleteEligibility.allowed) {
    return NextResponse.json(
      { error: enriched.deleteEligibility.reason },
      { status: 400 }
    );
  }

  const { error: deleteErr } = await admin
    .from("schools")
    .delete()
    .eq("id", schoolId);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  void logAdminAction({
    userId: user.id,
    action: "delete_school_permanently",
    schoolId,
    details: { school_name: schoolName },
    request,
  });

  return NextResponse.json({ ok: true, deleted: true });
}
