import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ClipboardCheck, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsTeacher } from "@/lib/teacher-auth";
import {
  getTeacherLockedContactInfo,
  hasTeacherAssignments,
} from "@/lib/teacher-assignment-status";
import { getDisplayName } from "@/lib/display-name";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { getTeacherClassOptions } from "./data";
import { TeacherDashboardLocked } from "./components/TeacherDashboardLocked";
import { TeacherDocuments } from "./components/TeacherDocuments";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await checkIsTeacher(supabase, user.id))) {
    redirect("/dashboard");
  }

  const assigned = await hasTeacherAssignments(supabase, user.id);
  if (!assigned) {
    const contact = await getTeacherLockedContactInfo(supabase, user.id);
    return (
      <>
        <TeacherDashboardLocked contact={contact} />
        <div className="print:hidden">
          <SmartFloatingScrollButton sectionIds={[]} />
        </div>
      </>
    );
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const welcomeName = getDisplayName(
    user,
    (profile as { full_name: string } | null)?.full_name ?? null
  );

  const today = new Date().toISOString().slice(0, 10);

  const { count: todayAttendanceCount } = await admin
    .from("teacher_attendance")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", user.id)
    .eq("attendance_date", today);

  const { data: gradebookRows } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, class_id")
    .eq("teacher_id", user.id);

  let pendingGrades = 0;
  for (const g of gradebookRows ?? []) {
    const row = g as { id: string; class_id: string };
    const { count: scoreCount } = await admin
      .from("teacher_scores")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", row.id);

    const { count: studentCount } = await admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("class_id", row.class_id)
      .eq("status", "active");

    const need = Math.max(
      0,
      (studentCount ?? 0) - (scoreCount ?? 0)
    );
    pendingGrades += need;
  }

  const { count: upcomingLessons } = await admin
    .from("teacher_lessons")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", user.id)
    .gte("lesson_date", today);

  const options = await getTeacherClassOptions(user.id);

  const { data: teacherDocumentsRows } = await supabase
    .from("teacher_documents")
    .select(
      "id, document_name, file_url, file_type, file_size, category, uploaded_at"
    )
    .eq("teacher_id", user.id)
    .order("uploaded_at", { ascending: false });

  const teacherDocuments =
    (teacherDocumentsRows ?? []) as {
      id: string;
      document_name: string;
      file_url: string;
      file_type: string;
      file_size: number | null;
      category: string;
      uploaded_at: string;
    }[];

  const rows = options;
  const groupedByClass = (() => {
    const map = new Map<
      string,
      {
        classId: string;
        className: string;
        items: typeof rows;
      }
    >();
    for (const o of rows) {
      const g = map.get(o.classId);
      if (g) {
        g.items.push(o);
      } else {
        map.set(o.classId, {
          classId: o.classId,
          className: o.className,
          items: [o],
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.className.localeCompare(b.className)
    );
  })();

  const classIds = [...new Set(rows.map((r) => r.classId))];
  const counts = new Map<string, number>();
  if (classIds.length > 0) {
    const { data: countRows } = await admin
      .from("students")
      .select("class_id")
      .in("class_id", classIds);
    for (const r of countRows ?? []) {
      const cid = (r as { class_id: string }).class_id;
      counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
  }

  const attendanceSubtext =
    (todayAttendanceCount ?? 0) === 0
      ? "No attendance recorded yet today. Start by taking attendance."
      : "Records saved for today";

  const gradesSubtext =
    pendingGrades === 0
      ? "No grades recorded yet."
      : "Student score slots still empty";

  const lessonsSubtext =
    (upcomingLessons ?? 0) === 0
      ? "No lessons scheduled for today."
      : "From today onward";

  let insightMessage: string;
  if ((todayAttendanceCount ?? 0) === 0) {
    insightMessage =
      "You have no attendance recorded today — open a class below to take attendance.";
  } else if (pendingGrades > 0) {
    insightMessage = `You have ${pendingGrades} pending grade slot${pendingGrades === 1 ? "" : "s"} to enter across your classes.`;
  } else {
    insightMessage =
      "You're up to date on attendance and grades for now. Check upcoming lessons in Today Overview.";
  }

  return (
    <>
      <div className="space-y-6 bg-gray-50 px-2 py-6 dark:bg-zinc-950 sm:px-4 lg:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Welcome, {welcomeName}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Your classes, attendance, grades, and lesson plans in one place.
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-5 text-base font-semibold text-slate-900 dark:text-white">
            Today Overview
          </h2>
          <div className="grid grid-cols-1 gap-6 divide-y divide-gray-100 dark:divide-zinc-800/80 sm:grid-cols-3 sm:gap-6 sm:divide-x sm:divide-y-0 sm:divide-gray-100 dark:sm:divide-zinc-800/80">
            <div className="flex flex-col space-y-2 pt-0 pb-6 text-center sm:items-stretch sm:px-2 sm:pb-0 sm:text-left sm:first:pl-0">
              <div className="flex items-center justify-center gap-3 sm:justify-start">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <ClipboardCheck className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-4xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  {todayAttendanceCount ?? 0}
                </p>
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                Today&apos;s attendance
              </p>
              <p className="text-sm text-gray-400 dark:text-zinc-500">
                {attendanceSubtext}
              </p>
            </div>
            <div className="flex flex-col space-y-2 pt-6 text-center sm:items-stretch sm:px-2 sm:pt-0 sm:text-left">
              <div className="flex items-center justify-center gap-3 sm:justify-start">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  <ListChecks className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-4xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  {pendingGrades}
                </p>
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                Pending grades
              </p>
              <p className="text-sm text-gray-400 dark:text-zinc-500">
                {gradesSubtext}
              </p>
            </div>
            <div className="flex flex-col space-y-2 pt-6 text-center sm:items-stretch sm:px-2 sm:pt-0 sm:text-left">
              <div className="flex items-center justify-center gap-3 sm:justify-start">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <CalendarDays className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-4xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  {upcomingLessons ?? 0}
                </p>
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                Upcoming lessons
              </p>
              <p className="text-sm text-gray-400 dark:text-zinc-500">
                {lessonsSubtext}
              </p>
            </div>
          </div>
        </section>

        <section
          className="mb-6 rounded-xl border border-yellow-100 bg-yellow-50 p-4 text-sm text-yellow-700 dark:border-yellow-900/25 dark:bg-yellow-950/20 dark:text-yellow-200/90"
          role="status"
        >
          <p className="leading-relaxed">
            <span aria-hidden>⚡ </span>
            {insightMessage}
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            My classes
          </h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {groupedByClass.map((g) => {
              const n = counts.get(g.classId) ?? 0;
              const subjectLabels = [
                ...new Set(
                  g.items.map((a) => a.subject?.trim() || "General")
                ),
              ].sort((a, b) => a.localeCompare(b));
              const years = [
                ...new Set(
                  g.items
                    .map((a) => a.academicYear?.trim())
                    .filter((y): y is string => Boolean(y))
                ),
              ];
              const yearLabel = years.length === 0 ? "—" : years.join(", ");
              return (
                <div
                  key={g.classId}
                  className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {g.className}
                  </h3>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-700 dark:text-zinc-300">
                    {subjectLabels.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-gray-500 dark:text-zinc-500">
                    {n} student{n === 1 ? "" : "s"} • Year {yearLabel}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
                    <Link
                      href={`/teacher-dashboard/attendance?classId=${g.classId}`}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-indigo-500 sm:flex-none"
                    >
                      Take attendance
                    </Link>
                    <Link
                      href={`/teacher-dashboard/grades?classId=${g.classId}`}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-slate-800 transition-colors duration-150 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:flex-none"
                    >
                      Enter grades
                    </Link>
                    <Link
                      href="/teacher-dashboard/lesson-plans"
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-slate-800 transition-colors duration-150 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:flex-none"
                    >
                      Lesson plans
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <TeacherDocuments initialDocuments={teacherDocuments} />
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}
