import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/admin-activity-log";
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

  let body: { requestId?: string; approve?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const requestId = String(body.requestId ?? "").trim();
  const approve = body.approve === true;
  if (!requestId) {
    return NextResponse.json({ error: "requestId is required." }, { status: 400 });
  }

  const { data: raw, error } = await supabase.rpc(
    "super_admin_review_upgrade_request",
    { p_request_id: requestId, p_approve: approve } as never
  );

  const result = raw as { ok?: boolean; error?: string } | null;
  if (error) {
    console.error("[upgrade-requests/review]", error);
    return NextResponse.json(
      { error: error.message || "Review failed." },
      { status: 500 }
    );
  }

  if (!result?.ok) {
    const msg =
      result?.error === "not_found"
        ? "Request not found."
        : result?.error === "already_resolved"
          ? "This request was already resolved."
          : result?.error === "forbidden"
            ? "Forbidden."
            : "Review failed.";
    const status =
      result?.error === "not_found" ? 404 : result?.error === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  void logAdminAction({
    userId: user.id,
    action: "review_upgrade_request",
    details: { request_id: requestId, approve },
    request,
  });

  return NextResponse.json({ ok: true });
}
