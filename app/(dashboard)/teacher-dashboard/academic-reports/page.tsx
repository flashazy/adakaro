import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";

export const metadata = {
  title: "Academic Reports",
};

export default async function AcademicReportsPage() {
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
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Academic Reports
        </h1>
        <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Academic Reports
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Auto-generated when coordinators run{" "}
          <span className="font-medium">Generate Report Cards</span>. Use these
          summaries to track outcomes and subject-level performance.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Could not load reports. Please try again later.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          No academic performance reports yet. Reports appear after a class
          coordinator generates report cards for a term.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
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
                <Link
                  href={`/teacher-dashboard/academic-reports/${r.id}`}
                  className="flex flex-col gap-1 px-4 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/80 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {titleClass}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      {schoolName} · {r.term} {r.academic_year}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-500">
                    Generated {when}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
