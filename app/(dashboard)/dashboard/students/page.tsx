import { redirect } from "next/navigation";
import Link from "next/link";
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
import { filterLeafClassOptions } from "@/lib/class-options";
import { QueryErrorBanner } from "../query-error-banner";
import { AddStudentForm } from "./add-student-form";
import StudentImportModal from "./components/student-import-modal";
import { StudentList } from "./student-list";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { BackButton } from "@/components/dashboard/back-button";
import { orderStudentsByGenderThenName } from "@/lib/student-list-order";
import type { StudentApprovalStatus } from "@/types/supabase";

/** Columns for the dashboard student list + class embed (matches public.students). */
const STUDENTS_DASHBOARD_LIST_SELECT = [
  "id",
  "school_id",
  "class_id",
  "full_name",
  "admission_number",
  "parent_name",
  "parent_email",
  "parent_phone",
  "date_of_birth",
  "allergies",
  "disability",
  "insurance_provider",
  "insurance_policy",
  "gender",
  "enrollment_date",
  "status",
  "avatar_url",
  "approval_status",
  "enrolled_by",
  "approved_by",
  "approved_at",
  "rejected_at",
  "rejection_reason",
  "created_at",
  "updated_at",
  "class:classes(id, name)",
].join(", ");

/** Max UUIDs per `.in(...)` batch to avoid oversized PostgREST URLs on large schools. */
const STUDENT_SUBJECT_COUNT_IN_CHUNK = 120;

/** DB migration not applied yet — do not block the whole page. */
function isMissingStudentSubjectEnrollmentTable(err: unknown): boolean {
  const o = err as { code?: string; message?: string } | null;
  if (!o) return false;
  if (o.code === "PGRST205") return true;
  const m = o.message ?? "";
  return (
    m.includes("student_subject_enrollment") &&
    (m.includes("schema cache") || m.includes("Could not find the table"))
  );
}

