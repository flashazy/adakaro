import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { loadStudentMarksSummariesForSchools } from "@/lib/teacher-student-reports-data";
import { StudentReportsClient } from "./student-reports-client";

export const metadata = {
  title: "Student reports — Teacher",
};

export const dynamic = "force-dynamic";

export default async function TeacherStudentReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
          Student reports
        </h1>
        <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
          Marks-based student performance is available only to teachers assigned
          to the Academic department. Ask a school administrator to add you
          under Academic in teacher department roles.
        </p>
      </div>
    );
  }

  const students = await loadStudentMarksSummariesForSchools(schoolIds);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Student reports
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Individual performance from Marks (gradebook scores). Averages are
              across all recorded assignment marks for each student.
            </p>
          </div>
          <Link
            href="/teacher-dashboard"
            className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
          >
            ← Back to dashboard
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <StudentReportsClient students={students} />
        </div>
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}
