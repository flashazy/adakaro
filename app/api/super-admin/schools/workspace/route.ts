import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { loadSuperAdminDashboardWithServiceRole } from "@/lib/super-admin/load-dashboard-data";
import { normalizeSchoolLifecycleStatus } from "@/lib/super-admin/school-lifecycle";
import {
  parseWorkspaceSchoolId,
  SUPER_ADMIN_WORKSPACE_SCHOOL_COOKIE,
  workspaceSchoolCookieOptions,
  clearWorkspaceSchoolCookieOptions,
} from "@/lib/super-admin/workspace-school";

export async function GET() {
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

  const loaded = await loadSuperAdminDashboardWithServiceRole();
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.message }, { status: 500 });
  }

  const schools = loaded.schools
    .filter((s) => s.school_status !== "archived")
    .map((s) => ({
      id: s.id,
      name: s.name,
      plan: s.plan,
      school_status: normalizeSchoolLifecycleStatus(s.school_status),
      student_count: s.student_count,
      health_score: s.health_score,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ schools });
}

export async function POST(request: Request) {
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

  let body: { schoolId?: string };
  try {
    body = (await request.json()) as { schoolId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const schoolId = parseWorkspaceSchoolId(body.schoolId);
  if (!schoolId) {
    return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: school, error } = await admin
      .from("schools")
      .select("id, name")
      .eq("id", schoolId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!school) {
      return NextResponse.json({ error: "School not found." }, { status: 404 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not verify school.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SUPER_ADMIN_WORKSPACE_SCHOOL_COOKIE,
    schoolId,
    workspaceSchoolCookieOptions()
  );
  return response;
}

export async function DELETE() {
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

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SUPER_ADMIN_WORKSPACE_SCHOOL_COOKIE,
    "",
    clearWorkspaceSchoolCookieOptions()
  );
  return response;
}
