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
import { getPrimaryTeacherAssignmentLabel } from "@/lib/teacher-assignment-status";
import { SchoolPrimaryCssVars } from "@/components/school-branding/school-primary-css-vars";

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

  const isSchoolAdminOrPlatform =
    profileRow?.role === "admin" || profileRow?.role === "super_admin";
  if (
    profileRow?.role === "teacher" ||
    (!isSchoolAdminOrPlatform && (await checkIsTeacher(supabase, user.id)))
  ) {
    const schoolDisplay = await resolveSchoolDisplay(user.id, supabase);
    const primaryAssignmentLabel = await getPrimaryTeacherAssignmentLabel(
      supabase,
      user.id
    );
    const { data: teacherDeptRoleRow } = await supabase
      .from("teacher_department_roles")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    const hasDepartmentRole = Boolean(teacherDeptRoleRow);
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
            primaryAssignmentLabel={primaryAssignmentLabel}
            hasDepartmentRole={hasDepartmentRole}
            isCoordinator={isCoordinator}
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

  const schoolDisplay = await resolveSchoolDisplay(user.id, supabase);

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
        />
      </div>
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 print:min-h-0 print:bg-white">
        <div
          id="page-content"
          className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8 print:max-w-none print:bg-white print:px-0 print:pb-0 print:pt-0"
        >
          <BroadcastBanner showBroadcasts={showSchoolAdminBroadcasts} />
          {children}
        </div>
      </div>
    </>
  );
}
