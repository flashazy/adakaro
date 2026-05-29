import {
  BarChart3,
  GraduationCap,
  Layers,
  Users,
} from "lucide-react";
import {
  ACADEMIC_PROMOTIONS,
  ACADEMIC_REPORTS,
  ACADEMIC_STUDENT_PROFILES,
} from "@/lib/academic/academic-hub-paths";
import type { AcademicWorkspaceOverview } from "@/lib/academic/load-academic-workspace-overview.server";
import { academicSectionHeadingClass } from "./academic-ui-styles";
import { AcademicStatCard } from "./academic-stat-card";

interface AcademicOverviewCardsProps {
  overview: AcademicWorkspaceOverview;
  showPromotionCard: boolean;
}

export function AcademicOverviewCards({
  overview,
  showPromotionCard,
}: AcademicOverviewCardsProps) {
  return (
    <section aria-label="Academic overview">
      <h2 className={academicSectionHeadingClass}>Key metrics</h2>
      <div
        className={
          showPromotionCard
            ? "mt-2.5 grid grid-cols-2 gap-3 lg:grid-cols-4"
            : "mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3"
        }
      >
        <AcademicStatCard
          label="Total Students"
          value={overview.totalStudents.toLocaleString()}
          hint="Active, approved enrollments"
          icon={Users}
          href={ACADEMIC_STUDENT_PROFILES}
          accent="purple"
        />
        <AcademicStatCard
          label="Total Classes"
          value={overview.totalClasses.toLocaleString()}
          hint="All class groups"
          icon={Layers}
          accent="blue"
        />
        <AcademicStatCard
          label="Academic Reports Generated"
          value={overview.reportsGenerated.toLocaleString()}
          hint="Performance summaries on file"
          icon={BarChart3}
          href={ACADEMIC_REPORTS}
          accent="indigo"
        />
        {showPromotionCard ? (
          <AcademicStatCard
            label="Promotion Ready Students"
            value={
              overview.promotionReadyStudents != null
                ? overview.promotionReadyStudents.toLocaleString()
                : "—"
            }
            hint="Meet Term 2 promotion criteria"
            icon={GraduationCap}
            href={ACADEMIC_PROMOTIONS}
            accent="green"
          />
        ) : null}
      </div>
    </section>
  );
}
