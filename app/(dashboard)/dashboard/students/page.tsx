import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { combineSupabaseErrors } from "@/lib/dashboard/supabase-error";
import { peekNextAdmissionNumberWithClient } from "@/lib/admission-number";
import type { PlanId } from "@/lib/plans";
import { canAccessFeature, normalizePlanId } from "@/lib/plans";
import { checkStudentLimit, getSchoolPlanRow } from "@/lib/plan-limits";
import { QueryErrorBanner } from "../query-error-banner";
import { AddStudentForm } from "./add-student-form";
import StudentImportModal from "./components/student-import-modal";
import { StudentList } from "./student-list";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Resolves the school's plan tier for feature gating. Direct `schools` SELECTs
 * can fail or return no row under RLS; `get_my_school_for_dashboard` is
 * SECURITY DEFINER and returns the true `plan` when the row matches this school.
 */
async function resolveSchoolPlanIdForFeatures(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  planFromSchoolRow: string | null | undefined
): Promise<PlanId> {
  let planId = normalizePlanId(planFromSchoolRow ?? "free");

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_my_school_for_dashboard",
    {} as never
  );
  if (rpcError || rpcData == null) {
    return planId;
  }

  let raw: unknown = rpcData;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "null") return planId;
    try {
      raw = JSON.parse(t) as unknown;
    } catch {
      return planId;
    }
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return planId;
  }
  const o = raw as { school_id?: string; plan?: string };
  if (o.school_id !== schoolId) {
    return planId;
  }
  if (typeof o.plan === "string" && o.plan.trim() !== "") {
    planId = normalizePlanId(o.plan);
  }
  return planId;
}

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

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("*, class:classes(id, name)")
    .eq("school_id", schoolId)
    .order("full_name");

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
        <div className="flex flex-wrap items-center justify-end gap-2">
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
    </>
  );
}
