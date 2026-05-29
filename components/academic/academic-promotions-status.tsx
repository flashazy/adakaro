import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { AcademicPromotionDisplayOverview } from "@/lib/academic/academic-promotions-display.server";
import { academicSectionHeadingClass } from "./academic-ui-styles";
import { AcademicStatCard } from "./academic-stat-card";

interface AcademicPromotionsStatusProps {
  overview: AcademicPromotionDisplayOverview;
  academicYear: number;
}

export function AcademicPromotionsStatus({
  overview,
  academicYear,
}: AcademicPromotionsStatusProps) {
  return (
    <section aria-label="Promotion status" className="space-y-3">
      <div>
        <h2 className={academicSectionHeadingClass}>Promotion readiness</h2>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-zinc-400">
          School-wide readiness for{" "}
          <span className="font-medium text-slate-800 dark:text-zinc-200">
            Term 2, {academicYear}
          </span>
          . Open a class below to review individuals and apply decisions.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AcademicStatCard
          label="Ready for Promotion"
          value={overview.readyForPromotion.toLocaleString()}
          hint="Meet minimum average requirement"
          icon={CheckCircle2}
          accent="green"
        />
        <AcademicStatCard
          label="Below Requirement"
          value={overview.belowRequirement.toLocaleString()}
          hint="Average below promotion threshold"
          icon={AlertCircle}
          accent="amber"
        />
        <AcademicStatCard
          label="Awaiting Results"
          value={overview.awaitingResults.toLocaleString()}
          hint="Missing Term 2 report card average"
          icon={Clock}
          accent="slate"
        />
      </div>
    </section>
  );
}
