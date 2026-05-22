import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { ensureTeacherHasAssignmentsOrRedirect } from "@/lib/teacher-assignment-status";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { TeacherAttendanceForm } from "../components/TeacherAttendanceForm";
import { getTeacherTeachingClasses } from "../data";
import { todayIsoDate } from "@/lib/class-attendance/class-attendance-utils";
import {
  formatSupabaseEnvError,
  getSupabaseEnvDiagnostics,
} from "@/lib/supabase/env-diagnostics";

export const metadata = {
  title: "Class List — Teacher",
};

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const sp = await searchParams;
  const envDiag = getSupabaseEnvDiagnostics();
  if (!envDiag.ok) {
    console.error("[TeacherAttendancePage] missing env", envDiag);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    if (!(await checkIsTeacher(supabase, user.id))) redirect("/dashboard");
    await ensureTeacherHasAssignmentsOrRedirect(supabase, user.id);

    const options = await getTeacherTeachingClasses(user.id);
    const serverToday = todayIsoDate();
    const configError = envDiag.ok ? null : formatSupabaseEnvError(envDiag);

    return (
    <>
      <div className="max-w-full min-w-0 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              Class List
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              View students assigned to your classes.
            </p>
          </div>
          <Link
            href="/teacher-dashboard"
            className="shrink-0 text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
          >
            ← Back to dashboard
          </Link>
        </div>
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
          {configError ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
              role="alert"
            >
              {configError}
            </p>
          ) : null}
          <TeacherAttendanceForm
            options={options}
            initialClassId={sp.classId?.trim() ?? null}
            serverToday={serverToday}
          />
        </div>
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[TeacherAttendancePage] failed", {
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
      env: envDiag,
    });
    throw err instanceof Error ? err : new Error(message);
  }
}
