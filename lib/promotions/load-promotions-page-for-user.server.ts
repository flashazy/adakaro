import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canAccessSchoolPromotions,
  getPromotionsDataClient,
  resolvePromotionsSchoolId,
} from "@/lib/promotions/promotions-access.server";
import { loadPromotionsPageData } from "@/lib/promotions/load-promotions-page-data.server";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import type { PromotionsPageViewProps } from "@/app/(dashboard)/dashboard/promotions/promotions-page-view";

export async function loadPromotionsPageForUser(): Promise<PromotionsPageViewProps> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const schoolId = await resolvePromotionsSchoolId(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  const canAccess = await canAccessSchoolPromotions(
    supabase,
    user.id,
    schoolId
  );
  if (!canAccess) redirect("/dashboard");

  const db = getPromotionsDataClient(supabase);
  const { tracks, classes, setupClasses } = await loadPromotionsPageData(
    db,
    schoolId
  );

  return {
    academicYear: currentAcademicYear(),
    tracks,
    classes,
    setupClasses,
  };
}
