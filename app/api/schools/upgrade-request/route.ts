import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { normalizePlanId, type PlanId } from "@/lib/plans";

const PLAN_ORDER: PlanId[] = ["free", "basic", "pro", "enterprise"];

function planRank(p: PlanId): number {
  return PLAN_ORDER.indexOf(p);
}

/**
 * Parse JSON from get_my_school_for_dashboard (jsonb or stringified).
 * Returns null when the user has no school row.
 */
function parseDashboardSchoolFromRpc(raw: unknown): {
  schoolId: string;
  planRaw: string | null;
} | null {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "null") return null;
    try {
      value = JSON.parse(t) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const o = value as Record<string, unknown>;
  const sid =
    typeof o.school_id === "string"
      ? o.school_id
      : o.school_id != null
        ? String(o.school_id)
        : "";
  if (!sid) return null;
  const p = o.plan;
  const planRaw =
    typeof p === "string" && p.trim() ? p.trim() : null;
  return { schoolId: sid, planRaw };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (await checkIsSuperAdmin(supabase, user.id)) {
    return NextResponse.json(
      { error: "Super admins manage plans from the super admin dashboard." },
      { status: 400 }
    );
  }

  let body: { schoolId?: string; requestedPlan?: string; currentPlan?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const schoolId = String(body.schoolId ?? "").trim();
  const requestedPlan = normalizePlanId(body.requestedPlan ?? "free");
  // Client may send currentPlan for display parity; authoritative plan comes from get_my_school_for_dashboard.
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required." }, { status: 400 });
  }

  const { data: dashboardSchool, error: dashRpcErr } = await supabase.rpc(
    "get_my_school_for_dashboard"
  );
  if (dashRpcErr) {
    console.error("[upgrade-request] get_my_school_for_dashboard", dashRpcErr);
    return NextResponse.json(
      { error: dashRpcErr.message || "Could not load school." },
      { status: 500 }
    );
  }

  const parsed = parseDashboardSchoolFromRpc(dashboardSchool);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Could not load your school. You may not be linked to a school yet.",
      },
      { status: 400 }
    );
  }

  if (parsed.schoolId !== schoolId) {
    return NextResponse.json(
      { error: "You must be an admin of this school." },
      { status: 403 }
    );
  }

  const currentPlan = normalizePlanId(parsed.planRaw);

  if (planRank(requestedPlan) <= planRank(currentPlan)) {
    return NextResponse.json(
      { error: "Choose a higher plan than your current one." },
      { status: 400 }
    );
  }

  // RLS on upgrade_requests evaluates is_school_admin() in WITH CHECK, which can recurse into
  // school_members policies. Use service role for admin check + insert after session validation above.
  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[upgrade-request] service role client", e);
    return NextResponse.json(
      {
        error:
          "Server configuration error: could not verify upgrade request. Check SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 }
    );
  }

  const { data: memberRow } = await admin
    .from("school_members")
    .select("role")
    .eq("school_id", schoolId)
    .eq("user_id", user.id)
    .maybeSingle();

  const isMemberAdmin =
    memberRow != null && (memberRow as { role: string }).role === "admin";

  let isFoundingCreator = false;
  if (!isMemberAdmin) {
    const { data: schoolRow } = await admin
      .from("schools")
      .select("id")
      .eq("id", schoolId)
      .eq("created_by", user.id)
      .maybeSingle();
    isFoundingCreator = schoolRow != null;
  }

  if (!isMemberAdmin && !isFoundingCreator) {
    return NextResponse.json(
      { error: "You must be an admin of this school." },
      { status: 403 }
    );
  }

  const { error: insertErr } = await admin.from("upgrade_requests").insert({
    school_id: schoolId,
    requested_by: user.id,
    current_plan: currentPlan,
    requested_plan: requestedPlan,
    status: "pending",
  } as never);

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { error: "A pending upgrade request already exists for this school." },
        { status: 409 }
      );
    }
    console.error("[upgrade-request]", insertErr);
    return NextResponse.json(
      { error: insertErr.message || "Could not submit request." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
