import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddFeeTypeForm } from "./add-fee-type-form";
import { FeeTypeRow } from "./fee-type-row";
import Link from "next/link";

export default async function FeeTypesPage() {
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

  const { data: feeTypes, error: feeTypesError } = await supabase
    .from("fee_types")
    .select("*")
    .eq("school_id", membership.school_id)
    .order("name");

  if (feeTypesError) {
    console.log("[fee-types] error:", feeTypesError);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Fee Types
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Define the categories of fees your school charges.
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

      <main className="mx-auto max-w-4xl px-6 py-10">
        <AddFeeTypeForm />

        {feeTypes && feeTypes.length > 0 ? (
          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {/* Desktop table header */}
            <div className="hidden border-b border-slate-200 px-6 py-3 sm:grid sm:grid-cols-[1fr_1fr_80px_auto] sm:gap-4 dark:border-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Name
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Description
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Type
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Actions
              </p>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {feeTypes.map((ft) => (
                <FeeTypeRow key={ft.id} feeType={ft} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No fee types yet. Add your first fee type above.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
