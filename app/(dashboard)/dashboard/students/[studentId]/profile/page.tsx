import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
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
    .select("id, full_name, school_id, avatar_url, class:classes(name)")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (studentError || !student) {
    notFound();
  }

  const typedStudent = student as {
    id: string;
    full_name: string;
    school_id: string;
    avatar_url: string | null;
    class: { name: string } | null;
  };

  const [
    { data: academicRows, error: academicErr },
    { data: disciplineRows, error: disciplineErr },
    { data: healthRows, error: healthErr },
    { data: financeRows, error: financeErr },
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
  ]);

  const loadError = [
    academicErr && `Academic: ${academicErr.message}`,
    disciplineErr && `Discipline: ${disciplineErr.message}`,
    healthErr && `Health: ${healthErr.message}`,
    financeErr && `Finance: ${financeErr.message}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Student profile
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {typedStudent.full_name}
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
          className={typedStudent.class?.name ?? null}
          avatarUrl={typedStudent.avatar_url}
          academicRecords={(academicRows ?? []) as AcademicRow[]}
          disciplineRecords={(disciplineRows ?? []) as DisciplineRow[]}
          healthRecords={(healthRows ?? []) as HealthRow[]}
          financeRecords={(financeRows ?? []) as FinanceRow[]}
        />
      </main>
    </>
  );
}
