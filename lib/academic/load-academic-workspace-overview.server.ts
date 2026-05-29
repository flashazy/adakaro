import "server-only";

import { getPromotionsDataClient } from "@/lib/promotions/promotions-access.server";
import { loadPromotionsPageData } from "@/lib/promotions/load-promotions-page-data.server";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { loadAcademicPromotionDisplayOverview } from "./academic-promotions-display.server";

export interface AcademicWorkspaceOverview {
  totalStudents: number;
  totalClasses: number;
  reportsGenerated: number;
  promotionReadyStudents: number | null;
}

export async function loadAcademicWorkspaceOverview(
  supabase: SupabaseClient<Database>,
  schoolId: string | null,
  options: { includePromotionStats: boolean }
): Promise<AcademicWorkspaceOverview> {
  if (!schoolId) {
    return {
      totalStudents: 0,
      totalClasses: 0,
      reportsGenerated: 0,
      promotionReadyStudents: null,
    };
  }

  const [
    { count: totalStudents },
    { count: totalClasses },
    { count: reportsGenerated },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active")
      .eq("approval_status", "approved"),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("academic_reports")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
  ]);

  let promotionReadyStudents: number | null = null;

  if (options.includePromotionStats) {
    try {
      const db = getPromotionsDataClient(supabase);
      const { classes } = await loadPromotionsPageData(db, schoolId);
      const overview = await loadAcademicPromotionDisplayOverview(
        db,
        schoolId,
        classes,
        currentAcademicYear()
      );
      promotionReadyStudents = overview.readyForPromotion;
    } catch {
      promotionReadyStudents = null;
    }
  }

  return {
    totalStudents: totalStudents ?? 0,
    totalClasses: totalClasses ?? 0,
    reportsGenerated: reportsGenerated ?? 0,
    promotionReadyStudents,
  };
}
