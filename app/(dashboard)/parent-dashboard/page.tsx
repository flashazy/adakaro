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
} from "./parent-child-tab-panels";
import {
  ParentStudentCardsGroup,
  ParentStudentCard,
} from "./parent-student-cards-accordion";

interface StudentWithClass {
  id: string;
  full_name: string;
  admission_number: string | null;
  school_id: string;
  class_id: string;
  class: { name: string } | null;
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
          .select("id, full_name, admission_number, school_id, class_id, class:classes(name)")
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
    if (students.length > 0) {
      childTabDataById = await loadParentChildTabData(
        students.map((s) => ({ id: s.id, class_id: s.class_id }))
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
    <main className="pb-4">
        {hasAdminDashboardAccess ? (
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2 border-b border-slate-200 pb-3 dark:border-zinc-800">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105"
            >
              Admin dashboard
            </Link>
          </div>
        ) : null}
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Parent dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Welcome back, {profileTyped?.full_name || "Parent"}
          </p>
        </div>

        <PendingSchoolInvitations invitations={pendingAdminInvitesForUi} />

        {/* No linked students */}
        {childCount === 0 ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800">
                <svg className="h-7 w-7 text-slate-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                No students linked yet
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-zinc-400">
                Use the form below to request access using your child&apos;s
                admission number. The school admin will review and approve your
                request.
              </p>
            </div>

            <LinkRequestForm pendingRequests={pendingRequests} />
          </div>
        ) : (
          <>
            {/* Summary KPIs — multi-currency summary sits outside the 4-col grid so it never repeats as a grid fragment */}
            {singleCurrencyCode ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="My Children"
                  value={String(childCount)}
                  icon={
                    <svg className="h-5 w-5 text-school-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                    </svg>
                  }
                />
                <KpiCard
                  label="Total Fees"
                  value={formatCurrency(totalFees, singleCurrencyCode)}
                  icon={
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                    </svg>
                  }
                />
                <KpiCard
                  label="Paid"
                  value={formatCurrency(totalPaid, singleCurrencyCode)}
                  color="emerald"
                  subtitle={`${collectionPct}% collected`}
                  icon={
                    <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  }
                />
                <KpiCard
                  label="Balance Due"
                  value={formatCurrency(totalBalance, singleCurrencyCode)}
                  color={totalBalance > 0 ? "amber" : undefined}
                  icon={
                    <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
                <div className="shrink-0 lg:w-[min(100%,14rem)]">
                  <KpiCard
                    label="My Children"
                    value={String(childCount)}
                    icon={
                      <svg className="h-5 w-5 text-school-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                      </svg>
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <MultiCurrencySummary totalsByCurrency={totalsByCurrency} />
                </div>
              </div>
            )}

            {/* Link another child */}
            <div className="mt-6">
              <LinkRequestForm pendingRequests={pendingRequests} />
            </div>

            {/* Per-student breakdown (collapsible accordion, one open at a time) */}
            <div className="mt-8 space-y-8">
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
                        <div className="bg-slate-50/50 px-6 py-4 dark:bg-zinc-800/30">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--school-primary-rgb)/0.16)] text-sm font-bold text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.18)] dark:text-school-primary">
                              {student.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                    {student.full_name}
                                  </h2>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-zinc-400">
                                    {student.class && (
                                      <span className="inline-flex items-center gap-1">
                                        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                                        </svg>
                                        {student.class.name}
                                      </span>
                                    )}
                                    {student.admission_number && (
                                      <span className="inline-flex items-center gap-1">
                                        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5" />
                                        </svg>
                                        {student.admission_number}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <svg
                                  className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 dark:text-zinc-500"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={2}
                                  stroke="currentColor"
                                  aria-hidden
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      }
                      headerExpanded={
                        <div className="bg-slate-50/50 px-6 py-4 dark:bg-zinc-800/30">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--school-primary-rgb)/0.16)] text-sm font-bold text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.18)] dark:text-school-primary">
                              {student.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                    {student.full_name}
                                  </h2>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-zinc-400">
                                    {student.class && (
                                      <span className="inline-flex items-center gap-1">
                                        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                                        </svg>
                                        {student.class.name}
                                      </span>
                                    )}
                                    {student.admission_number && (
                                      <span className="inline-flex items-center gap-1">
                                        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5" />
                                        </svg>
                                        {student.admission_number}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-sm font-medium text-slate-700 dark:text-zinc-300">
                                    {schoolDisplayName}
                                  </p>
                                </div>
                                {sBalance > 0 && (
                                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
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
                      </ParentChildCardTabs>
                    </ParentStudentCard>
                  );
                })}
              </ParentStudentCardsGroup>
            </div>
          </>
        )}
    </main>
    <FloatingScrollButton />
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function MultiCurrencySummary({
  totalsByCurrency,
}: {
  totalsByCurrency: Map<SchoolCurrencyCode, CurrencyTotalsAgg>;
}) {
  const codes = sortCurrencyCodes(totalsByCurrency.keys());
  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-slate-100 pb-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Summary by Currency
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
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
              <li key={code}>
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
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  {formatCurrency(t.totalFees, code)} fees ·{" "}
                  {formatCurrency(t.totalPaid, code)} paid ({pct}% collected)
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
  subtitle,
  icon,
}: {
  label: string;
  value: string;
  color?: "emerald" | "amber";
  subtitle?: string;
  icon: React.ReactNode;
}) {
  const valueColor =
    color === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : color === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-900 dark:text-white";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
          {label}
        </p>
        {icon}
      </div>
      <p className={`mt-3 text-2xl font-bold ${valueColor}`}>{value}</p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}