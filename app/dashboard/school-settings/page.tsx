import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { normalizeSchoolCurrency, formatSchoolTitleWithCurrency } from "@/lib/currency";
import { SchoolCurrencyForm } from "./school-currency-form";

export const dynamic = "force-dynamic";

export default async function SchoolSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  const { data: school, error } = await supabase
    .from("schools")
    .select("name, currency")
    .eq("id", schoolId)
    .single();

  if (error || !school) {
    console.error("[school-settings]", error);
    redirect("/dashboard");
  }

  const row = school as { name: string; currency: string | null };
  const currency = normalizeSchoolCurrency(row.currency);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
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

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
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
    </div>
  );
}
