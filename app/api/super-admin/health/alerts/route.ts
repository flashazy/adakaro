import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

type AlertStatus = "open" | "resolved" | "ignored";

type HealthAlertRow = {
  id: string;
  school_id: string | null;
  feature: string;
  severity: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  status: AlertStatus;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  created_at: string;
  schools: { name: string } | { name: string }[] | null;
};

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  if (!(await checkIsSuperAdmin(supabase, user.id))) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const status = request.nextUrl.searchParams.get("status")?.trim() as
    | AlertStatus
    | "all"
    | "";
  const severity = request.nextUrl.searchParams.get("severity")?.trim();

  const admin = createAdminClient();
  let q = admin
    .from("health_alerts")
    .select(
      "id, school_id, feature, severity, title, message, metadata, status, first_seen_at, last_seen_at, resolved_at, created_at, schools ( name )"
    )
    .order("last_seen_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") {
    q = q.eq("status", status);
  }
  if (severity === "critical") {
    q = q.eq("severity", "critical");
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as HealthAlertRow[];
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();

  const alerts = rows.map((r) => {
    const schoolJoin = r.schools;
    const schoolName = Array.isArray(schoolJoin)
      ? schoolJoin[0]?.name
      : schoolJoin?.name;
    return {
      id: r.id,
      schoolId: r.school_id,
      schoolName: schoolName?.trim() || null,
      feature: r.feature,
      severity: r.severity,
      title: r.title,
      message: r.message,
      metadata: r.metadata,
      status: r.status,
      firstSeenAt: r.first_seen_at,
      lastSeenAt: r.last_seen_at,
      resolvedAt: r.resolved_at,
      createdAt: r.created_at,
    };
  });

  const [
    { count: openCount },
    { count: criticalCount },
    { count: resolvedTodayCount },
  ] = await Promise.all([
    admin
      .from("health_alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    admin
      .from("health_alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .eq("severity", "critical"),
    admin
      .from("health_alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolved")
      .gte("resolved_at", startOfToday),
  ]);

  return NextResponse.json({
    alerts,
    stats: {
      open: openCount ?? 0,
      critical: criticalCount ?? 0,
      resolvedToday: resolvedTodayCount ?? 0,
      lastChecked: now.toISOString(),
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if ("error" in auth && auth.error) return auth.error;

  let body: { id?: string; status?: AlertStatus };
  try {
    body = (await request.json()) as { id?: string; status?: AlertStatus };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const id = body.id?.trim();
  const status = body.status;
  if (!id || (status !== "resolved" && status !== "ignored" && status !== "open")) {
    return NextResponse.json({ error: "Invalid id or status." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const patch: Record<string, unknown> = { status, last_seen_at: now };
  if (status === "resolved" || status === "ignored") {
    patch.resolved_at = now;
  } else {
    patch.resolved_at = null;
  }

  const { error } = await admin
    .from("health_alerts")
    .update(patch as never)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
