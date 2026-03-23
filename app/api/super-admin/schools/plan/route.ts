import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
  const plan = normalizePlanId(body.plan ?? "free");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("schools")
    .update({ plan, updated_at: new Date().toISOString() } as never)
    .eq("id", schoolId);

  if (error) {
    console.error("[super-admin/plan]", error);
    return NextResponse.json(
      { error: error.message || "Update failed." },
      { status: 500 }
    );
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
