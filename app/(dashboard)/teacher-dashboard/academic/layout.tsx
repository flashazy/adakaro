import { AcademicWorkspaceShell } from "@/components/academic/academic-workspace-shell";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { loadAcademicWorkspaceOverview } from "@/lib/academic/load-academic-workspace-overview.server";
import { canAccessSchoolPromotions } from "@/lib/promotions/promotions-access.server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AcademicHubLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  const showPromotions = schoolId
    ? await canAccessSchoolPromotions(supabase, user.id, schoolId)
    : false;

  const overview = await loadAcademicWorkspaceOverview(supabase, schoolId, {
    includePromotionStats: showPromotions,
  });

  return (
    <AcademicWorkspaceShell
      overview={overview}
      showPromotions={showPromotions}
    >
      {children}
    </AcademicWorkspaceShell>
  );
}
