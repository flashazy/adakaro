import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { describeSupabaseError } from "@/lib/dashboard/supabase-error";
import { QueryErrorBanner } from "../query-error-banner";
import { AddFeeTypeForm } from "./add-fee-type-form";
import { FeeTypesList } from "./fee-types-list";
import { BackButton } from "@/components/dashboard/back-button";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";

export default async function FeeTypesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  const { data: feeTypes, error: feeTypesError } = await supabase
    .from("fee_types")
    .select("*")
    .eq("school_id", schoolId)
    .order("name");

  const fetchError = describeSupabaseError(feeTypesError);
  if (feeTypesError) {
    console.error("[fee-types] error:", fetchError);
  }

  const typedFeeTypes = (feeTypes ?? []) as {
    id: string;
    name: string;
    description: string | null;
    is_recurring: boolean;
    school_id: string;
    created_at: string;
    updated_at: string;
  }[];

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Fee Types
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Define the categories of fees your school charges.
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

      <main className="mx-auto max-w-4xl py-10">
        <AddFeeTypeForm />

        {fetchError ? (
          <QueryErrorBanner
            title="Could not load fee types"
            message={fetchError}
            className="mt-6"
          >
            <p className="text-xs text-red-800 dark:text-red-200">
              If you are a school admin, run Supabase migrations (including{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                00018_get_my_school_id
              </code>{" "}
              and{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                00019_admin_rls_is_school_admin
              </code>
              ) so RLS allows reading your school&apos;s data.
            </p>
          </QueryErrorBanner>
        ) : null}

        {!fetchError && typedFeeTypes.length > 0 ? (
          <FeeTypesList feeTypes={typedFeeTypes} />
        ) : !fetchError ? (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No fee types yet. Add your first fee type above.
            </p>
          </div>
        ) : null}
      </main>
      <SmartFloatingScrollButton sectionIds={[]} />
    </>
  );
}
