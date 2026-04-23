import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BroadcastBanner } from "@/app/(dashboard)/school-admin/components/BroadcastBanner";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { TeacherDashboardHeader } from "@/components/layout/TeacherDashboardHeader";
import { getDisplayName } from "@/lib/display-name";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import { isSchoolAdminBroadcastAudience } from "@/lib/broadcasts/school-admin-audience";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { SchoolPrimaryCssVars } from "@/components/school-branding/school-primary-css-vars";
import { DashboardFeedbackProvider } from "@/components/dashboard/dashboard-feedback-provider";

export default async function DashboardGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const profileRow = profile as {
    full_name: string;
    role: string;
    avatar_url: string | null;
  } | null;
  const fullName = getDisplayName(user, profileRow?.full_name ?? null);

  const schoolDisplayForLayout = await resolveSchoolDisplay(user.id, supabase);
  const schoolIdForDual = schoolDisplayForLayout?.schoolId ?? null;
  const cookieStore = await cookies();
  const dashboardModeCookie = cookieStore.get("school_dashboard_mode")?.value;

  let dualSchoolDashboard = false;
  if (profileRow?.role === "teacher" && schoolIdForDual) {
    try {
      const ac = createAdminClient();
      const { data: mem } = await ac
        .from("school_members")
        .select("id, role, promoted_from_teacher_at")
        .eq("school_id", schoolIdForDual)
        .eq("user_id", user.id)
        .maybeSingle();
      const row = mem as {
        id: string;
        role: string;
        promoted_from_teacher_at: string | null;
      } | null;
      dualSchoolDashboard = Boolean(
        row &&
          (row.role === "admin" || row.promoted_from_teacher_at != null)
      );
    } catch {
      dualSchoolDashboard = false;
    }
  }

  const isSchoolAdminOrPlatform =
    profileRow?.role === "admin" || profileRow?.role === "super_admin";
  const isTeacherUser =
    profileRow?.role === "teacher" ||
    (!isSchoolAdminOrPlatform && (await checkIsTeacher(supabase, user.id)));

  const useAdminShellForDualTeacher =
    isTeacherUser &&
    dualSchoolDashboard &&
    dashboardModeCookie === "admin";

  if (isTeacherUser && !useAdminShellForDualTeacher) {
    const schoolDisplay = schoolDisplayForLayout;
    const { data: teacherDeptRoleRow } = await supabase
      .from("teacher_department_roles")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    const hasDepartmentRole = Boolean(teacherDeptRoleRow);
    const { data: academicDeptRow } = await supabase
      .from("teacher_department_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("department", "academic")
      .limit(1)
      .maybeSingle();
    const hasAcademicDepartmentRole = Boolean(academicDeptRow);
    const { data: coordinatorRow } = await supabase
      .from("teacher_coordinators")
      .select("id")
      .eq("teacher_id", user.id)
      .limit(1)
      .maybeSingle();
    const isCoordinator = Boolean(coordinatorRow);
    return (
      <>
        <SchoolPrimaryCssVars primaryColor={schoolDisplay?.primary_color} />
        <a
          href="#page-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-school-primary focus:px-3 focus:py-2 focus:text-white print:hidden"
        >
          Skip to content
        </a>
        <div className="print:hidden">
          <TeacherDashboardHeader
            fullName={fullName}
            schoolLogoUrl={schoolDisplay?.logo_url ?? null}
            schoolLogoVersion={schoolDisplay?.logo_version ?? null}
            schoolName={schoolDisplay?.name ?? null}
            schoolCurrency={schoolDisplay?.currency ?? null}
            avatarUrl={profileRow?.avatar_url ?? null}
            hasDepartmentRole={hasDepartmentRole}
            hasAcademicDepartmentRole={hasAcademicDepartmentRole}
            isCoordinator={isCoordinator}
            showDashboardRoleToggle={dualSchoolDashboard}
          />
        </div>
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 print:min-h-0 print:bg-white">
          <div
            id="page-content"
            className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8 print:max-w-none print:bg-white print:px-0 print:pb-0 print:pt-0"
          >
            {children}
          </div>
        </div>
      </>
    );
  }

  const isSuperAdmin = await checkIsSuperAdmin(supabase, user.id);
  const showSchoolAdminBroadcasts = await isSchoolAdminBroadcastAudience(
    user.id,
    supabase,
    isSuperAdmin
  );

  const schoolDisplay = schoolDisplayForLayout;

  let hasParentStudents = false;
  const parentLinks = await supabase
    .from("parent_students")
    .select("id")
    .eq("parent_id", user.id)
    .limit(1);
  if (!parentLinks.error && (parentLinks.data?.length ?? 0) > 0) {
    hasParentStudents = true;
  } else {
    try {
      const admin = createAdminClient();
      const fallback = await admin
        .from("parent_students")
        .select("id")
        .eq("parent_id", user.id)
        .limit(1);
      hasParentStudents = (fallback.data?.length ?? 0) > 0;
    } catch {
      /* no service role */
    }
  }

  return (
    <>
      <SchoolPrimaryCssVars primaryColor={schoolDisplay?.primary_color} />
      <a
        href="#page-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-school-primary focus:px-3 focus:py-2 focus:text-white print:hidden"
      >
        Skip to content
      </a>
      <div className="print:hidden">
        <DashboardHeader
          fullName={fullName}
          isSuperAdmin={isSuperAdmin}
          showParentDashboardLink={hasParentStudents}
          schoolLogoUrl={schoolDisplay?.logo_url ?? null}
          schoolLogoVersion={schoolDisplay?.logo_version ?? null}
          schoolName={schoolDisplay?.name ?? null}
          schoolCurrency={schoolDisplay?.currency ?? null}
          avatarUrl={profileRow?.avatar_url ?? null}
          showDashboardRoleToggle={
            dualSchoolDashboard && profileRow?.role === "teacher"
          }
        />
      </div>
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 print:min-h-0 print:bg-white">
        <div
          id="page-content"
          className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8 print:max-w-none print:bg-white print:px-0 print:pb-0 print:pt-0"
        >
          <DashboardFeedbackProvider>
            <BroadcastBanner showBroadcasts={showSchoolAdminBroadcasts} />
            {children}
          </DashboardFeedbackProvider>
        </div>
      </div>
    </>
  );
}
