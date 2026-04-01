import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin-activity-log";
import { notifyPlanChangeIfNeeded } from "@/lib/notifications/super-admin-email";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { isSchoolCurrencyCode } from "@/lib/currency";
import { normalizePlanId } from "@/lib/plans";

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

  let body: { schoolId?: string; name?: string; currency?: string; plan?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const schoolId = String(body.schoolId ?? "").trim();
  const name = String(body.name ?? "").trim();
  const currencyRaw = String(body.currency ?? "").trim().toUpperCase();
  const hasPlan = body.plan !== undefined && body.plan !== null;
  const normalizedPlan = hasPlan ? normalizePlanId(String(body.plan)) : undefined;

  if (!schoolId || !name) {
    return NextResponse.json(
      { error: "schoolId and name are required." },
      { status: 400 }
    );
  }

  if (!isSchoolCurrencyCode(currencyRaw)) {
    return NextResponse.json({ error: "Invalid currency." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[super-admin/edit] service role client", e);
    return NextResponse.json(
      {
        error:
          "Server configuration error. Ensure SUPABASE_SERVICE_ROLE_KEY is set.",
      },
      { status: 500 }
    );
  }

  const { data: before } = await admin
    .from("schools")
    .select("name, currency, plan")
    .eq("id", schoolId)
    .maybeSingle();
  const prev = before as { name: string; currency: string; plan: string } | null;

  const patch: Record<string, string> = {
    name,
    currency: currencyRaw,
    updated_at: new Date().toISOString(),
  };
  if (hasPlan && normalizedPlan !== undefined) {
    patch.plan = normalizedPlan;
  }

  const { data: updated, error } = await admin
    .from("schools")
    .update(patch as never)
    .eq("id", schoolId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[super-admin/edit]", error);
    return NextResponse.json(
      { error: error.message || "Update failed." },
      { status: 500 }
    );
  }

  if (!updated) {
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }

  void logAdminAction({
    userId: user.id,
    action: "edit_school",
    schoolId,
    details: {
      previous: prev
        ? {
            name: prev.name,
            currency: prev.currency,
            plan: prev.plan,
          }
        : null,
      updated: {
        name,
        currency: currencyRaw,
        ...(hasPlan && normalizedPlan !== undefined
          ? { plan: normalizedPlan }
          : {}),
      },
    },
    request,
  });

  if (
    hasPlan &&
    normalizedPlan !== undefined &&
    prev &&
    prev.plan !== normalizedPlan
  ) {
    void notifyPlanChangeIfNeeded({
      schoolId,
      schoolName: name,
      performedByEmail: user.email?.trim() || "unknown",
      oldPlan: prev.plan,
      newPlan: normalizedPlan,
    });
  }

  return NextResponse.json({
    ok: true,
    ...(normalizedPlan !== undefined ? { plan: normalizedPlan } : {}),
  });
}
