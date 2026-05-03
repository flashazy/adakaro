import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import type { UserRole } from "@/types/supabase";
import LinkRequestForm from "./link-request-form";
import PendingSchoolInvitations from "./pending-school-invitations";
import { ParentStudentFeesTabContent } from "@/components/parent/parent-student-fees-tab-content";
import type {
  ParentFeeBalanceRow,
  ParentFeePaymentRow,
} from "@/components/parent/parent-student-fees-tab-content";
import { FloatingScrollButton } from "@/components/ui/floating-scroll-button";
import { formatParentDashboardDisplayName } from "@/lib/display-name";
import { getSchoolCurrencyById } from "@/lib/dashboard/resolve-school-display";
import {
  currencyFlagEmoji,
  DEFAULT_SCHOOL_CURRENCY,
  formatCurrency,
  normalizeSchoolCurrency,
  sortCurrencyCodes,
  type SchoolCurrencyCode,
} from "@/lib/currency";
import {
  DEFAULT_SCHOOL_DISPLAY_TIMEZONE,
  resolveSchoolDisplayTimezone,
} from "@/lib/school-timezone";
import { orderStudentsByGenderThenName } from "@/lib/student-list-order";
import {
  loadParentChildTabData,
  type ChildTabData,
} from "./parent-child-tab-data";
import { initialEmptySubjectResultsUnread } from "@/lib/parent-subject-results-unread-types";
import { ParentChildCardTabs } from "./parent-child-card-tabs";
import {
  ParentReportCardsTabContent,
  ParentExamResultsTabContent,
  ParentAttendanceTabContent,
  ParentClassResultsTabContent,
  ParentClassTeacherMessagesTabContent,
} from "./parent-child-tab-panels";
import {
  ParentStudentCardsGroup,
  ParentStudentCard,
} from "./parent-student-cards-accordion";
import { fetchClassTeacherContactByClassIds } from "@/lib/class-teacher";
import { ParentClassTeacherContactLine } from "@/components/parent/parent-class-teacher-contact-line";
import { Users, GraduationCap, Hash, ChevronRight } from "lucide-react";

interface StudentWithClass {
  id: string;
  full_name: string;
  admission_number: string | null;
  school_id: string;
  class_id: string;
  class: { name: string; class_teacher_id: string | null } | null;
  classTeacherContact?: {
    fullName: string;
    phone: string | null;
  } | null;
}

type BalanceRow = ParentFeeBalanceRow;
type PaymentRow = ParentFeePaymentRow;

interface CurrencyTotalsAgg {
  totalFees: number;
  totalPaid: number;
  totalBalance: number;
}

/** Batch-read school name + currency + display timezone via service role (avoids RLS issues on `schools`). */
async function loadParentSchoolCurrencies(
  schoolIds: string[]
): Promise<{
  currencyBySchoolId: Map<string, SchoolCurrencyCode>;
  schoolNameBySchoolId: Map<string, string>;
  schoolTimezoneBySchoolId: Map<string, string>;
}> {
  const currencyBySchoolId = new Map<string, SchoolCurrencyCode>();
  const schoolNameBySchoolId = new Map<string, string>();
  const schoolTimezoneBySchoolId = new Map<string, string>();
  if (schoolIds.length === 0) {
    return { currencyBySchoolId, schoolNameBySchoolId, schoolTimezoneBySchoolId };
  }

  try {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("schools")
      .select("id, name, currency, timezone")
      .in("id", schoolIds);
    for (const row of rows ?? []) {
      const r = row as {
        id: string;
        name: string | null;
        currency: string | null;
        timezone: string | null;
      };
      currencyBySchoolId.set(r.id, normalizeSchoolCurrency(r.currency));
      const n = r.name?.trim();
      schoolNameBySchoolId.set(r.id, n && n.length > 0 ? n : "School");
      schoolTimezoneBySchoolId.set(
        r.id,
        resolveSchoolDisplayTimezone(r.timezone)
      );
    }
  } catch {
    /* no service role */
  }

  for (const sid of schoolIds) {
    if (!currencyBySchoolId.has(sid)) {
      const raw = await getSchoolCurrencyById(sid);
      currencyBySchoolId.set(sid, normalizeSchoolCurrency(raw));
    }
    if (!schoolNameBySchoolId.has(sid)) {
      schoolNameBySchoolId.set(sid, "School");
    }
    if (!schoolTimezoneBySchoolId.has(sid)) {
      schoolTimezoneBySchoolId.set(sid, DEFAULT_SCHOOL_DISPLAY_TIMEZONE);
    }
  }

  return { currencyBySchoolId, schoolNameBySchoolId, schoolTimezoneBySchoolId };
}

