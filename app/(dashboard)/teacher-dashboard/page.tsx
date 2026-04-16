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
import { dedupeTeacherAttendanceByStudentAndDate } from "@/lib/teacher-attendance-dedupe";
import {
  getCurrentAcademicYearAndTerm,
  parseSubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";
import { getStudentsForSubject } from "@/lib/student-subject-enrollment-queries";
import { getTeacherClassOptions } from "./data";
import { TeacherDashboardLocked } from "./components/TeacherDashboardLocked";
import { TeacherDocuments } from "./components/TeacherDocuments";

export const dynamic = "force-dynamic";

/** First calendar year in assignment string; falls back to current enrolment year. */
function enrollmentYearFromAssignmentString(
  y: string | null | undefined
): number {
  const m = (y ?? "").trim().match(/\d{4}/);
  if (m) return parseInt(m[0], 10);
  return getCurrentAcademicYearAndTerm().academicYear;
}

/** True when a markbook cell has a real entered score (including 0). */
function scoreIsEntered(score: unknown): boolean {
  if (score == null) return false;
  if (typeof score === "number" && Number.isFinite(score)) return true;
  if (typeof score === "string" && score.trim() !== "") {
    const n = Number(score.trim());
    return Number.isFinite(n);
  }
  const n = Number(score);
  return Number.isFinite(n);
}

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

  const { data: attTodayRows } = await admin
    .from("teacher_attendance")
    .select("student_id, attendance_date, subject_id")
    .eq("teacher_id", user.id)
    .eq("attendance_date", today);

  const todayAttendanceCount = dedupeTeacherAttendanceByStudentAndDate(
    (attTodayRows ?? []) as {
      student_id: string;
      attendance_date: string;
      subject_id: string | null;
    }[]
  ).length;

  const { data: gradebookRowsRaw } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, class_id, subject, academic_year, term")
    .eq("teacher_id", user.id);

  const gradebookRows = (gradebookRowsRaw ?? []) as {
    id: string;
    class_id: string;
    subject: string;
    academic_year: string | null;
    term: string | null;
  }[];

  const { data: taForGradebook } = await admin
    .from("teacher_assignments")
    .select("class_id, subject_id, subject, subjects(name)")
    .eq("teacher_id", user.id);

  const taList = (taForGradebook ?? []) as {
    class_id: string;
    subject_id: string | null;
    subject: string | null;
    subjects: { name: string } | null;
  }[];

  function resolveSubjectIdForGradebook(
    classId: string,
    gbSubject: string
  ): string | null {
    const subLower = gbSubject.trim().toLowerCase();
    for (const r of taList) {
      if (r.class_id !== classId) continue;
      const disp = (
        r.subjects?.name?.trim() ||
        r.subject?.trim() ||
        ""
      ).toLowerCase();
      if (disp === subLower && r.subject_id) return r.subject_id;
    }
    return null;
  }

  const defaultPeriod = getCurrentAcademicYearAndTerm();
  const rosterCache = new Map<string, string[]>();

  async function rosterStudentIdsForGradebookAssignment(row: {
    class_id: string;
    subject: string;
    academic_year: string | null;
    term: string | null;
  }): Promise<string[]> {
    const termParsed =
      parseSubjectEnrollmentTerm(row.term) ?? defaultPeriod.term;
    const yearInt = enrollmentYearFromAssignmentString(row.academic_year);
    const subjectId = resolveSubjectIdForGradebook(row.class_id, row.subject);
    const cacheKey = `${row.class_id}\t${subjectId ?? ""}\t${yearInt}\t${termParsed}`;
    const cached = rosterCache.get(cacheKey);
    if (cached) return cached;

    const roster = await getStudentsForSubject(admin, {
      classId: row.class_id,
      subjectId,
      academicYear: yearInt,
      term: termParsed,
      enrollmentDateOnOrBefore: null,
    });
    const ids = roster.map((s) => s.id);
    rosterCache.set(cacheKey, ids);
    return ids;
  }

  const assignmentIds = gradebookRows.map((r) => r.id);
  const scoresByAssignment = new Map<string, Map<string, unknown>>();
  if (assignmentIds.length > 0) {
    const { data: scoreRows } = await admin
      .from("teacher_scores")
      .select("assignment_id, student_id, score")
      .in("assignment_id", assignmentIds);
    for (const r of scoreRows ?? []) {
      const sr = r as {
        assignment_id: string;
        student_id: string;
        score: unknown;
      };
      let m = scoresByAssignment.get(sr.assignment_id);
      if (!m) {
        m = new Map();
        scoresByAssignment.set(sr.assignment_id, m);
      }
      m.set(sr.student_id, sr.score);
    }
  }

  let pendingGrades = 0;
  for (const row of gradebookRows) {
    const rosterIds = await rosterStudentIdsForGradebookAssignment(row);
    const scores = scoresByAssignment.get(row.id) ?? new Map();
    for (const sid of rosterIds) {
      if (!scoreIsEntered(scores.get(sid))) {
        pendingGrades += 1;
      }
    }
  }

  const options = await getTeacherClassOptions(user.id);
  const assignedClassIds = [...new Set(options.map((o) => o.classId))];

  /** Official lesson plans (`lesson_plans`), not the legacy `teacher_lessons` calendar. */
  let upcomingLessons = 0;
  if (assignedClassIds.length > 0) {
    const { count } = await admin
      .from("lesson_plans")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", user.id)
      .eq("lesson_date", today)
      .in("class_id", assignedClassIds);
    upcomingLessons = count ?? 0;
  }

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
  const { academicYear: enrollmentYear, term: enrollmentTerm } =
    getCurrentAcademicYearAndTerm();

  const enrollmentKey = (classId: string, subjectId: string) =>
    `${classId}\0${subjectId}`;
  const enrolledStudentsByClassSubject = new Map<string, Set<string>>();
  const distinctClassIds = [...new Set(rows.map((r) => r.classId))];
  const distinctSubjectIds = [
    ...new Set(
      rows.map((r) => r.subjectId).filter((id): id is string => Boolean(id))
    ),
  ];
  if (distinctClassIds.length > 0 && distinctSubjectIds.length > 0) {
    const { data: enrRows } = await admin
      .from("student_subject_enrollment")
      .select("class_id, subject_id, student_id")
      .eq("academic_year", enrollmentYear)
      .eq("term", enrollmentTerm)
      .in("class_id", distinctClassIds)
      .in("subject_id", distinctSubjectIds);
    for (const r of enrRows ?? []) {
      const row = r as {
        class_id: string;
        subject_id: string;
        student_id: string;
      };
      const k = enrollmentKey(row.class_id, row.subject_id);
      let set = enrolledStudentsByClassSubject.get(k);
      if (!set) {
        set = new Set();
        enrolledStudentsByClassSubject.set(k, set);
      }
      set.add(row.student_id);
    }
  }

  const legacyClassIds = [
    ...new Set(rows.filter((o) => !o.subjectId).map((o) => o.classId)),
  ];
  const fullClassStudentCounts = new Map<string, number>();
  if (legacyClassIds.length > 0) {
    const { data: legacyRows } = await admin
      .from("students")
      .select("class_id")
      .in("class_id", legacyClassIds)
      .eq("status", "active");
    for (const r of legacyRows ?? []) {
      const cid = (r as { class_id: string }).class_id;
      fullClassStudentCounts.set(cid, (fullClassStudentCounts.get(cid) ?? 0) + 1);
    }
  }

  function studentCountForAssignment(
    classId: string,
    subjectId: string | null
  ): number {
    if (subjectId) {
      return (
        enrolledStudentsByClassSubject.get(
          enrollmentKey(classId, subjectId)
        )?.size ?? 0
      );
    }
    return fullClassStudentCounts.get(classId) ?? 0;
  }

  const sortedClassCards = [...rows].sort((a, b) => {
    const byClass = a.className.localeCompare(b.className);
    if (byClass !== 0) return byClass;
    return a.subject.localeCompare(b.subject);
  });

  const attendanceSubtext =
    (todayAttendanceCount ?? 0) === 0
      ? "No attendance recorded yet today. Start by taking attendance."
      : "Records saved for today";

  const gradesSubtext =
    pendingGrades === 0
      ? "No marks recorded yet."
      : "Student score slots still empty";

  const lessonsSubtext =
    upcomingLessons === 0
      ? "No lesson plans scheduled for today."
      : "Lesson plans scheduled for today.";

  let insightMessage: string;
  if ((todayAttendanceCount ?? 0) === 0) {
    insightMessage =
      "You have no attendance recorded today — open a class below to take attendance.";
  } else if (pendingGrades > 0) {
    insightMessage = `You have ${pendingGrades} pending mark slot${pendingGrades === 1 ? "" : "s"} to enter across your classes.`;
  } else {
    insightMessage =
      "You're up to date on attendance and marks for now. Check upcoming lessons in Today Overview.";
  }

  return (
    <>
      <div className="space-y-6 bg-gray-50 px-2 py-6 dark:bg-zinc-950 sm:px-4 lg:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Welcome, {welcomeName}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Your classes, attendance, marks, and lesson plans in one place.
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
                Pending marks
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
            {sortedClassCards.map((item) => {
              const n = studentCountForAssignment(item.classId, item.subjectId);
              const yearLabel = item.academicYear?.trim() || "—";
              return (
                <div
                  key={item.assignmentId}
                  className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {item.className}
                  </h3>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-700 dark:text-zinc-300">
                    <li>{item.subject}</li>
                  </ul>
                  <p className="mt-2 text-sm text-gray-500 dark:text-zinc-500">
                    {n} student{n === 1 ? "" : "s"} • Year {yearLabel}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
                    <Link
                      href={`/teacher-dashboard/attendance?classId=${item.classId}`}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-indigo-500 sm:flex-none"
                    >
                      Take attendance
                    </Link>
                    <Link
                      href={`/teacher-dashboard/grades?classId=${item.classId}`}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-slate-800 transition-colors duration-150 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:flex-none"
                    >
                      Enter marks
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
