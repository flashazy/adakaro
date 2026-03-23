import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePlanId, type PlanId } from "@/lib/plans";

const PLAN_ORDER: PlanId[] = ["free", "basic", "pro", "enterprise"];

function planRank(p: PlanId): number {
  return PLAN_ORDER.indexOf(p);
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
  // Client may send currentPlan for display parity; authoritative plan is read from DB below.
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required." }, { status: 400 });
  }

  const { data: isAdmin, error: rpcErr } = await supabase.rpc(
    "is_school_admin",
    { p_school_id: schoolId } as never
  );
  if (rpcErr || !isAdmin) {
    return NextResponse.json(
      { error: "You must be an admin of this school." },
      { status: 403 }
    );
  }

  const userSchool = await supabase
    .from("schools")
    .select("plan")
    .eq("id", schoolId)
    .maybeSingle();

  let planRaw: string | null | undefined;

  if (!userSchool.error && userSchool.data) {
    planRaw = (userSchool.data as { plan: string | null }).plan;
  } else {
    try {
      const admin = createAdminClient();
      const { data: adminRow, error: adminSchoolErr } = await admin
        .from("schools")
        .select("plan")
        .eq("id", schoolId)
        .maybeSingle();
      if (!adminSchoolErr && adminRow) {
        planRaw = (adminRow as { plan: string | null }).plan;
      }
    } catch (e) {
      console.error("[upgrade-request] admin school read unavailable", e);
    }
  }

  if (planRaw === undefined) {
    return NextResponse.json(
      {
        error:
          "Could not load school plan. Ensure SUPABASE_SERVICE_ROLE_KEY is set on the server if RLS blocks school reads.",
      },
      { status: 400 }
    );
  }

  const currentPlan = normalizePlanId(planRaw);

  if (planRank(requestedPlan) <= planRank(currentPlan)) {
    return NextResponse.json(
      { error: "Choose a higher plan than your current one." },
      { status: 400 }
    );
  }

  const { error: insertErr } = await supabase.from("upgrade_requests").insert({
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
