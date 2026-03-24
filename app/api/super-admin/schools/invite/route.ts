import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { normalizePlanId } from "@/lib/plans";
import { effectiveAdminLimit } from "@/lib/plan-limits";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

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

  let body: { schoolId?: string; email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const schoolId = String(body.schoolId ?? "").trim();
  const email = normalizeEmail(String(body.email ?? ""));
  if (!schoolId || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Valid schoolId and email are required." },
      { status: 400 }
    );
  }

  const { data: school } = await supabase
    .from("schools")
    .select("id, plan, student_limit, admin_limit")
    .eq("id", schoolId)
    .single();

  if (!school) {
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }

  const s = school as {
    plan: string;
    student_limit: number | null;
    admin_limit: number | null;
  };
  const plan = normalizePlanId(s.plan);
  const maxAdmins = effectiveAdminLimit({
    plan: s.plan,
    student_limit: s.student_limit,
    admin_limit: s.admin_limit,
  });

  const { count: adminCount } = await supabase
    .from("school_members")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("role", "admin");

  const { count: pendingCount } = await supabase
    .from("school_invitations")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());

  const used = (adminCount ?? 0) + (pendingCount ?? 0);
  if (maxAdmins != null && used >= maxAdmins) {
    return NextResponse.json(
      {
        error: `This school has reached its admin limit (${maxAdmins}) for the ${plan} plan.`,
        code: "limit_reached",
        upgradeUrl: "/pricing",
      },
      { status: 403 }
    );
  }

  const { data: already } = await supabase.rpc(
    "is_email_already_school_admin",
    { p_school_id: schoolId, p_email: email } as never
  );

  if (already) {
    return NextResponse.json(
      { error: "That user is already an admin for this school." },
      { status: 409 }
    );
  }

  const token = randomBytes(32).toString("hex");
  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  const inviteLink = `${origin.replace(/\/$/, "")}/accept-invitation?token=${encodeURIComponent(token)}`;

  const { error: insErr } = await supabase.from("school_invitations").insert({
    school_id: schoolId,
    invited_email: email,
    invited_by: user.id,
    token,
    status: "pending",
  } as never);

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json(
        { error: "A pending invite already exists for this email." },
        { status: 409 }
      );
    }
    console.error("[super-admin/invite]", insErr);
    return NextResponse.json(
      { error: insErr.message || "Could not create invitation." },
      { status: 500 }
    );
  }

  console.info("[super-admin/invite] Link:", inviteLink);

  return NextResponse.json({ ok: true, email, inviteLink });
}
