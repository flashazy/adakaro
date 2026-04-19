import { redirect } from "next/navigation";
import Link from "next/link";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { createClient } from "@/lib/supabase/server";
import {
  resolveSchoolDisplay,
  logoVersionFromRow,
} from "@/lib/dashboard/resolve-school-display";
import { normalizeSchoolCurrency, formatSchoolTitleWithCurrency } from "@/lib/currency";
import { normalizeSchoolLevel } from "@/lib/school-level";
import { SchoolCurrencyForm } from "./school-currency-form";
import { SchoolAdmissionPrefixForm } from "./school-admission-prefix-form";
import { SchoolLogoForm } from "./school-logo-form";
import { SchoolLevelForm } from "./school-level-form";

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

  type FetchedSchool = {
    name: string;
    currency: string | null;
    admission_prefix: string | null;
    logo_url: string | null;
    updated_at: string;
    school_level?: string | null;
  };

  // `school_level` (migration 00086) may not exist on older deployments; fall
  // back to the legacy column set so the page still loads.
  const fullCols =
    "name, currency, admission_prefix, logo_url, updated_at, school_level";
  const baseCols =
    "name, currency, admission_prefix, logo_url, updated_at";
  let schoolRes = await supabase
    .from("schools")
    .select(fullCols)
    .eq("id", schoolId)
    .maybeSingle();
  if (
    schoolRes.error &&
    /column.*school_level/i.test(schoolRes.error.message ?? "")
  ) {
    schoolRes = await supabase
      .from("schools")
      .select(baseCols)
      .eq("id", schoolId)
      .maybeSingle();
  }
  const fetched = (schoolRes.data as unknown as FetchedSchool | null) ?? null;

  const { data: isAdminFlag } = await supabase.rpc("is_school_admin", {
    p_school_id: schoolId,
  } as never);
  const isSchoolAdmin = !!isAdminFlag;
  const row = {
    name: (fetched?.name?.trim() || display.name?.trim() || "").trim(),
    currency: fetched?.currency ?? display.currency,
  };

  if (!row.name) {
    redirect("/dashboard");
  }
  const currency = normalizeSchoolCurrency(row.currency);
  const schoolLevel = normalizeSchoolLevel(fetched?.school_level);
  const admissionPrefix = (fetched?.admission_prefix ?? "").trim();
  const logoUrl =
    (fetched?.logo_url?.trim() || display.logo_url?.trim() || null) ?? null;
  const logoVersion =
    fetched?.updated_at != null
      ? logoVersionFromRow(fetched.updated_at)
      : display.logo_version;

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
            School logo
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Shown on your dashboard header and anywhere the school is identified.
          </p>
          <div className="mt-6">
            <SchoolLogoForm
              schoolName={row.name}
              initialLogoUrl={logoUrl}
              initialLogoVersion={logoVersion}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            School level
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Choose how report cards calculate rankings. Primary schools rank by
            average %; secondary schools rank by total marks of the best 7
            subjects.
          </p>
          <div className="mt-6">
            <SchoolLevelForm
              currentLevel={schoolLevel}
              canEdit={isSchoolAdmin}
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
      <SmartFloatingScrollButton sectionIds={[]} />
    </>
  );
}
