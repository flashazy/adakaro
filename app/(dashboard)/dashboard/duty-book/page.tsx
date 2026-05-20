import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import {
  assertCanViewDutyBook,
  canExportDutyBook,
  getDutyBookReportPermissions,
} from "@/lib/duty-book/duty-book-access";
import { getActiveDutyTeachersForSchool } from "@/lib/teacher-on-duty/teacher-duty";
import { loadDutyBookData } from "@/lib/duty-book/load-duty-book-data";
import { loadDutyBookReport } from "@/lib/duty-book/load-duty-book-report";
import { BackButton } from "@/components/dashboard/back-button";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { DutyBookClient } from "./duty-book-client";

export const metadata = {
  title: "Duty Book — Adakaro",
  description:
    "Daily school attendance snapshot and official duty book report.",
};

export const dynamic = "force-dynamic";

export default async function DutyBookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[duty-book] redirect → /login (no session)");
    redirect("/login");
  }

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) {
    console.warn("[duty-book] redirect → /dashboard (no schoolId)", {
      userId: user.id,
    });
    redirect("/dashboard");
  }

  const gate = await assertCanViewDutyBook(supabase, schoolId);
  if (!gate.ok) {
    console.warn("[duty-book] redirect (access denied)", {
      userId: user.id,
      schoolId,
      reason: gate.error,
    });
    const { data: isAdminDenied } = await supabase.rpc("is_school_admin", {
      p_school_id: schoolId,
    } as never);
    redirect(isAdminDenied ? "/dashboard" : "/teacher-dashboard");
  }

  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: schoolId,
  } as never);
  const backHref = isAdmin ? "/dashboard/students" : "/teacher-dashboard";

  const today = new Date().toISOString().slice(0, 10);
  const activeDutyTeachers = await getActiveDutyTeachersForSchool(
    schoolId,
    today
  );
  const canExport = await canExportDutyBook(supabase, schoolId);

  const { data: schoolRow } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();
  const schoolName =
    (schoolRow as { name: string } | null)?.name?.trim() || "School";

  const admin = createAdminClient();
  const loaded = await loadDutyBookData(
    admin,
    schoolId,
    schoolName,
    today
  );

  let reportPayload = { report: null, signer: null } as Awaited<
    ReturnType<typeof loadDutyBookReport>
  >;
  try {
    reportPayload = await loadDutyBookReport(supabase, schoolId, today);
  } catch {
    // Table may not exist until migration is applied.
  }

  const reportPermissions = await getDutyBookReportPermissions(
    supabase,
    schoolId,
    !!reportPayload.report?.signedAt
  );

  if (!loaded.ok) {
    return (
      <>
        <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-5xl items-center justify-between py-4">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                Duty Book
              </h1>
            </div>
            <BackButton href={backHref}>Back</BackButton>
          </div>
        </header>
        <main className="mx-auto max-w-5xl py-10">
          <p className="text-sm text-red-600 dark:text-red-400">
            {loaded.error}
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Duty Book
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Daily attendance and official report for {schoolName}
            </p>
          </div>
          <BackButton href={backHref}>
            {isAdmin ? "Back to students" : "Back"}
          </BackButton>
        </div>
      </header>
      <main className="mx-auto max-w-5xl py-8">
        <DutyBookClient
          initialData={loaded.data}
          initialReport={reportPayload}
          initialReportPermissions={reportPermissions}
          canExport={canExport}
          activeDutyTeachers={activeDutyTeachers}
          backHref={backHref}
        />
      </main>
      <SmartFloatingScrollButton sectionIds={[]} />
    </>
  );
}
