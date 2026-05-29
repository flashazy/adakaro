import type { AcademicWorkspaceOverview } from "@/lib/academic/load-academic-workspace-overview.server";

interface AcademicDepartmentSummaryStripProps {
  overview: AcademicWorkspaceOverview;
  showPromotionReady: boolean;
}

export function AcademicDepartmentSummaryStrip({
  overview,
  showPromotionReady,
}: AcademicDepartmentSummaryStripProps) {
  const items: { value: string; label: string }[] = [
    {
      value: overview.totalStudents.toLocaleString(),
      label: "Students",
    },
    {
      value: overview.totalClasses.toLocaleString(),
      label: "Classes",
    },
    {
      value: overview.reportsGenerated.toLocaleString(),
      label: "Reports",
    },
  ];

  if (
    showPromotionReady &&
    overview.promotionReadyStudents != null
  ) {
    items.push({
      value: overview.promotionReadyStudents.toLocaleString(),
      label: "Promotion Ready",
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/30"
      aria-label="Department summary"
    >
      {items.map((item, index) => (
        <span key={item.label} className="inline-flex items-center gap-3">
          {index > 0 ? (
            <span
              className="hidden text-slate-300 sm:inline dark:text-zinc-600"
              aria-hidden
            >
              ·
            </span>
          ) : null}
          <span className="text-sm">
            <span className="font-bold tabular-nums text-slate-900 dark:text-white">
              {item.value}
            </span>{" "}
            <span className="text-slate-500 dark:text-zinc-400">{item.label}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