export const dynamic = "force-dynamic";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const approvalParam =
    typeof sp.approval === "string" ? sp.approval : "approved";
  const approvalFilter =
    approvalParam === "pending" ||
    approvalParam === "rejected" ||
    approvalParam === "all"
      ? approvalParam
      : "approved";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name, parent_class_id")
    .eq("school_id", schoolId)
    .order("name");

  let studentsQuery = supabase
    .from("students")
    .select(STUDENTS_DASHBOARD_LIST_SELECT)
    .eq("school_id", schoolId);

  if (approvalFilter === "approved") {
    studentsQuery = studentsQuery.eq("approval_status", "approved");
  } else if (approvalFilter === "pending") {
    studentsQuery = studentsQuery.eq("approval_status", "pending");
  } else if (approvalFilter === "rejected") {
    studentsQuery = studentsQuery.eq("approval_status", "rejected");
  }

  const { data: students, error: studentsError } =
    await orderStudentsByGenderThenName(studentsQuery);

  const studentRows = students ?? [];
  const studentIds = studentRows.map((s) => (s as { id: string }).id);

  /** All enrollment rows on the loaded list window; dedupe subject_id later. */
  const enrollmentAccumulator: { student_id: string; subject_id: string }[] =
    [];
  let enrollmentError: unknown = null;
  let enrollmentMissingTable = false;

  if (studentIds.length > 0) {
    for (
      let offset = 0;
      offset < studentIds.length;
      offset += STUDENT_SUBJECT_COUNT_IN_CHUNK
    ) {
      const chunk = studentIds.slice(
        offset,
        offset + STUDENT_SUBJECT_COUNT_IN_CHUNK
      );
      const { data: chunkRows, error: chunkErr } = await supabase
        .from("student_subject_enrollment")
        .select("student_id, subject_id")
        .in("student_id", chunk);

      if (chunkErr) {
        enrollmentError = chunkErr;
        enrollmentMissingTable =
          isMissingStudentSubjectEnrollmentTable(chunkErr);
        enrollmentAccumulator.length = 0;
        break;
      }
      enrollmentAccumulator.push(
        ...((chunkRows ?? []) as { student_id: string; subject_id: string }[])
      );
    }
  }

  const enrollmentRowsForCounts = enrollmentAccumulator;

  const listError = combineSupabaseErrors([
    classesError,
    studentsError,
    enrollmentMissingTable ? null : enrollmentError,
  ]);
  if (listError) {
    console.error("[students] query error:", listError);
  }

  const typedClasses = (classes ?? []) as {
    id: string;
    name: string;
    parent_class_id: string | null;
  }[];
  const subjectCountByStudent = new Map<string, Set<string>>();
  for (const row of enrollmentRowsForCounts) {
    const r = row as { student_id: string; subject_id: string };
    if (!subjectCountByStudent.has(r.student_id)) {
      subjectCountByStudent.set(r.student_id, new Set());
    }
    subjectCountByStudent.get(r.student_id)!.add(r.subject_id);
  }

  const typedStudents = (students ?? []).map((s) => {
    const row = s as {
      id: string;
      full_name: string;
      admission_number: string | null;
      avatar_url: string | null;
      class_id: string;
      class: { id: string; name: string } | null;
      gender: string | null;
      enrollment_date: string;
      date_of_birth: string | null;
      allergies: string | null;
      disability: string | null;
      insurance_provider: string | null;
      insurance_policy: string | null;
      parent_name: string | null;
      parent_email: string | null;
      parent_phone: string | null;
      approval_status: StudentApprovalStatus;
      enrolled_by: string | null;
      approved_by: string | null;
      approved_at: string | null;
      rejected_at: string | null;
      rejection_reason: string | null;
    };
    return {
      ...row,
      subject_enrollment_count:
        subjectCountByStudent.get(row.id)?.size ?? 0,
    };
  });
  // Parent classes are umbrellas for their streams — students enrol into a
  // specific stream, so filter them out of the picker. A top-level class with
  // no children is NOT a parent and stays eligible.
  const classOptions = filterLeafClassOptions(typedClasses).map((c) => ({
    id: c.id,
    name: c.name,
    parent_class_id: c.parent_class_id,
  }));

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
          <BackButton
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </BackButton>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 py-10">
        {listError ? (
          <QueryErrorBanner
            title="Could not load students or classes"
            message={listError}
          />
        ) : null}
        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-1 text-sm dark:border-zinc-700 dark:bg-zinc-900/60">
          {(
            [
              { key: "approved", label: "Approved" },
              { key: "pending", label: "Pending" },
              { key: "rejected", label: "Rejected" },
              { key: "all", label: "All" },
            ] as const
          ).map((tab) => (
            <Link
              key={tab.key}
              href={
                tab.key === "approved"
                  ? "/dashboard/students"
                  : `/dashboard/students?approval=${tab.key}`
              }
              className={`rounded-lg px-3 py-2 font-medium transition-colors ${
                approvalFilter === tab.key
                  ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-slate-600 hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        {approvalFilter === "approved" ? (
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <StudentImportModal
              classes={classOptions}
              canBulkImport={canBulkImport}
            />
          </div>
        ) : null}
        {approvalFilter === "approved" ? (
          <AddStudentForm
            classes={classOptions}
            studentCount={studentLimitState.current}
            studentLimit={studentLimitState.limit}
            nextAdmissionPreview={nextAdmissionPreview}
            schoolAdmissionPrefix={schoolAdmissionPrefix}
          />
        ) : (
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Use the Approved tab to add students from the dashboard. Pending and
            rejected rows are from capture card or other workflows.
          </p>
        )}
        {!listError ? (
          <StudentList
            students={typedStudents}
            classes={classOptions}
            approvalFilter={approvalFilter}
          />
        ) : null}
      </main>
      <SmartFloatingScrollButton sectionIds={[]} />
    </>
  );
}
