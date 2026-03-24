import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import { normalizeSchoolCurrency, formatSchoolTitleWithCurrency } from "@/lib/currency";
import { SchoolCurrencyForm } from "./school-currency-form";
import { SchoolAdmissionPrefixForm } from "./school-admission-prefix-form";

export const dynamic = "force-dynamic";

export default async function SchoolSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const display = await resolveSchoolDisplay(user.id, supabase);
  if (!display?.schoolId) redirect("/dashboard");
  const schoolId = display.schoolId;

  const { data: school, error } = await supabase
    .from("schools")
    .select("name, currency, admission_prefix")
    .eq("id", schoolId)
    .maybeSingle();

  if (error) {
    console.error("[school-settings]", error);
  }

  const fetched = school as {
    name: string;
    currency: string | null;
    admission_prefix: string | null;
  } | null;
  const row = {
    name: (fetched?.name?.trim() || display.name?.trim() || "").trim(),
    currency: fetched?.currency ?? display.currency,
  };

  if (!row.name) {
    redirect("/dashboard");
  }
  const currency = normalizeSchoolCurrency(row.currency);
  const admissionPrefix = (fetched?.admission_prefix ?? "").trim();

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              School settings
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {formatSchoolTitleWithCurrency(row.name, currency)}
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

      <main className="mx-auto max-w-3xl space-y-8 py-10">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Student admission prefix
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Auto-generated admission numbers use this prefix (e.g. MTZ-012).
          </p>
          <div className="mt-6">
            <SchoolAdmissionPrefixForm
              schoolId={schoolId}
              currentPrefix={admissionPrefix}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Currency
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Online payments via ClickPesa support{" "}
            <strong className="text-slate-700 dark:text-zinc-300">TZS</strong> and{" "}
            <strong className="text-slate-700 dark:text-zinc-300">USD</strong>{" "}
            checkout. If you use KES or UGX, parents may see a notice when paying
            online.
          </p>
          <div className="mt-6">
            <SchoolCurrencyForm currentCurrency={currency} />
          </div>
        </section>
      </main>
    </>
  );
}
