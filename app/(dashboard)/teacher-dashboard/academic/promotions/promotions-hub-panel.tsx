import { AcademicPromotionsStatus } from "@/components/academic/academic-promotions-status";
import type { AcademicPromotionDisplayOverview } from "@/lib/academic/academic-promotions-display.server";
import { PromotionsClient } from "@/app/(dashboard)/dashboard/promotions/promotions-client";
import type { PromotionsPageViewProps } from "@/app/(dashboard)/dashboard/promotions/promotions-page-view";

interface PromotionsHubPanelProps extends PromotionsPageViewProps {
  promotionDisplayOverview: AcademicPromotionDisplayOverview | null;
}

export function PromotionsHubPanel({
  academicYear,
  tracks,
  classes,
  setupClasses,
  promotionDisplayOverview,
}: PromotionsHubPanelProps) {
  return (
    <div className="space-y-4">
      {promotionDisplayOverview ? (
        <AcademicPromotionsStatus
          overview={promotionDisplayOverview}
          academicYear={academicYear}
        />
      ) : null}
      <PromotionsClient
        academicYear={academicYear}
        tracks={tracks}
        classes={classes}
        setupClasses={setupClasses}
        classDisplayStats={promotionDisplayOverview?.byClassId}
        presentationVariant="academic"
      />
    </div>
  );
}
