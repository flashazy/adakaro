import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAcademicReportLiveSupplement } from "@/lib/academic-report-live-data";
import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AcademicReportPageClient } from "../academic-report-page-client";

export const metadata = { title: "Academic report" };

export default async function AcademicReportDetailPage(props: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: reportRaw, error } = await supabase
    .from("academic_reports")
    .select("id, term, academic_year, generated_at, report_data, class_id, school_id")
    .eq("id", reportId)
    .maybeSingle();

  type ReportDetailRow = {
    id: string;
    term: string;
    academic_year: string;
    generated_at: string;
    report_data: unknown;
    class_id: string;
    school_id: string;
  };

  const report = reportRaw as ReportDetailRow | null;

  if (error || !report) notFound();

  const data = report.report_data as AcademicPerformanceReportData | null;
  if (!data || data.version !== 1) notFound();

  const [{ data: clsRow }, { data: schRow }, { data: profileRow }] = await Promise.all([
    supabase.from("classes").select("name").eq("id", report.class_id).maybeSingle(),
    supabase.from("schools").select("name").eq("id", report.school_id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const classTitle =
    (clsRow as { name: string } | null)?.name?.trim() || data.class_name;
  const schoolName = (schRow as { name: string } | null)?.name?.trim() || "";
  const teacherName =
    (profileRow as { full_name: string | null } | null)?.full_name?.trim() ||
    "Teacher";
  const when = report.generated_at
    ? new Date(report.generated_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  const admin = createAdminClient();
  const liveSupplement = await loadAcademicReportLiveSupplement(admin, {
    classId: report.class_id,
    schoolId: report.school_id,
    term: data.term,
    academicYear: data.academic_year,
    data,
  });

  return (
    <AcademicReportPageClient
      reportId={reportId}
      data={data}
      schoolName={schoolName}
      classTitle={classTitle}
      generatedAtLabel={when}
      teacherName={teacherName}
      liveSupplement={liveSupplement}
    >
      <div>
        <Link
          href="/teacher-dashboard/academic-reports"
          className="text-sm font-medium text-school-primary hover:underline"
        >
          ← Academic Reports
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {classTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          {schoolName ? `${schoolName} · ` : null}
          {data.term} {data.academic_year} · Generated {when}
        </p>
      </div>
    </AcademicReportPageClient>
  );
}
