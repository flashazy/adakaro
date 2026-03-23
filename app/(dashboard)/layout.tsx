import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { getDisplayName } from "@/lib/display-name";
import { checkIsSuperAdmin } from "@/lib/super-admin";

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
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const profileRow = profile as { full_name: string; role: string } | null;
  const fullName = getDisplayName(user, profileRow?.full_name ?? null);
  const isSuperAdmin = await checkIsSuperAdmin(supabase, user.id);

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
      <a
        href="#page-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <DashboardHeader
        fullName={fullName}
        isSuperAdmin={isSuperAdmin}
        showParentDashboardLink={hasParentStudents}
      />
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
        <div
          id="page-content"
          className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8"
        >
          {children}
        </div>
      </div>
    </>
  );
}
