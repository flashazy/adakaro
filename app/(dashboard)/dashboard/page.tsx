import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import {
  resolveSchoolPlanStatus,
  type SchoolPlanStatus,
} from "@/lib/dashboard/subscription-banner";
import { getDisplayName } from "@/lib/display-name";
import { FloatingScrollButton } from "@/components/ui/floating-scroll-button";
import { CreateSchoolModal } from "./create-school-modal";
import { DashboardCharts } from "./dashboard-charts";
import { AdminQuickActions } from "./admin-quick-actions";
import { dashboardQuickActionsHeadingClass } from "@/components/dashboard/admin-quick-action-styles";
import { isSchoolProfileComplete } from "@/lib/dashboard/school-setup-onboarding";
import {
  DEFAULT_SCHOOL_CURRENCY,
  formatCurrency,
  normalizeSchoolCurrency,
} from "@/lib/currency";
import { orderStudentsByGenderThenName } from "@/lib/student-list-order";
import { cn } from "@/lib/utils";

/** Always refetch membership after creating a school (router.refresh / navigation). */
export const dynamic = "force-dynamic";

function buildEmptyDailyPayments() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29);
  const dailyMap = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(thirtyDaysAgo.getDate() + i);
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, 0);
  }
  return Array.from(dailyMap.entries()).map(([date, amount]) => ({
    date: `${date.slice(5, 7)}/${date.slice(8, 10)}`,
    amount,
  }));
}

