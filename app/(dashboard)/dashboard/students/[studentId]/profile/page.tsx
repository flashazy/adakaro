import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { normalizeSchoolCurrency } from "@/lib/currency";
import {
  loadProfileAttendanceSummary,
  loadProfileFeeBalances,
  loadProfileGradebookScores,
  loadProfilePayments,
  loadProfileReportCards,
} from "@/lib/student-profile-auto-data";
import { StudentProfileClient } from "./student-profile-client";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

type AcademicRow =
  Database["public"]["Tables"]["student_academic_records"]["Row"];
type DisciplineRow =
  Database["public"]["Tables"]["student_discipline_records"]["Row"];
type HealthRow = Database["public"]["Tables"]["student_health_records"]["Row"];
type FinanceRow =
  Database["public"]["Tables"]["student_finance_records"]["Row"];

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: schoolId,
  } as never);
  if (!isAdmin) {
    redirect("/dashboard/students");
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select(
      "id, full_name, admission_number, school_id, avatar_url, class_id, class:classes(name)"
    )
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (studentError || !student) {
    notFound();
  }

  const typedStudent = student as {
    id: string;
    full_name: string;
    admission_number: string | null;
    school_id: string;
    avatar_url: string | null;
    class_id: string;
    class: { name: string } | null;
  };

  const [
    { data: academicRows, error: academicErr },
    { data: disciplineRows, error: disciplineErr },
    { data: healthRows, error: healthErr },
    { data: financeRows, error: financeErr },
    { data: schoolRow, error: schoolErr },
    profileGradebookScores,
    profileAttendanceSummary,
    profileReportCards,
    profilePayments,
    profileFeeBalances,
  ] = await Promise.all([
    supabase
      .from("student_academic_records")
      .select("*")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("student_discipline_records")
      .select("*")
      .eq("student_id", studentId)
      .order("incident_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("student_health_records")
      .select("*")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("student_finance_records")
      .select("*")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false }),
    supabase.from("schools").select("currency").eq("id", schoolId).maybeSingle(),
    loadProfileGradebookScores(supabase, studentId),
    loadProfileAttendanceSummary(supabase, studentId, typedStudent.class_id),
    loadProfileReportCards(supabase, studentId),
    loadProfilePayments(supabase, studentId),
    loadProfileFeeBalances(supabase, studentId),
  ]);

  const currencyCode = normalizeSchoolCurrency(
    (schoolRow as { currency: string | null } | null)?.currency
  );

  const financeRowsTyped = (financeRows ?? []) as FinanceRow[];
  const profileScholarshipLines = financeRowsTyped
    .filter((r) => Number(r.scholarship_amount) > 0)
    .map((r) => ({
      id: r.id,
      academic_year: r.academic_year,
      term: r.term,
      amount: Number(r.scholarship_amount),
      scholarship_type: r.scholarship_type,
    }));

  const loadError = [
    academicErr && `Academic: ${academicErr.message}`,
    disciplineErr && `Discipline: ${disciplineErr.message}`,
    healthErr && `Health: ${healthErr.message}`,
    financeErr && `Finance: ${financeErr.message}`,
    schoolErr && `School: ${schoolErr.message}`,
  ]
    .filter(Boolean)
    .join(" ");

  const headerAdmission = typedStudent.admission_number?.trim() ?? "";
  const headerSubtitleName = headerAdmission
    ? `${typedStudent.full_name} (ADM: ${headerAdmission})`
    : typedStudent.full_name;

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Student profile
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {headerSubtitleName}
              {typedStudent.class?.name ? ` · ${typedStudent.class.name}` : ""}
            </p>
          </div>
          <Link
            href="/dashboard/students"
            className="inline-flex w-fit items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Back to students
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl py-8">
        {loadError ? (
          <div
            className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
            role="alert"
          >
            Some sections could not load ({loadError}). Apply migration
            00078_student_profile_records if this is a fresh database.
          </div>
        ) : null}
        <StudentProfileClient
          studentId={typedStudent.id}
          studentName={typedStudent.full_name}
          admissionNumber={typedStudent.admission_number}
          className={typedStudent.class?.name ?? null}
          avatarUrl={typedStudent.avatar_url}
          academicRecords={(academicRows ?? []) as AcademicRow[]}
          disciplineRecords={(disciplineRows ?? []) as DisciplineRow[]}
          healthRecords={(healthRows ?? []) as HealthRow[]}
          financeRecords={financeRowsTyped}
          currencyCode={currencyCode}
          profileGradebookScores={profileGradebookScores}
          profileAttendanceSummary={profileAttendanceSummary}
          profileReportCards={profileReportCards}
          profilePayments={profilePayments}
          profileFeeBalances={profileFeeBalances}
          profileScholarshipLines={profileScholarshipLines}
        />
      </main>
    </>
  );
}
