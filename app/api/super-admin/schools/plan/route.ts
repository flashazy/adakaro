import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
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

  let body: { schoolId?: string; plan?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const schoolId = String(body.schoolId ?? "").trim();
  // Any tier is allowed (upgrade or downgrade); normalizePlanId maps to free|basic|pro|enterprise.
  const plan = normalizePlanId(body.plan ?? "free");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required." }, { status: 400 });
  }

  // Session client's UPDATE on schools hits RLS that can recurse into school_members (42P17).
  // Service role bypasses RLS; super-admin permission was already verified above.
  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[super-admin/plan] service role client", e);
    return NextResponse.json(
      {
        error:
          "Server configuration error. Ensure SUPABASE_SERVICE_ROLE_KEY is set.",
      },
      { status: 500 }
    );
  }

  const { data: updated, error } = await admin
    .from("schools")
    .update({ plan, updated_at: new Date().toISOString() } as never)
    .eq("id", schoolId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[super-admin/plan]", error);
    return NextResponse.json(
      { error: error.message || "Update failed." },
      { status: 500 }
    );
  }

  if (!updated) {
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }

  console.info(
    "[super-admin/plan] Updated school plan:",
    schoolId,
    "→",
    plan,
    "by",
    user.id
  );

  return NextResponse.json({ ok: true, plan });
}
