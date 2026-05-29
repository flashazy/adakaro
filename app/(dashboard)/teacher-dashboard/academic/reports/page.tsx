import { AcademicReportDocumentCard } from "@/components/academic/academic-report-document-card";
import { AcademicReportsInsights } from "@/components/academic/academic-reports-insights";
import { academicCardBaseClass } from "@/components/academic/academic-ui-styles";
import type { AcademicReportsInsightsData } from "@/components/academic/academic-reports-insights";
import { createClient } from "@/lib/supabase/server";
import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";

export const metadata = {
  title: "Reports — Academic",
};

function buildReportsInsights(
  rows: {
    class_id: string;
    generated_at: string;
    term: string;
    academic_year: string;
  }[]
): AcademicReportsInsightsData {
  if (rows.length === 0) {
    return {
      totalReports: 0,
      classesCovered: 0,
      latestGeneratedLabel: null,
      latestTermLabel: null,
    };
  }

  const classesCovered = new Set(rows.map((r) => r.class_id)).size;
  const latest = rows.reduce((a, b) =>
    new Date(a.generated_at) >= new Date(b.generated_at) ? a : b
  );
  const latestGeneratedLabel = latest.generated_at
    ? new Date(latest.generated_at).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })
    : null;

  return {
    totalReports: rows.length,
    classesCovered,
    latestGeneratedLabel,
    latestTermLabel: `${latest.term} ${latest.academic_year}`,
  };
}

export default async function AcademicHubReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: roles } = await supabase
    .from("teacher_department_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .eq("department", "academic");

  const schoolIds = [
    ...new Set(
      (roles ?? []).map((r) => (r as { school_id: string }).school_id)
    ),
  ];

  if (schoolIds.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/60 dark:bg-amber-950/40">
        <p className="text-sm text-slate-700 dark:text-zinc-300">
          Performance analytics are available only to teachers assigned to the
          Academic department. Ask a school administrator to add you under
          Academic in teacher department roles.
        </p>
      </div>
    );
  }

  const { data: reports, error } = await supabase
    .from("academic_reports")
    .select(
      "id, term, academic_year, generated_at, school_id, class_id, report_data"
    )
    .in("school_id", schoolIds)
    .order("generated_at", { ascending: false });

  type ReportListRow = {
    id: string;
    term: string;
    academic_year: string;
    generated_at: string;
    school_id: string;
    class_id: string;
    report_data: unknown;
  };

  const rows = (reports ?? []) as ReportListRow[];
  const insights = buildReportsInsights(rows);

  const classIds = [...new Set(rows.map((r) => r.class_id))];
  const schoolIdsForJoin = [...new Set(rows.map((r) => r.school_id))];
  const [classesRes, schoolsRes] = await Promise.all([
    classIds.length > 0
      ? supabase.from("classes").select("id, name").in("id", classIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    schoolIdsForJoin.length > 0
      ? supabase.from("schools").select("id, name").in("id", schoolIdsForJoin)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const classNameById = new Map(
    (classesRes.data ?? []).map((c) => [c.id, c.name])
  );
  const schoolNameById = new Map(
    (schoolsRes.data ?? []).map((s) => [s.id, s.name])
  );

  return (
    <div className="space-y-4">
      <AcademicReportsInsights data={insights} />

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Could not load reports. Please try again later.
        </p>
      ) : rows.length === 0 ? (
        <p
          className={`p-6 text-sm text-slate-600 dark:text-zinc-400 ${academicCardBaseClass}`}
        >
          No academic performance reports yet. Reports appear after a class
          coordinator generates report cards for a term.
        </p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => {
            const data = r.report_data as AcademicPerformanceReportData | null;
            const titleClass =
              classNameById.get(r.class_id)?.trim() ||
              data?.class_name ||
              "Class";
            const schoolName =
              schoolNameById.get(r.school_id)?.trim() || "School";
            const when = r.generated_at
              ? new Date(r.generated_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—";
            return (
              <li key={r.id}>
                <AcademicReportDocumentCard
                  href={`/teacher-dashboard/academic/reports/${r.id}`}
                  classTitle={titleClass}
                  schoolName={schoolName}
                  term={r.term}
                  academicYear={r.academic_year}
                  generatedAtLabel={when}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
