import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * School metadata + admin user ids for Smart Intelligence contact/broadcast flows.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: schoolId } = await context.params;

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

  try {
    const admin = createAdminClient();

    const [schoolRes, membersRes, studentsRes] = await Promise.all([
      admin
        .from("schools")
        .select("id, name, plan, status")
        .eq("id", schoolId)
        .maybeSingle(),
      admin
        .from("school_members")
        .select("user_id, role")
        .eq("school_id", schoolId),
      admin
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
    ]);

    if (schoolRes.error || !schoolRes.data) {
      return NextResponse.json({ error: "School not found." }, { status: 404 });
    }

    const adminUserIds = [
      ...new Set(
        (membersRes.data ?? [])
          .filter((row) => (row as { role: string }).role === "admin")
          .map((row) => (row as { user_id: string }).user_id)
          .filter(Boolean)
      ),
    ];

    let teacherCount = 0;
    let parentCount = 0;
    for (const row of membersRes.data ?? []) {
      const role = (row as { role: string }).role;
      if (role === "teacher") teacherCount += 1;
      if (role === "parent") parentCount += 1;
    }

    const school = schoolRes.data as {
      id: string;
      name: string;
      plan: string;
      status: string;
    };

    return NextResponse.json({
      school: {
        id: school.id,
        name: school.name,
        plan: school.plan,
        status: school.status,
        studentCount: studentsRes.count ?? 0,
      },
      adminUserIds,
      recipientCounts: {
        admins: adminUserIds.length,
        teachers: teacherCount,
        parents: parentCount,
        total: adminUserIds.length,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load school context.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
