import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import { normalizeSchoolCurrency } from "@/lib/currency";
import { combineSupabaseErrors } from "@/lib/dashboard/supabase-error";
import { QueryErrorBanner } from "../query-error-banner";
import { AddFeeStructureForm } from "./add-fee-structure-form";
import { FeeStructureRow } from "./fee-structure-row";
import Link from "next/link";

export default async function FeeStructuresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const display = await resolveSchoolDisplay(user.id, supabase);
  if (!display?.schoolId) redirect("/dashboard");
  const schoolId = display.schoolId;
  const currencyCode = normalizeSchoolCurrency(display.currency);

  const [feeTypesRes, classesRes, studentsRes, structuresRes] =
    await Promise.all([
      supabase
        .from("fee_types")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("students")
        .select("id, full_name, admission_number")
        .eq("school_id", schoolId)
        .order("full_name"),
      supabase
        .from("fee_structures")
        .select(
          "id, fee_type_id, class_id, student_id, amount, due_date, fee_type:fee_types(id, name), class:classes(id, name), student:students(id, full_name)"
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),
    ]);

  const typedFeeTypes = (feeTypesRes.data ?? []) as { id: string; name: string }[];
  const typedClasses = (classesRes.data ?? []) as { id: string; name: string }[];
  const typedStudents = (studentsRes.data ?? []) as {
    id: string;
    full_name: string;
    admission_number: string | null;
  }[];
  const typedStructures = (structuresRes.data ?? []) as {
    id: string;
    fee_type_id: string | null;
    class_id: string | null;
    student_id: string | null;
    amount: number;
    due_date: string | null;
    fee_type: { id: string; name: string } | null;
    class: { id: string; name: string } | null;
    student: { id: string; full_name: string } | null;
  }[];

  const fetchError = combineSupabaseErrors([
    feeTypesRes.error,
    classesRes.error,
    studentsRes.error,
    structuresRes.error,
  ]);
  if (fetchError) {
    console.error("[fee-structures] error:", fetchError);
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Fee Structures
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Define fees and assign them to classes or students.
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

      <main className="mx-auto max-w-5xl space-y-6 py-10">
        {fetchError ? (
          <QueryErrorBanner
            title="Could not load fee structure data"
            message={fetchError}
          >
            <p className="text-xs text-red-800 dark:text-red-200">
              Apply migrations{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                00018_get_my_school_id
              </code>{" "}
              and{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                00019_admin_rls_is_school_admin
              </code>{" "}
              if reads are blocked by RLS.
            </p>
          </QueryErrorBanner>
        ) : null}

        <AddFeeStructureForm
          feeTypes={typedFeeTypes}
          classes={typedClasses}
          students={typedStudents}
          currencyCode={currencyCode}
        />

        {!fetchError && typedStructures.length > 0 ? (
          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {/* Desktop header */}
            <div className="hidden border-b border-slate-200 px-6 py-3 sm:grid sm:grid-cols-[1fr_1fr_100px_100px_auto] sm:gap-4 dark:border-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Fee Type
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Target
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Amount
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Due Date
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Actions
              </p>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {typedStructures.map((s) => (
                <FeeStructureRow
                  key={s.id}
                  structure={s}
                  feeTypes={typedFeeTypes}
                  classes={typedClasses}
                  students={typedStudents}
                  currencyCode={currencyCode}
                />
              ))}
            </div>
          </div>
        ) : !fetchError ? (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No fee structures yet. Add your first one above.
            </p>
          </div>
        ) : null}
      </main>
    </>
  );
}
