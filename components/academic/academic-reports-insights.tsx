import { Calendar, FileBarChart, Layers, Sparkles } from "lucide-react";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import { academicSectionHeadingClass } from "./academic-ui-styles";
import { AcademicStatCard } from "./academic-stat-card";

export interface AcademicReportsInsightsData {
  totalReports: number;
  classesCovered: number;
  latestGeneratedLabel: string | null;
  latestTermLabel: string | null;
}

interface AcademicReportsInsightsProps {
  data: AcademicReportsInsightsData;
}

export function AcademicReportsInsights({ data }: AcademicReportsInsightsProps) {
  const academicYear = currentAcademicYear();

  return (
    <section aria-label="Reports summary" className="space-y-3">
      <div>
        <h2 className={academicSectionHeadingClass}>Reports overview</h2>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-zinc-400">
          Auto-generated when coordinators run{" "}
          <span className="font-medium text-slate-800 dark:text-zinc-200">
            Generate Report Cards
          </span>
          . Use these summaries to track outcomes and subject-level performance.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-lg:auto-rows-fr max-lg:[&>*]:h-full lg:grid-cols-4">
        <AcademicStatCard
          label="Total Reports"
          value={data.totalReports.toLocaleString()}
          icon={FileBarChart}
          accent="indigo"
        />
        <AcademicStatCard
          label="Current Academic Year"
          value={academicYear}
          hint="Calendar year in use"
          icon={Calendar}
          accent="blue"
        />
        <AcademicStatCard
          label="Latest Generated Report"
          value={data.latestGeneratedLabel ?? "—"}
          hint={data.latestTermLabel ?? "No reports yet"}
          icon={Sparkles}
          accent="purple"
          valueSize="compact"
          className="max-lg:[&>div:last-child]:mt-2"
        />
        <AcademicStatCard
          label="Classes Covered"
          value={data.classesCovered.toLocaleString()}
          hint="Distinct classes with reports"
          icon={Layers}
          accent="slate"
        />
      </div>
    </section>
  );
}
