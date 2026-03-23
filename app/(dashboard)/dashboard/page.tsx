import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { CreateSchoolModal } from "./create-school-modal";
import { DashboardCharts } from "./dashboard-charts";
import {
  DEFAULT_SCHOOL_CURRENCY,
  formatCurrency,
  formatSchoolTitleWithCurrency,
  normalizeSchoolCurrency,
} from "@/lib/currency";

const NAV_LINKS = [
  {
    href: "/dashboard/classes",
    title: "Manage Classes",
    desc: "Add, edit, or remove classes.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
      </svg>
    ),
  },
  {
    href: "/dashboard/students",
    title: "Manage Students",
    desc: "Enrol, edit, or remove students.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/fee-types",
    title: "Fee Types",
    desc: "Define fee categories.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/fee-structures",
    title: "Fee Structures",
    desc: "Assign fees to classes.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/payments",
    title: "Payments",
    desc: "Collect fees & receipts.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/school-settings",
    title: "School settings",
    desc: "Currency and school preferences.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/reports",
    title: "Reports",
    desc: "Generate & export reports.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/parent-links",
    title: "Parent Links",
    desc: "Link parents to students.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
      </svg>
    ),
  },
  {
    href: "/dashboard/link-requests",
    title: "Link Requests",
    desc: "Review parent access requests.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
    ),
  },
  {
    href: "/pricing",
    title: "Plans",
    desc: "Subscription tiers and pricing.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
] as const;

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

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  const hasSchool = Boolean(schoolId);

  const { data: profileOnly } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const profileNameEarly =
    (profileOnly as { full_name: string } | null)?.full_name || "Admin";

  if (!hasSchool) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
        <main className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Your school
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Welcome back, {profileNameEarly}
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
                <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
                <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Quick Actions
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CreateSchoolModal enabled />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Get student IDs for this school first
  const { data: schoolStudents } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", schoolId!);

  const typedSchoolStudents = (schoolStudents ?? []) as { id: string }[];
  const studentIds = typedSchoolStudents.map((s) => s.id);

  // Fetch all dashboard data in parallel
  const [profileRes, schoolRes, studentsRes, classesRes, paymentsRes, balancesRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single(),
      supabase
        .from("schools")
        .select("name, currency")
        .eq("id", schoolId!)
        .single(),
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
    ]);

  const profileData = profileRes.data as { full_name: string } | null;
  const schoolData = schoolRes.data as {
    name: string;
    currency: string | null;
  } | null;
  const profileName = profileData?.full_name || "Admin";
  const schoolName = schoolData?.name || "Your School";
  const schoolCurrency = normalizeSchoolCurrency(schoolData?.currency);
  const schoolTitle = formatSchoolTitleWithCurrency(schoolName, schoolCurrency);
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
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            {schoolTitle}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Welcome back, {profileName}
          </p>
        </div>
        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Students"
            value={String(totalStudents)}
            icon={
              <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
              <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Quick Actions
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:group-hover:bg-indigo-950/50">
                  {link.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                    {link.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                    {link.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
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
