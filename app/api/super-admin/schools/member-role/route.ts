import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import type { UserRole } from "@/types/supabase";

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

  let body: { schoolId?: string; userId?: string; role?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const schoolId = String(body.schoolId ?? "").trim();
  const targetUserId = String(body.userId ?? "").trim();
  const role = String(body.role ?? "").toLowerCase().trim() as UserRole;

  if (!schoolId || !targetUserId) {
    return NextResponse.json(
      { error: "schoolId and userId are required." },
      { status: 400 }
    );
  }

  if (role !== "admin" && role !== "parent") {
    return NextResponse.json(
      { error: "role must be admin or parent." },
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

  if (
    targetUserId === (school as { created_by: string }).created_by &&
    role !== "admin"
  ) {
    return NextResponse.json(
      { error: "School creator must remain an admin member." },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("school_members")
    .update({ role } as never)
    .eq("school_id", schoolId)
    .eq("user_id", targetUserId);

  if (error) {
    console.error("[super-admin/member-role]", error);
    return NextResponse.json(
      { error: error.message || "Update failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, role });
}
