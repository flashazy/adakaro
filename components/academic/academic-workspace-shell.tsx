import { AcademicHubTabs } from "@/components/layout/AcademicHubTabs";
import type { AcademicWorkspaceOverview } from "@/lib/academic/load-academic-workspace-overview.server";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import { AcademicDepartmentSummaryStrip } from "./academic-department-summary-strip";
import { AcademicOverviewCards } from "./academic-overview-cards";
import { AcademicQuickActions } from "./academic-quick-actions";
import {
  academicSectionDividerClass,
  academicSectionStackClass,
} from "./academic-ui-styles";

interface AcademicWorkspaceShellProps {
  overview: AcademicWorkspaceOverview;
  showPromotions: boolean;
  children: React.ReactNode;
}

export function AcademicWorkspaceShell({
  overview,
  showPromotions,
  children,
}: AcademicWorkspaceShellProps) {
  const academicYear = currentAcademicYear();

  return (
    <div className="pb-3">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-school-primary dark:text-school-primary">
            Academic Department
          </p>
          <span className="inline-flex items-center rounded-full border border-slate-200/60 bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900/40 dark:text-zinc-400">
            {academicYear} Academic Year
          </span>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[1.65rem]">
            Academic Department
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Manage student records, academic reports, and year-end promotions
            from a single workspace.
          </p>
        </div>
        <AcademicDepartmentSummaryStrip
          overview={overview}
          showPromotionReady={showPromotions}
        />
      </header>

      <div className={`${academicSectionStackClass} ${academicSectionDividerClass}`}>
        <AcademicOverviewCards
          overview={overview}
          showPromotionCard={showPromotions}
        />
      </div>

      <div className={`${academicSectionStackClass} ${academicSectionDividerClass}`}>
        <AcademicQuickActions showPromotions={showPromotions} />
      </div>

      <div
        className={`sticky top-14 z-30 -mx-4 bg-slate-50/95 px-4 pb-0 pt-2.5 backdrop-blur-md supports-[backdrop-filter]:bg-slate-50/85 dark:bg-zinc-950/90 sm:-mx-6 sm:px-6 md:top-[4.5rem] ${academicSectionStackClass} ${academicSectionDividerClass}`}
        data-academic-sticky-tabs
      >
        <AcademicHubTabs showPromotions={showPromotions} />
      </div>

      <div className="min-w-0 pt-3">{children}</div>
    </div>
  );
}
