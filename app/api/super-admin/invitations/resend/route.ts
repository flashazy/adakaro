import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";

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

  let body: { invitationId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const invitationId = String(body.invitationId ?? "").trim();
  if (!invitationId) {
    return NextResponse.json(
      { error: "invitationId is required." },
      { status: 400 }
    );
  }

  const { data: row, error } = await supabase
    .from("school_invitations")
    .select("id, token, status, expires_at, invited_email")
    .eq("id", invitationId)
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: "Invitation not found." },
      { status: 404 }
    );
  }

  const inv = row as {
    token: string;
    status: string;
    expires_at: string;
    invited_email: string;
  };

  if (inv.status !== "pending" || new Date(inv.expires_at) <= new Date()) {
    return NextResponse.json(
      { error: "Invitation is not pending or has expired." },
      { status: 400 }
    );
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  const inviteLink = `${origin.replace(/\/$/, "")}/accept-invitation?token=${encodeURIComponent(inv.token)}`;

  console.info(
    "[super-admin/resend-invite] Resent (log only, email TBD):",
    inviteLink,
    "→",
    inv.invited_email
  );

  return NextResponse.json({ ok: true, inviteLink });
}
