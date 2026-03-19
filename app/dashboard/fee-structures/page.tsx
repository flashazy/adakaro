import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddFeeStructureForm } from "./add-fee-structure-form";
import { FeeStructureRow } from "./fee-structure-row";
import Link from "next/link";

export default async function FeeStructuresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("school_members")
    .select("school_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/dashboard/setup");

  const schoolId = membership.school_id;

  // Fetch all lookup data in parallel
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

  const feeTypes = feeTypesRes.data ?? [];
  const classes = classesRes.data ?? [];
  const students = studentsRes.data ?? [];
  const structures = structuresRes.data ?? [];

  if (structuresRes.error) {
    console.log("[fee-structures] error:", structuresRes.error);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
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

      <main className="mx-auto max-w-5xl px-6 py-10">
        <AddFeeStructureForm
          feeTypes={feeTypes}
          classes={classes}
          students={students}
        />

        {structures.length > 0 ? (
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
              {structures.map((s) => (
                <FeeStructureRow
                  key={s.id}
                  structure={s}
                  feeTypes={feeTypes}
                  classes={classes}
                  students={students}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No fee structures yet. Add your first one above.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
