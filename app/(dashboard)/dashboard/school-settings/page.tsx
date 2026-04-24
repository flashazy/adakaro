import { redirect } from "next/navigation";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { BackButton } from "@/components/dashboard/back-button";
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
import { SchoolStampForm } from "./school-stamp-form";
import { SchoolLevelForm } from "./school-level-form";
import { SchoolInformationForm } from "./school-information-form";
import { SchoolAcademicSettingsForm } from "./school-academic-settings-form";
import { SchoolBrandingForm } from "./school-branding-form";
import { SchoolAdminAccountForm } from "./school-admin-account-form";
import { SchoolSettingsCollapsibleSection } from "./school-settings-collapsible-section";
import type { TermStructureValue } from "./school-settings-shared";

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
    school_stamp_url?: string | null;
    updated_at: string;
    school_level?: string | null;
    address?: string | null;
    city?: string | null;
    postal_code?: string | null;
    phone?: string | null;
    email?: string | null;
    registration_number?: string | null;
    motto?: string | null;
    primary_color?: string | null;
    current_academic_year?: string | null;
    term_structure?: string | null;
    term_1_start?: string | null;
    term_1_end?: string | null;
    term_2_start?: string | null;
    term_2_end?: string | null;
    term_3_start?: string | null;
    term_3_end?: string | null;
  };

  // `school_level` (migration 00086) and extended settings (00088) may not exist
  // on older deployments; fall back to smaller column sets so the page loads.
  const extendedCols =
    "name, currency, admission_prefix, logo_url, school_stamp_url, updated_at, school_level, address, city, postal_code, phone, email, registration_number, motto, primary_color, current_academic_year, term_structure, term_1_start, term_1_end, term_2_start, term_2_end, term_3_start, term_3_end";
  const fullCols =
    "name, currency, admission_prefix, logo_url, school_stamp_url, updated_at, school_level";
  const baseCols =
    "name, currency, admission_prefix, logo_url, school_stamp_url, updated_at";
  let schoolRes = await supabase
    .from("schools")
    .select(extendedCols)
    .eq("id", schoolId)
    .maybeSingle();
  if (schoolRes.error && /column/i.test(schoolRes.error.message ?? "")) {
    schoolRes = await supabase
      .from("schools")
      .select(fullCols)
      .eq("id", schoolId)
      .maybeSingle();
  }
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

  const termStructure: TermStructureValue =
    fetched?.term_structure === "3_terms" ? "3_terms" : "2_terms";

  const accountEmail = (user.email ?? "").trim() || "—";
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
  const stampUrl =
    (fetched?.school_stamp_url?.trim() || null) ?? null;

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
          <BackButton
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </BackButton>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 py-10">
        <SchoolSettingsCollapsibleSection
          sectionId="school-information"
          title="School information"
          description="Contact details and registration shown on official documents where configured."
        >
          <SchoolInformationForm
            canEdit={isSchoolAdmin}
            initial={{
              name: row.name,
              address: fetched?.address ?? null,
              city: fetched?.city ?? null,
              postalCode: fetched?.postal_code ?? null,
              phone: fetched?.phone ?? null,
              email: fetched?.email ?? null,
              registrationNumber: fetched?.registration_number ?? null,
            }}
          />
        </SchoolSettingsCollapsibleSection>

        <SchoolSettingsCollapsibleSection
          sectionId="academic-settings"
          title="Academic settings"
          description="Calendar reference for reports and planning (optional)."
        >
          <SchoolAcademicSettingsForm
            canEdit={isSchoolAdmin}
            initial={{
              currentAcademicYear: fetched?.current_academic_year ?? null,
              termStructure,
              term1Start: fetched?.term_1_start ?? null,
              term1End: fetched?.term_1_end ?? null,
              term2Start: fetched?.term_2_start ?? null,
              term2End: fetched?.term_2_end ?? null,
              term3Start: fetched?.term_3_start ?? null,
              term3End: fetched?.term_3_end ?? null,
            }}
          />
        </SchoolSettingsCollapsibleSection>

        <SchoolSettingsCollapsibleSection
          sectionId="admin-account"
          title="Admin account"
          description="Update the password and email for your own sign-in (all school admins can use this page)."
        >
          <SchoolAdminAccountForm currentEmail={accountEmail} />
        </SchoolSettingsCollapsibleSection>

        <SchoolSettingsCollapsibleSection
          sectionId="school-branding"
          title="School branding"
          description="Optional motto and accent color for your school profile."
        >
          <SchoolBrandingForm
            key={`${fetched?.updated_at ?? ""}-${fetched?.primary_color ?? ""}`}
            canEdit={isSchoolAdmin}
            initial={{
              motto: fetched?.motto ?? null,
              primaryColor: fetched?.primary_color ?? null,
            }}
          />
        </SchoolSettingsCollapsibleSection>

        <SchoolSettingsCollapsibleSection
          sectionId="admission-prefix"
          title="Student admission prefix"
          description="Auto-generated admission numbers use this prefix (e.g. MTZ-012)."
        >
          <SchoolAdmissionPrefixForm
            schoolId={schoolId}
            currentPrefix={admissionPrefix}
          />
        </SchoolSettingsCollapsibleSection>

        <SchoolSettingsCollapsibleSection
          sectionId="school-logo"
          title="School logo"
          description="Shown on your dashboard header and anywhere the school is identified."
        >
          <SchoolLogoForm
            schoolName={row.name}
            initialLogoUrl={logoUrl}
            initialLogoVersion={logoVersion}
          />
        </SchoolSettingsCollapsibleSection>

        {isSchoolAdmin ? (
          <SchoolSettingsCollapsibleSection
            sectionId="school-stamp"
            title="School stamp"
            defaultOpen
            description="Official round seal or stamp for documents."
          >
            <SchoolStampForm
              initialStampUrl={stampUrl}
              initialStampVersion={logoVersion}
            />
          </SchoolSettingsCollapsibleSection>
        ) : null}

        <SchoolSettingsCollapsibleSection
          sectionId="school-level"
          title="School level"
          description="Choose how report cards calculate rankings. Primary schools rank by average %; secondary schools rank by total marks of the best 7 subjects."
        >
          <SchoolLevelForm
            currentLevel={schoolLevel}
            canEdit={isSchoolAdmin}
          />
        </SchoolSettingsCollapsibleSection>

        <SchoolSettingsCollapsibleSection
          sectionId="currency"
          title="Currency"
          description={
            <>
              Online payments via ClickPesa support{" "}
              <strong className="text-slate-700 dark:text-zinc-300">TZS</strong>{" "}
              and{" "}
              <strong className="text-slate-700 dark:text-zinc-300">USD</strong>{" "}
              checkout. If you use KES or UGX, parents may see a notice when
              paying online.
            </>
          }
        >
          <SchoolCurrencyForm currentCurrency={currency} />
        </SchoolSettingsCollapsibleSection>
      </main>
      <SmartFloatingScrollButton sectionIds={[]} />
    </>
  );
}