function buildEmptyMonthlyIncome() {
  const today = new Date();
  const monthlyMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, 0);
  }
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return Array.from(monthlyMap.entries()).map(([key, amount]) => ({
    month: monthNames[Number(key.slice(5, 7)) - 1],
    amount,
  }));
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const profileName = getDisplayName(
    user,
    (profileRow as { full_name: string } | null)?.full_name ?? null
  );

  const resolved = await resolveSchoolDisplay(user.id, supabase);
  const schoolId = resolved?.schoolId ?? null;
  const schoolCurrencyRaw = resolved?.currency ?? null;

  if (process.env.NODE_ENV === "development") {
    console.log("[dashboard] resolveSchoolDisplay", { resolved });
  }

  const hasSchool = Boolean(schoolId);

  let planStatus: SchoolPlanStatus = {
    availability: "unavailable",
    planId: null,
    planRaw: null,
    isPaid: false,
    studentLimit: null,
    schoolStatus: null,
  };
  let schoolProfileComplete = false;
  if (schoolId) {
    const [{ data: schoolPlanRow }, resolvedPlanStatus] = await Promise.all([
      supabase
        .from("schools")
        .select(
          "current_academic_year, phone, email, address, logo_url"
        )
        .eq("id", schoolId)
        .maybeSingle(),
      resolveSchoolPlanStatus(supabase, schoolId),
    ]);
    planStatus = resolvedPlanStatus;
    schoolProfileComplete = isSchoolProfileComplete(
      (schoolPlanRow as {
        current_academic_year?: string | null;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        logo_url?: string | null;
      } | null) ?? {}
    );

    if (process.env.NODE_ENV === "development") {
      console.log("[dashboard] planStatus", {
        schoolId,
        planStatus,
      });
    }
  }

  if (!hasSchool) {
    return (
      <>
      <main className="pb-4">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Your school
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Welcome back, {profileName}
            </p>
          </div>
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-medium">Finish onboarding</p>
            <p className="mt-1 text-amber-800/90 dark:text-amber-200/80">
              Create your school to unlock the dashboard, classes, students, and
              fee management. You can also use the{" "}
              <Link
                href="/dashboard/setup"
                className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 dark:text-amber-100"
              >
                full setup page
              </Link>{" "}
              if you prefer.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total Students"
              value="0"
              icon={
                <svg className="h-5 w-5 text-school-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              }
            />
            <KpiCard
              label="Fees Collected"
              value={formatCurrency(0, DEFAULT_SCHOOL_CURRENCY)}
              color="emerald"
              icon={
                <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              }
            />
            <KpiCard
              label="Outstanding"
              value={formatCurrency(0, DEFAULT_SCHOOL_CURRENCY)}
              color="amber"
              icon={
                <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              }
            />
            <KpiCard
              label="Active Classes"
              value="0"
              icon={
                <svg className="h-5 w-5 text-school-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                </svg>
              }
            />
          </div>

          <div className="mt-8">
            <DashboardCharts
              dailyPayments={buildEmptyDailyPayments()}
              monthlyIncome={buildEmptyMonthlyIncome()}
              feesCollected={0}
              outstandingBalance={0}
              currencyCode={DEFAULT_SCHOOL_CURRENCY}
            />
          </div>

          <div className="mt-8">
            <h2 className={cn(dashboardQuickActionsHeadingClass, "mb-4")}>
              Quick Actions
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CreateSchoolModal enabled />
            </div>
          </div>
      </main>
      <FloatingScrollButton />
    </>
    );
  }

  // Get student IDs for this school first
  const { data: schoolStudents } = await orderStudentsByGenderThenName(
    supabase.from("students").select("id").eq("school_id", schoolId!)
  );

  const typedSchoolStudents = (schoolStudents ?? []) as { id: string }[];
  const studentIds = typedSchoolStudents.map((s) => s.id);

  // Fetch dashboard aggregates in parallel (profile + school name already loaded above)
  const [studentsRes, classesRes, paymentsRes, balancesRes, pendingParentRpc] =
    await Promise.all([
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId!),
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId!),
      supabase
        .from("payments")
        .select("amount, payment_date")
        .in("student_id", studentIds.length > 0 ? studentIds : [""]),
      supabase
        .from("student_fee_balances")
        .select("total_fee, total_paid, balance")
        .in("student_id", studentIds.length > 0 ? studentIds : [""]),
      supabase.rpc("get_pending_parent_link_requests_for_admin"),
    ]);

  let pendingParentLinkCount = 0;
  if (pendingParentRpc.error) {
    const fallback = await supabase
      .from("parent_link_requests")
      .select("id")
      .eq("status", "pending");
    pendingParentLinkCount = (fallback.data ?? []).length;
  } else {
    const rows = pendingParentRpc.data as unknown[] | null;
    pendingParentLinkCount = rows?.length ?? 0;
  }

  const schoolCurrency = normalizeSchoolCurrency(schoolCurrencyRaw);
  const totalStudents = studentsRes.count ?? 0;
  const totalClasses = classesRes.count ?? 0;

  const allPayments = (paymentsRes.data ?? []) as { amount: number; payment_date: string }[];
  const allBalances = (balancesRes.data ?? []) as { balance: number }[];

  const feesCollected = allPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  const outstandingBalance = allBalances.reduce(
    (sum, b) => sum + Math.max(0, Number(b.balance)),
    0
  );

  // ── Chart data: daily payments (last 30 days) ──
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29);

  const dailyMap = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(thirtyDaysAgo.getDate() + i);
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, 0);
  }

  allPayments.forEach((p) => {
    const date = typeof p.payment_date === "string" ? p.payment_date : "";
    if (dailyMap.has(date)) {
      dailyMap.set(date, (dailyMap.get(date) ?? 0) + Number(p.amount));
    }
  });

  const dailyPayments = Array.from(dailyMap.entries()).map(([date, amount]) => ({
    date: `${date.slice(5, 7)}/${date.slice(8, 10)}`,
    amount,
  }));

  // ── Chart data: monthly income (last 12 months) ──
  const monthlyMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, 0);
  }

  allPayments.forEach((p) => {
    const date = typeof p.payment_date === "string" ? p.payment_date : "";
    const monthKey = date.slice(0, 7);
    if (monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + Number(p.amount));
    }
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyIncome = Array.from(monthlyMap.entries()).map(([key, amount]) => ({
    month: monthNames[Number(key.slice(5, 7)) - 1],
    amount,
  }));

  return (
    <>
    <main className="pb-4">
        {/* KPI Cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Students"
            value={String(totalStudents)}
            icon={
              <svg className="h-5 w-5 text-school-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            }
          />
          <KpiCard
            label="Fees Collected"
            value={formatCurrency(feesCollected, schoolCurrency)}
            color="emerald"
            icon={
              <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
          <KpiCard
            label="Outstanding"
            value={formatCurrency(outstandingBalance, schoolCurrency)}
            color="amber"
            icon={
              <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
          <KpiCard
            label="Active Classes"
            value={String(totalClasses)}
            icon={
              <svg className="h-5 w-5 text-school-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
              </svg>
            }
          />
        </div>

        {/* Charts */}
        <div className="mt-8">
          <DashboardCharts
            dailyPayments={dailyPayments}
            monthlyIncome={monthlyIncome}
            feesCollected={feesCollected}
            outstandingBalance={outstandingBalance}
            currencyCode={schoolCurrency}
          />
        </div>

        {/* Quick links */}
        <div className="mt-8">
          <h2 className={cn(dashboardQuickActionsHeadingClass, "mb-2.5")}>
            Quick Actions
          </h2>
          <AdminQuickActions
            pendingParentLinkCount={pendingParentLinkCount}
            schoolId={schoolId!}
            planStatus={planStatus}
            schoolProfileComplete={schoolProfileComplete}
            studentCount={totalStudents}
          />
        </div>
    </main>
    <FloatingScrollButton />
    </>
  );
}

function KpiCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color?: "emerald" | "amber";
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
    </div>
  );
}
