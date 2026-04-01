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

  let body: { schoolId?: string; userId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const schoolId = String(body.schoolId ?? "").trim();
  const targetUserId = String(body.userId ?? "").trim();
  if (!schoolId || !targetUserId) {
    return NextResponse.json(
      { error: "schoolId and userId are required." },
      { status: 400 }
    );
  }

  const { data: school } = await supabase
    .from("schools")
    .select("created_by")
    .eq("id", schoolId)
    .single();

  if (!school) {
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }

  if (targetUserId === (school as { created_by: string }).created_by) {
    return NextResponse.json(
      { error: "Cannot remove the school creator." },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("school_members")
    .delete()
    .eq("school_id", schoolId)
    .eq("user_id", targetUserId);

  if (error) {
    console.error("[super-admin/remove-member]", error);
    return NextResponse.json(
      { error: error.message || "Remove failed." },
      { status: 500 }
    );
  }

  void logAdminAction({
    userId: user.id,
    action: "school_member_removed",
    schoolId,
    details: { target_user_id: targetUserId },
    request,
  });

  return NextResponse.json({ ok: true });
}
