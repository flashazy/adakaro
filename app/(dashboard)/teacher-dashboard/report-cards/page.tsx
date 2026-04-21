import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { ensureTeacherHasAssignmentsOrRedirect } from "@/lib/teacher-assignment-status";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import {
  loadPendingReportCardsForSchool,
  loadTeacherReportCardOptions,
} from "./queries";
import { ReportCardsPageClient } from "./report-cards-client";

export const metadata = {
  title: "Report cards — Coordinator",
};

export default async function TeacherReportCardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkIsTeacher(supabase, user.id))) redirect("/dashboard");

  await ensureTeacherHasAssignmentsOrRedirect(supabase, user.id);

  const options = await loadTeacherReportCardOptions();
  if (!options.ok) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{options.error}</p>
        <Link href="/teacher-dashboard" className="text-school-primary">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: options.schoolId,
  } as never);

  const pendingForAdmin = isAdmin
    ? await loadPendingReportCardsForSchool(options.schoolId)
    : [];

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Report cards
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Enter subject scores and comments, submit for head teacher approval,
              then print or email parents when approved.
            </p>
          </div>
          <Link
            href="/teacher-dashboard"
            className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
          >
            ← Back to dashboard
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <ReportCardsPageClient
            schoolId={options.schoolId}
            schoolName={options.schoolName}
            schoolMotto={options.schoolMotto}
            schoolLevel={options.schoolLevel}
            logoUrl={options.logoUrl}
            teacherName={options.teacherName}
            classes={options.classes}
            pendingForAdmin={pendingForAdmin}
            isSchoolAdmin={!!isAdmin}
          />
        </div>
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}
