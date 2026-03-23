import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { getPlanLimit, normalizePlanId } from "@/lib/plans";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: { email?: string };
    try {
      body = (await request.json()) as { email?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const email = normalizeEmail(String(body.email ?? ""));
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const schoolId = await getSchoolIdForUser(supabase, user.id);
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school found for your account." },
        { status: 400 }
      );
    }

    const { data: isAdmin, error: adminErr } = await supabase.rpc(
      "is_school_admin",
      { p_school_id: schoolId } as never
    );

    if (adminErr || !isAdmin) {
      return NextResponse.json(
        { error: "You must be a school admin to send invitations." },
        { status: 403 }
      );
    }

    const { data: school, error: schoolErr } = await supabase
      .from("schools")
      .select("id, plan, created_by")
      .eq("id", schoolId)
      .single();

    if (schoolErr || !school) {
      return NextResponse.json(
        { error: "Could not load school." },
        { status: 500 }
      );
    }

    const plan = normalizePlanId(
      (school as { plan?: string }).plan ?? "free"
    );
    const maxAdmins = getPlanLimit(plan, "maxAdmins");

    const { count: adminCountReal, error: countErr } = await supabase
      .from("school_members")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("role", "admin");

    if (countErr) {
      console.error("[invite] admin count", countErr);
      return NextResponse.json(
        { error: "Could not verify admin seats." },
        { status: 500 }
      );
    }

    const { count: pendingCount } = await supabase
      .from("school_invitations")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());

    const admins = adminCountReal ?? 0;
    const pending = pendingCount ?? 0;
    const usedSlots = admins + pending;

    if (usedSlots >= maxAdmins) {
      return NextResponse.json(
        {
          error: `Your ${plan} plan allows up to ${maxAdmins} admin seat(s). Remove a pending invite or upgrade your plan.`,
          code: "limit_reached",
        },
        { status: 409 }
      );
    }

    const callerEmail = normalizeEmail(user.email ?? "");
    if (callerEmail && email === callerEmail) {
      return NextResponse.json(
        { error: "You are already part of this school." },
        { status: 400 }
      );
    }

    const { data: alreadyAdmin, error: dupErr } = await supabase.rpc(
      "is_email_already_school_admin",
      { p_school_id: schoolId, p_email: email } as never
    );

    if (dupErr) {
      console.error("[invite] is_email_already_school_admin", dupErr);
      return NextResponse.json(
        { error: "Could not verify invitee." },
        { status: 500 }
      );
    }

    if (alreadyAdmin) {
      return NextResponse.json(
        { error: "This user is already an administrator for your school." },
        { status: 409 }
      );
    }

    const token = randomBytes(32).toString("hex");
    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "http://localhost:3000";
    const inviteLink = `${origin.replace(/\/$/, "")}/accept-invitation?token=${encodeURIComponent(token)}`;

    const { error: insertErr } = await supabase
      .from("school_invitations")
      .insert({
        school_id: schoolId,
        invited_email: email,
        invited_by: user.id,
        token,
        status: "pending",
      } as never);

    if (insertErr) {
      console.error("[invite] insert", insertErr);
      if (insertErr.code === "23505") {
        return NextResponse.json(
          {
            error:
              "A pending invitation for this email already exists for your school.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: insertErr.message || "Could not create invitation." },
        { status: 500 }
      );
    }

    console.info(
      "[invite] Invitation created (email sending not configured). Link:",
      inviteLink
    );

    return NextResponse.json({
      ok: true,
      email,
      inviteLink,
    });
  } catch (e) {
    console.error("[invite]", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