function aggregateBalancesByCurrency(
  balances: BalanceRow[],
  students: StudentWithClass[],
  currencyBySchoolId: Map<string, SchoolCurrencyCode>
): Map<SchoolCurrencyCode, CurrencyTotalsAgg> {
  const studentToSchool = new Map(
    students.map((s) => [s.id, s.school_id])
  );
  const map = new Map<SchoolCurrencyCode, CurrencyTotalsAgg>();

  for (const s of students) {
    const code =
      currencyBySchoolId.get(s.school_id) ?? DEFAULT_SCHOOL_CURRENCY;
    const c = normalizeSchoolCurrency(code);
    if (!map.has(c)) {
      map.set(c, { totalFees: 0, totalPaid: 0, totalBalance: 0 });
    }
  }

  for (const b of balances) {
    const schoolId = studentToSchool.get(b.student_id);
    if (!schoolId) continue;
    const code = normalizeSchoolCurrency(currencyBySchoolId.get(schoolId));
    const agg = map.get(code) ?? {
      totalFees: 0,
      totalPaid: 0,
      totalBalance: 0,
    };
    agg.totalFees += Number(b.total_fee);
    agg.totalPaid += Number(b.total_paid);
    agg.totalBalance += Number(b.balance);
    map.set(code, agg);
  }

  return map;
}

