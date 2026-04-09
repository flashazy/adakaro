import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { combineSupabaseErrors } from "@/lib/dashboard/supabase-error";
import { peekNextAdmissionNumberWithClient } from "@/lib/admission-number";
import { canAccessFeature } from "@/lib/plans";
import {
  checkStudentLimit,
  getSchoolPlanRow,
  resolveSchoolPlanIdForFeatures,
} from "@/lib/plan-limits";
import { QueryErrorBanner } from "../query-error-banner";
import { AddStudentForm } from "./add-student-form";
import StudentImportModal from "./components/student-import-modal";
import { StudentList } from "./student-list";
import Link from "next/link";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { orderStudentsByGenderThenName } from "@/lib/student-list-order";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name");

  const { data: students, error: studentsError } = await orderStudentsByGenderThenName(
    supabase
      .from("students")
      .select("*, class:classes(id, name)")
      .eq("school_id", schoolId)
  );

  const listError = combineSupabaseErrors([classesError, studentsError]);
  if (listError) {
    console.error("[students] query error:", listError);
  }

  const typedClasses = (classes ?? []) as { id: string; name: string }[];
  const typedStudents = (students ?? []) as {
    id: string;
    full_name: string;
    admission_number: string | null;
    class_id: string;
    class: { id: string; name: string } | null;
    gender: string | null;
    parent_name: string | null;
    parent_email: string | null;
    parent_phone: string | null;
  }[];
  const classOptions = typedClasses.map((c) => ({ id: c.id, name: c.name }));

  const planRow = await getSchoolPlanRow(supabase, schoolId);
  const planId = await resolveSchoolPlanIdForFeatures(
    supabase,
    schoolId,
    planRow?.plan
  );
  const canBulkImport = canAccessFeature(planId, "bulkImport");
  const studentLimitState = await checkStudentLimit(supabase, schoolId);

  // Avoid direct SELECT on public.schools here: RLS can hit 42P17 (infinite
  // recursion with school_members). peek_next_admission_number is SECURITY
  // DEFINER and reads prefix + counter without that path.
  const peekedRaw = await peekNextAdmissionNumberWithClient(supabase, schoolId);
  const peeked = peekedRaw?.trim() ?? null;
  const peekMatch = peeked?.match(/^([A-Za-z]{2,10})-(\d+)$/);
  const schoolAdmissionPrefix = peekMatch
    ? peekMatch[1].toUpperCase()
    : null;

  const nextAdmissionPreview = peeked;

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Students
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Manage enrolment and student records.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 py-10">
        {listError ? (
          <QueryErrorBanner
            title="Could not load students or classes"
            message={listError}
          />
        ) : null}
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <StudentImportModal
            classes={classOptions}
            canBulkImport={canBulkImport}
          />
        </div>
        <AddStudentForm
          classes={classOptions}
          studentCount={studentLimitState.current}
          studentLimit={studentLimitState.limit}
          nextAdmissionPreview={nextAdmissionPreview}
          schoolAdmissionPrefix={schoolAdmissionPrefix}
        />
        {!listError ? (
          <StudentList students={typedStudents} classes={classOptions} />
        ) : null}
      </main>
      <SmartFloatingScrollButton sectionIds={[]} />
    </>
  );
}