export default async function ParentDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const profileTyped = profile as { full_name: string; role: UserRole } | null;
  const profileRole = profileTyped?.role;

  /** Service role: profiles RLS often fails; still show Admin entry when DB says admin. */
  let hasAdminDashboardAccess = profileRole === "admin";
  if (!hasAdminDashboardAccess) {
    try {
      const admin = createAdminClient();
      const { data: profRow } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if ((profRow as { role: string } | null)?.role === "admin") {
        hasAdminDashboardAccess = true;
      }
      if (!hasAdminDashboardAccess) {
        const { data: memRow } = await admin
          .from("school_members")
          .select("id")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .limit(1)
          .maybeSingle();
        if (memRow) hasAdminDashboardAccess = true;
      }
    } catch {
      /* no service role */
    }
  }

  const nowIso = new Date().toISOString();

  // Fetch linked students, pending link requests, and school admin invites in parallel
  const [linksResult, pendingReqsResult, invitesResult] = await Promise.all([
    supabase
      .from("parent_students")
      .select("student_id")
      .eq("parent_id", user.id),
    supabase
      .from("parent_link_requests")
      .select("id, admission_number, status, created_at")
      .eq("parent_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("school_invitations")
      .select("id, school_id, token, expires_at")
      .eq("status", "pending")
      .gt("expires_at", nowIso),
  ]);

  const typedLinks = (linksResult.data ?? []) as { student_id: string }[];
  const studentIds = typedLinks.map((l) => l.student_id);
  const childCount = studentIds.length;
  const typedPendingReqs = (pendingReqsResult.data ?? []) as {
    id: string;
    admission_number: string;
    status: string;
    created_at: string;
  }[];
  const pendingRequests = typedPendingReqs.map((r) => ({
    id: r.id,
    admission_number: r.admission_number,
    status: r.status,
    created_at: r.created_at,
  }));

  let typedPendingInvites = (invitesResult.data ?? []) as {
    id: string;
    school_id: string;
    token: string;
    expires_at: string;
  }[];

  // RLS policy "Invitee can select own pending invitation" often fails in practice
  // because policies cannot reliably read auth.users.email as the authenticated role.
  // Fall back to service role filtered by the session email from getUser() (same checks
  // accept_school_invitation uses server-side).
  if (
    typedPendingInvites.length === 0 &&
    user.email &&
    user.email.trim().length > 0
  ) {
    try {
      const admin = createAdminClient();
      const sessionEmail = user.email.trim().toLowerCase();
      const { data: adminInviteRows } = await admin
        .from("school_invitations")
        .select("id, school_id, token, expires_at, invited_email")
        .eq("status", "pending")
        .gt("expires_at", nowIso)
        .eq("invited_email", sessionEmail);

      typedPendingInvites = (adminInviteRows ?? [])
        .map((row) => {
          const r = row as {
            id: string;
            school_id: string;
            token: string;
            expires_at: string;
            invited_email: string;
          };
          if (r.invited_email.trim().toLowerCase() !== sessionEmail) {
            return null;
          }
          return {
            id: r.id,
            school_id: r.school_id,
            token: r.token,
            expires_at: r.expires_at,
          };
        })
        .filter(Boolean) as {
        id: string;
        school_id: string;
        token: string;
        expires_at: string;
      }[];
    } catch {
      /* no service role */
    }
  }

  const invitationSchoolNames: Record<string, string> = {};
  if (typedPendingInvites.length > 0) {
    const schoolIds = [...new Set(typedPendingInvites.map((i) => i.school_id))];
    try {
      const admin = createAdminClient();
      const { data: schoolRows } = await admin
        .from("schools")
        .select("id, name")
        .in("id", schoolIds);
      for (const row of schoolRows ?? []) {
        const r = row as { id: string; name: string };
        invitationSchoolNames[r.id] = r.name;
      }
    } catch {
      /* service role unavailable locally */
    }
  }

  const pendingAdminInvitesForUi = typedPendingInvites.map((i) => ({
    id: i.id,
    school_id: i.school_id,
    token: i.token,
    expires_at: i.expires_at,
    schoolName: invitationSchoolNames[i.school_id] ?? "School",
    expiresLabel: new Date(i.expires_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  }));

  let students: StudentWithClass[] = [];
  let balances: BalanceRow[] = [];
  let payments: PaymentRow[] = [];
  let childTabDataById = new Map<string, ChildTabData>();

  if (childCount > 0) {
    const [studentsRes, balancesRes, paymentsRes] = await Promise.all([
      orderStudentsByGenderThenName(
        supabase
          .from("students")
          .select(
            "id, full_name, admission_number, school_id, class_id, class:classes(name, class_teacher_id)"
          )
          .in("id", studentIds)
      ),
      supabase
        .from("student_fee_balances")
        .select(
          "student_id, fee_structure_id, fee_name, total_fee, total_paid, balance, due_date"
        )
        .in("student_id", studentIds),
      supabase
        .from("payments")
        .select(
          "id, student_id, amount, payment_method, payment_date, reference_number, fee_structure:fee_structures(name), receipt:receipts(id, receipt_number)"
        )
        .in("student_id", studentIds)
        .order("payment_date", { ascending: false })
        .limit(20),
    ]);

    students = (studentsRes.data ?? []) as StudentWithClass[];
    balances = (balancesRes.data ?? []) as BalanceRow[];
    payments = (paymentsRes.data ?? []) as PaymentRow[];

    const classIdsForTeacher = [
      ...new Set(students.map((s) => s.class_id).filter(Boolean)),
    ];
    const classTeacherByClass = await fetchClassTeacherContactByClassIds(
      classIdsForTeacher
    );
    students = students.map((s) => {
      const ct = classTeacherByClass.get(s.class_id);
      const classTeacherContact =
        ct != null
          ? { fullName: ct.full_name, phone: ct.phone }
          : null;
      return { ...s, classTeacherContact };
    });

    if (students.length > 0) {
      childTabDataById = await loadParentChildTabData(
        students.map((s) => ({
          id: s.id,
          class_id: s.class_id,
          class_teacher_id: s.class?.class_teacher_id ?? null,
        }))
      );
    }
  }

  const schoolIds = [...new Set(students.map((s) => s.school_id))];
  const { currencyBySchoolId, schoolNameBySchoolId, schoolTimezoneBySchoolId } =
    await loadParentSchoolCurrencies(schoolIds);

  function currencyForStudent(studentId: string): string {
    const st = students.find((s) => s.id === studentId);
    if (!st) return DEFAULT_SCHOOL_CURRENCY;
    return currencyBySchoolId.get(st.school_id) ?? DEFAULT_SCHOOL_CURRENCY;
  }

  const totalsByCurrency = aggregateBalancesByCurrency(
    balances,
    students,
    currencyBySchoolId
  );
  const distinctSorted = sortCurrencyCodes(totalsByCurrency.keys());
  const singleCurrencyCode =
    distinctSorted.length === 1 ? distinctSorted[0]! : null;

  const totalFees = singleCurrencyCode
    ? (totalsByCurrency.get(singleCurrencyCode)?.totalFees ?? 0)
    : 0;
  const totalPaid = singleCurrencyCode
    ? (totalsByCurrency.get(singleCurrencyCode)?.totalPaid ?? 0)
    : 0;
  const totalBalance = singleCurrencyCode
    ? (totalsByCurrency.get(singleCurrencyCode)?.totalBalance ?? 0)
    : 0;
  const collectionPct =
    totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0;

  return (
    <>
      <main className="relative pb-8 print:pb-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-indigo-100/50 via-violet-50/30 to-transparent dark:from-indigo-950/40 dark:via-zinc-950/30 dark:to-transparent sm:h-56" aria-hidden />

        <div className="relative mx-auto w-full max-w-5xl">
          {hasAdminDashboardAccess ? (
            <div className="mb-4 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 md:mb-6">
              <Link
                href="/dashboard"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-school-primary to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-105 dark:to-indigo-500"
              >
                Admin dashboard
              </Link>
            </div>
          ) : null}

          <header className="mb-5 space-y-1.5 md:mb-6 md:space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Parent dashboard
            </h1>
            <p className="text-base text-slate-600 dark:text-zinc-400">
              Welcome back,{" "}
              <span className="font-medium text-slate-800 dark:text-zinc-200">
                {formatParentDashboardDisplayName(profileTyped?.full_name)}
              </span>
            </p>
          </header>

          <PendingSchoolInvitations invitations={pendingAdminInvitesForUi} />

          {childCount === 0 ? (
            <div className="space-y-4 md:space-y-6">
              <div className="rounded-2xl border border-dashed border-slate-300/90 bg-white p-8 text-center shadow-sm dark:border-zinc-600 dark:bg-zinc-900 sm:p-14">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950/60 dark:to-violet-950/40">
                  <Users
                    className="h-8 w-8 text-indigo-600 dark:text-indigo-400"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  No students linked yet
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  Use the form below to request access using your child&apos;s
                  admission number. The school admin will review and approve your
                  request.
                </p>
              </div>

              <LinkRequestForm pendingRequests={pendingRequests} />
            </div>
          ) : (
            <>
              {singleCurrencyCode ? (
                <ParentPaymentSummaryHero
                  childCount={childCount}
                  totalFees={totalFees}
                  totalPaid={totalPaid}
                  totalBalance={totalBalance}
                  currencyCode={singleCurrencyCode}
                  collectionPct={collectionPct}
                />
              ) : (
                <div className="space-y-3 md:space-y-5">
                  <ParentMultiCurrencyHero childCount={childCount} />
                  <MultiCurrencySummary totalsByCurrency={totalsByCurrency} />
                </div>
              )}

              <div className="mt-4 md:mt-8">
                <LinkRequestForm pendingRequests={pendingRequests} />
              </div>

              <div className="mt-4 space-y-4 md:mt-8 md:space-y-8">
              <ParentStudentCardsGroup>
                {students.map((student) => {
                  const sBalances = balances.filter(
                    (b) => b.student_id === student.id
                  );
                  const sPayments = payments.filter(
                    (p) => p.student_id === student.id
                  );
                  const sBalance = sBalances.reduce(
                    (sum, b) => sum + Number(b.balance),
                    0
                  );
                  const sc = currencyForStudent(student.id);
                  const schoolDisplayName =
                    schoolNameBySchoolId.get(student.school_id) ?? "School";
                  const childTab = childTabDataById.get(student.id);

                  return (
                    <ParentStudentCard
                      key={student.id}
                      studentId={student.id}
                      summary={
                        <div className="bg-gradient-to-br from-slate-50/90 via-white to-indigo-50/30 px-4 py-4 active:bg-slate-100/80 dark:from-zinc-900/80 dark:via-zinc-900/40 dark:to-indigo-950/20 dark:active:bg-zinc-800/50 sm:px-6 sm:py-5">
                          <div className="flex items-center gap-3 sm:items-start sm:gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgb(var(--school-primary-rgb)/0.18)] text-sm font-bold text-school-primary shadow-inner ring-1 ring-white/60 sm:h-12 sm:w-12 sm:text-base dark:bg-[rgb(var(--school-primary-rgb)/0.22)] dark:ring-zinc-700/50">
                              {student.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
                              <h2 className="text-base font-semibold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-lg">
                                {student.full_name}
                              </h2>
                              {student.class ? (
                                <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                                  <GraduationCap
                                    className="h-4 w-4 shrink-0 text-school-primary opacity-90"
                                    aria-hidden
                                  />
                                  <span className="min-w-0 truncate">
                                    {student.class.name}
                                  </span>
                                </p>
                              ) : null}
                              {student.admission_number ? (
                                <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                                  <Hash
                                    className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500"
                                    aria-hidden
                                  />
                                  <span className="min-w-0 truncate font-mono text-xs sm:text-sm">
                                    {student.admission_number}
                                  </span>
                                </p>
                              ) : null}
                              {sBalance > 0 ? (
                                <span className="inline-flex w-fit max-w-full items-center rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-300">
                                  <span className="truncate">
                                    {formatCurrency(sBalance, sc)} due
                                  </span>
                                </span>
                              ) : null}
                              {student.classTeacherContact ? (
                                <div className="hidden md:block">
                                  <ParentClassTeacherContactLine
                                    teacherName={
                                      student.classTeacherContact.fullName
                                    }
                                    phone={student.classTeacherContact.phone}
                                  />
                                </div>
                              ) : null}
                            </div>
                            <ChevronRight
                              className="h-6 w-6 shrink-0 self-center text-slate-400 dark:text-zinc-500 sm:mt-1 sm:self-start"
                              strokeWidth={2}
                              aria-hidden
                            />
                          </div>
                        </div>
                      }
                      headerExpanded={
                        <div className="bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/40 px-4 py-5 sm:px-6 dark:from-indigo-950/30 dark:via-zinc-900/50 dark:to-violet-950/20">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgb(var(--school-primary-rgb)/0.2)] text-base font-bold text-school-primary shadow-sm ring-1 ring-white/70 dark:bg-[rgb(var(--school-primary-rgb)/0.25)] dark:ring-zinc-600/50">
                              {student.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                <div className="min-w-0 space-y-2">
                                  <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                                    {student.full_name}
                                  </h2>
                                  <div className="flex flex-col gap-1.5 text-sm text-slate-600 dark:text-zinc-400">
                                    {student.class && (
                                      <span className="inline-flex items-center gap-2">
                                        <GraduationCap
                                          className="h-4 w-4 shrink-0 text-school-primary"
                                          aria-hidden
                                        />
                                        {student.class.name}
                                      </span>
                                    )}
                                    {student.admission_number && (
                                      <span className="inline-flex items-center gap-2">
                                        <Hash
                                          className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500"
                                          aria-hidden
                                        />
                                        <span className="font-mono text-xs sm:text-sm">
                                          {student.admission_number}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                  {student.classTeacherContact ? (
                                    <ParentClassTeacherContactLine
                                      teacherName={
                                        student.classTeacherContact.fullName
                                      }
                                      phone={student.classTeacherContact.phone}
                                    />
                                  ) : null}
                                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                                    {schoolDisplayName}
                                  </p>
                                </div>
                                {sBalance > 0 && (
                                  <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-300">
                                    {formatCurrency(sBalance, sc)} due
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      }
                    >
                      <ParentChildCardTabs
                        initialSubjectResultsUnread={
                          childTab?.subjectResultsUnread ??
                          initialEmptySubjectResultsUnread()
                        }
                        initialMessagesUnread={childTab?.messagesUnread ?? 0}
                      >
                        <ParentAttendanceTabContent
                          rows={childTab?.attendance ?? []}
                          attendanceTimeZone={
                            schoolTimezoneBySchoolId.get(student.school_id) ??
                            DEFAULT_SCHOOL_DISPLAY_TIMEZONE
                          }
                        />
                        <ParentClassResultsTabContent
                          studentId={student.id}
                          classId={student.class_id}
                          classResultSubjects={
                            childTab?.classResultSubjects ?? []
                          }
                          majorExamClassResults={
                            childTab?.majorExamClassResults ?? {
                              options: [],
                              defaultOptionId: "",
                            }
                          }
                        />
                        <ParentExamResultsTabContent
                          classResultSheets={childTab?.classResultSheets ?? []}
                        />
                        <ParentReportCardsTabContent
                          rows={childTab?.reportCards ?? []}
                        />
                        <ParentStudentFeesTabContent
                          studentId={student.id}
                          currencyCode={sc}
                          balances={sBalances}
                          payments={sPayments}
                        />
                        <ParentClassTeacherMessagesTabContent
                          parentId={user.id}
                          classId={student.class_id}
                          classTeacherId={student.class?.class_teacher_id ?? null}
                          studentName={student.full_name}
                        />
                      </ParentChildCardTabs>
                    </ParentStudentCard>
                  );
                })}
              </ParentStudentCardsGroup>
              </div>
            </>
          )}
        </div>
      </main>
      <FloatingScrollButton />
    </>
  );
}

// ─── Sub-components (presentation only) ─────────────────────

function ParentPaymentSummaryHero({
  childCount,
  totalFees,
  totalPaid,
  totalBalance,
  currencyCode,
  collectionPct,
}: {
  childCount: number;
  totalFees: number;
  totalPaid: number;
  totalBalance: number;
  currencyCode: SchoolCurrencyCode;
  collectionPct: number;
}) {
  return (
    <section
      className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-indigo-50/50 to-violet-100/40 p-4 shadow-sm ring-1 ring-slate-900/[0.04] dark:border-zinc-700/90 dark:from-zinc-900 dark:via-indigo-950/25 dark:to-violet-950/20 dark:ring-white/5 md:px-5 md:py-5"
      aria-label="Payment summary"
    >
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3 lg:gap-4">
        <div className="rounded-xl border border-white/60 bg-white/70 px-2.5 py-2.5 shadow-sm backdrop-blur-sm dark:border-zinc-700/60 dark:bg-zinc-800/50 md:px-3 md:py-3">
          <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500 dark:text-zinc-400 md:text-xs">
            Children
          </p>
          <p className="mt-0.5 text-xl font-bold tabular-nums leading-none text-slate-900 dark:text-white md:mt-0.5 md:text-2xl">
            {childCount}
          </p>
        </div>
        <div className="rounded-xl border border-white/60 bg-white/70 px-2.5 py-2.5 shadow-sm backdrop-blur-sm dark:border-zinc-700/60 dark:bg-zinc-800/50 md:px-3 md:py-3">
          <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500 dark:text-zinc-400 md:text-xs">
            Total fees
          </p>
          <p className="mt-0.5 break-words text-sm font-bold tabular-nums leading-tight tracking-tight text-slate-900 dark:text-white md:mt-0.5 md:text-base lg:text-lg">
            {formatCurrency(totalFees, currencyCode)}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100/80 bg-emerald-50/50 px-2.5 py-2.5 shadow-sm dark:border-emerald-900/30 dark:bg-emerald-950/20 md:px-3 md:py-3">
          <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-emerald-700 dark:text-emerald-400/90 md:text-xs">
            Paid
          </p>
          <p className="mt-0.5 break-words text-sm font-bold tabular-nums leading-tight tracking-tight text-emerald-700 dark:text-emerald-300 md:mt-0.5 md:text-base lg:text-lg">
            {formatCurrency(totalPaid, currencyCode)}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100/90 bg-amber-50/40 px-2.5 py-2.5 shadow-sm dark:border-amber-900/35 dark:bg-amber-950/25 md:px-3 md:py-3">
          <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-amber-800 dark:text-amber-400/90 md:text-xs">
            Balance due
          </p>
          <p className="mt-0.5 break-words text-sm font-bold tabular-nums leading-tight tracking-tight text-amber-800 dark:text-amber-200 md:mt-0.5 md:text-base lg:text-lg">
            {formatCurrency(totalBalance, currencyCode)}
          </p>
        </div>
      </div>
      {totalFees > 0 ? (
        <div className="mt-3 md:mt-3.5 md:pt-0.5">
          <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-zinc-400 md:mb-1 md:text-xs">
            <span>Fee collection</span>
            <span className="tabular-nums text-school-primary">
              {collectionPct}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/90 dark:bg-zinc-700 md:h-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-school-primary transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(0, collectionPct))}%` }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ParentMultiCurrencyHero({ childCount }: { childCount: number }) {
  return (
    <section
      className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/80 to-indigo-50/40 p-4 shadow-sm dark:border-zinc-700 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/30 md:px-5 md:py-5"
      aria-label="Overview"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 md:gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Linked children
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-white md:mt-0.5 md:text-3xl">
            {childCount}
          </p>
        </div>
        <p className="max-w-sm text-xs leading-relaxed text-slate-600 dark:text-zinc-400 md:text-sm">
          Fee totals are shown by currency below — amounts are not combined
          across currencies.
        </p>
      </div>
    </section>
  );
}

function MultiCurrencySummary({
  totalsByCurrency,
}: {
  totalsByCurrency: Map<SchoolCurrencyCode, CurrencyTotalsAgg>;
}) {
  const codes = sortCurrencyCodes(totalsByCurrency.keys());
  return (
    <div className="h-full rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <div className="border-b border-slate-100 pb-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Summary by Currency
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
          Totals are per school currency — amounts are not combined across
          currencies.
        </p>
      </div>
      {codes.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-zinc-400">
          No fee data yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {codes.map((code) => {
            const t = totalsByCurrency.get(code)!;
            const pct =
              t.totalFees > 0
                ? Math.round((t.totalPaid / t.totalFees) * 100)
                : 0;
            return (
              <li key={code} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    {currencyFlagEmoji(code)} {code}
                  </span>
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(t.totalBalance, code)}{" "}
                    <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">
                      due
                    </span>
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                  {formatCurrency(t.totalFees, code)} fees ·{" "}
                  {formatCurrency(t.totalPaid, code)} paid ({pct}% collected)
                </p>
                {t.totalFees > 0 ? (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-600">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}