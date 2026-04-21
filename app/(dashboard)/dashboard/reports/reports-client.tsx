"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { UpgradeModal } from "@/components/upgrade-modal";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";

const REPORTS_ROW_OPTIONS = [5, 10, 15, 20, 25, 50] as const;
type ReportsRowOption = (typeof REPORTS_ROW_OPTIONS)[number];

const REPORTS_STUDENT_FEES_ROWS_STORAGE_KEY =
  "adakaro:dashboardReports:studentFees:rowsPerPage";
const REPORTS_CLASS_SUMMARY_ROWS_STORAGE_KEY =
  "adakaro:dashboardReports:classSummary:rowsPerPage";
const REPORTS_OUTSTANDING_ROWS_STORAGE_KEY =
  "adakaro:dashboardReports:outstanding:rowsPerPage";
const REPORTS_MONTHLY_INCOME_ROWS_STORAGE_KEY =
  "adakaro:dashboardReports:monthlyIncome:rowsPerPage";

function parseReportsRowsPerPage(raw: string | null): ReportsRowOption | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return (REPORTS_ROW_OPTIONS as readonly number[]).includes(n)
    ? (n as ReportsRowOption)
    : null;
}

type FeeStatusFilter =
  | "all"
  | "fully-paid"
  | "outstanding"
  | "partially-paid";

type StudentFeeRow = {
  studentId: string;
  studentName: string;
  className: string;
  classId: string;
  totalFee: number;
  totalPaid: number;
  balance: number;
};

// ─── Types ────────────────────────────────────────────────

interface BalanceRow {
  student_id: string;
  student_name: string;
  fee_structure_id: string;
  fee_name: string;
  total_fee: number;
  total_paid: number;
  balance: number;
  due_date: string | null;
}

interface PaymentRow {
  id: string;
  student_id: string;
  amount: number;
  payment_method: string | null;
  payment_date: string;
  reference_number: string | null;
  student: { full_name: string; admission_number: string | null } | null;
}

interface ClassRow {
  id: string;
  name: string;
}

interface StudentClassRow {
  id: string;
  class_id: string;
}

interface Props {
  balances: BalanceRow[];
  payments: PaymentRow[];
  classes: ClassRow[];
  studentClasses: StudentClassRow[];
  schoolName: string;
  currencyCode: string;
  /** Basic+ plans: server CSV export. */
  canAdvancedReports: boolean;
}

type ReportTab =
  | "student-fees"
  | "class-summary"
  | "outstanding"
  | "monthly-income";

const TABS: { id: ReportTab; label: string }[] = [
  { id: "student-fees", label: "Student Fees" },
  { id: "class-summary", label: "Class Summary" },
  { id: "outstanding", label: "Outstanding" },
  { id: "monthly-income", label: "Monthly Income" },
];

// ─── Helpers ──────────────────────────────────────────────

// ─── Main component ──────────────────────────────────────

export function ReportsClient({
  balances,
  payments,
  classes,
  studentClasses,
  schoolName,
  currencyCode,
  canAdvancedReports,
}: Props) {
  const money = (n: number) => formatCurrency(n, currencyCode);
  const [activeTab, setActiveTab] = useState<ReportTab>("student-fees");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const classMap = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [classes]);

  // Map student_id → class_id
  const studentClassMap = useMemo(() => {
    const map = new Map<string, string>();
    studentClasses.forEach((sc) => map.set(sc.id, sc.class_id));
    return map;
  }, [studentClasses]);

  // ── Aggregations ────────────────────────────────────────

  const studentFeeRows = useMemo(() => {
    const map = new Map<string, StudentFeeRow>();

    balances.forEach((b) => {
      const existing = map.get(b.student_id);
      if (existing) {
        existing.totalFee += Number(b.total_fee);
        existing.totalPaid += Number(b.total_paid);
        existing.balance += Number(b.balance);
      } else {
        const cid = studentClassMap.get(b.student_id) ?? "";
        map.set(b.student_id, {
          studentId: b.student_id,
          studentName: b.student_name,
          className: classMap.get(cid) ?? "—",
          classId: cid,
          totalFee: Number(b.total_fee),
          totalPaid: Number(b.total_paid),
          balance: Number(b.balance),
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.studentName.localeCompare(b.studentName)
    );
  }, [balances, classMap, studentClassMap]);

  const classSummaryRows = useMemo(() => {
    const map = new Map<
      string,
      {
        classId: string;
        className: string;
        totalFee: number;
        totalPaid: number;
        outstanding: number;
        studentCount: number;
      }
    >();

    const studentsPerClass = new Map<string, Set<string>>();

    balances.forEach((b) => {
      const cid = studentClassMap.get(b.student_id) ?? "unknown";
      const existing = map.get(cid);
      if (existing) {
        existing.totalFee += Number(b.total_fee);
        existing.totalPaid += Number(b.total_paid);
        existing.outstanding += Math.max(0, Number(b.balance));
        studentsPerClass.get(cid)!.add(b.student_id);
      } else {
        map.set(cid, {
          classId: cid,
          className: classMap.get(cid) ?? "—",
          totalFee: Number(b.total_fee),
          totalPaid: Number(b.total_paid),
          outstanding: Math.max(0, Number(b.balance)),
          studentCount: 0,
        });
        studentsPerClass.set(cid, new Set([b.student_id]));
      }
    });

    studentsPerClass.forEach((students, classId) => {
      const row = map.get(classId);
      if (row) row.studentCount = students.size;
    });

    return Array.from(map.values()).sort((a, b) =>
      a.className.localeCompare(b.className)
    );
  }, [balances, classMap, studentClassMap]);

  const outstandingRows = useMemo(() => {
    return studentFeeRows.filter((r) => r.balance > 0);
  }, [studentFeeRows]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (dateFrom && p.payment_date < dateFrom) return false;
      if (dateTo && p.payment_date > dateTo) return false;
      return true;
    });
  }, [payments, dateFrom, dateTo]);

  const monthlyIncomeRows = useMemo(() => {
    const map = new Map<
      string,
      { month: string; total: number; count: number }
    >();

    filteredPayments.forEach((p) => {
      const month = p.payment_date.substring(0, 7); // YYYY-MM
      const existing = map.get(month);
      if (existing) {
        existing.total += Number(p.amount);
        existing.count += 1;
      } else {
        map.set(month, { month, total: Number(p.amount), count: 1 });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      b.month.localeCompare(a.month)
    );
  }, [filteredPayments]);

  // ── Export handlers ─────────────────────────────────────

  async function handleExportCsv() {
    if (!canAdvancedReports) {
      setUpgradeOpen(true);
      return;
    }

    const fallbackName = `report-${new Date().toISOString().split("T")[0]}.csv`;
    try {
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: activeTab,
          dateFrom,
          dateTo,
        }),
      });

      if (res.status === 403) {
        setUpgradeOpen(true);
        return;
      }

      if (!res.ok) {
        return;
      }

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const m = cd?.match(/filename="?([^";\n]+)"?/i);
      const filename = m?.[1] ?? fallbackName;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 print:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-school-primary text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date filter — only for Monthly Income */}
      {activeTab === "monthly-income" && (
        <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 print:hidden">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Export buttons — other tabs (Student Fees uses toolbar inside tab) */}
      {activeTab !== "student-fees" ? (
        <div className="mt-4 flex gap-2 print:hidden">
          <ExportCsvButton
            canAdvancedReports={canAdvancedReports}
            onClick={() => void handleExportCsv()}
          />
          <PrintPdfButton onClick={handlePrint} />
        </div>
      ) : null}

      {/* Report content (printable area) */}
      <div ref={printRef} className="mt-6">
        {/* Print header (only visible when printing) */}
        <div className="mb-6 hidden print:block">
          <h1 className="text-xl font-bold">{schoolName}</h1>
          <p className="text-sm text-gray-600">
            {TABS.find((t) => t.id === activeTab)?.label} Report —{" "}
            {new Date().toLocaleDateString("en-GB")}
          </p>
        </div>

        {activeTab === "student-fees" && (
          <StudentFeesTab
            rows={studentFeeRows}
            classes={classes}
            formatMoney={money}
            canAdvancedReports={canAdvancedReports}
            onExportCsv={() => void handleExportCsv()}
            onPrint={handlePrint}
          />
        )}
        {activeTab === "class-summary" && (
          <ClassSummaryTab rows={classSummaryRows} formatMoney={money} />
        )}
        {activeTab === "outstanding" && (
          <OutstandingTab
            rows={outstandingRows}
            classes={classes}
            formatMoney={money}
          />
        )}
        {activeTab === "monthly-income" && (
          <MonthlyIncomeTab
            rows={monthlyIncomeRows}
            dateFrom={dateFrom}
            dateTo={dateTo}
            formatMoney={money}
          />
        )}
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        requiredPlan="basic"
        featureName="Advanced reports (CSV export and class summaries)"
      />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function feeRowMatchesStatus(
  row: { totalPaid: number; balance: number },
  status: FeeStatusFilter
): boolean {
  const { balance: bal, totalPaid: paid } = row;
  switch (status) {
    case "all":
      return true;
    case "fully-paid":
      return bal === 0;
    case "outstanding":
      return bal > 0;
    case "partially-paid":
      return paid > 0 && bal > 0;
    default:
      return true;
  }
}

function ExportCsvButton({
  canAdvancedReports,
  onClick,
}: {
  canAdvancedReports: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
        canAdvancedReports
          ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          : "border-dashed border-slate-300 bg-white text-slate-500 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }`}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      Export CSV
      {!canAdvancedReports ? " (Basic+)" : ""}
    </button>
  );
}

function PrintPdfButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m0 0a48.159 48.159 0 0 1 12.5 0m-12.5 0V5.625c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v3.034"
        />
      </svg>
      Print / PDF
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm text-slate-500 dark:text-zinc-400">{message}</p>
    </div>
  );
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </div>
  );
}

const thClass =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400";
const tdClass =
  "px-4 py-3 text-sm text-slate-900 dark:text-white whitespace-nowrap";
const tdMutedClass =
  "px-4 py-3 text-sm text-slate-500 dark:text-zinc-400 whitespace-nowrap";
const tfootTdClass =
  "px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap";

// ─── 1. Student Fee Report (search, filters, pagination) ───

function StudentFeesTab({
  rows,
  classes,
  formatMoney,
  canAdvancedReports,
  onExportCsv,
  onPrint,
}: {
  rows: StudentFeeRow[];
  classes: ClassRow[];
  formatMoney: (n: number) => string;
  canAdvancedReports: boolean;
  onExportCsv: () => void;
  onPrint: () => void;
}) {
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeeStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<ReportsRowOption>(5);

  useEffect(() => {
    const stored = parseReportsRowsPerPage(
      localStorage.getItem(REPORTS_STUDENT_FEES_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (classFilter && r.classId !== classFilter) return false;
      if (!feeRowMatchesStatus(r, statusFilter)) return false;
      if (q && !r.studentName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, classFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, classFilter, statusFilter]);

  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const pagedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  const filteredTotals = useMemo(
    () => ({
      totalFee: filteredRows.reduce((s, r) => s + r.totalFee, 0),
      totalPaid: filteredRows.reduce((s, r) => s + r.totalPaid, 0),
      balance: filteredRows.reduce((s, r) => s + r.balance, 0),
    }),
    [filteredRows]
  );

  const paginationItems = useMemo(
    () => getCompactPaginationItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const showingFrom =
    totalFiltered === 0 ? 0 : Math.min(startIndex + 1, totalFiltered);
  const showingTo =
    totalFiltered === 0
      ? 0
      : Math.min(startIndex + rowsPerPage, totalFiltered);

  const sortedClassOptions = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name)),
    [classes]
  );

  if (rows.length === 0) {
    return <EmptyState message="No student fee data available." />;
  }

  return (
    <div className="space-y-3">
      <div className="print:hidden">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by student name..."
              aria-label="Search by student name"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400">
                Class
              </label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                aria-label="Filter by class"
                className="mt-1 w-full min-w-[10rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:w-48"
              >
                <option value="">All classes</option>
                {sortedClassOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400">
                Fee status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as FeeStatusFilter)
                }
                aria-label="Filter by fee status"
                className="mt-1 w-full min-w-[10rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:w-48"
              >
                <option value="all">All students</option>
                <option value="fully-paid">Fully paid</option>
                <option value="outstanding">Outstanding</option>
                <option value="partially-paid">Partially paid</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2 pb-0.5">
              <ExportCsvButton
                canAdvancedReports={canAdvancedReports}
                onClick={onExportCsv}
              />
              <PrintPdfButton onClick={onPrint} />
            </div>
          </div>
        </div>

      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-3 dark:border-zinc-700 print:hidden">
        <p className="min-w-0 text-sm text-slate-600 dark:text-zinc-400">
          {totalFiltered === 0 ? (
            "No students match your filters."
          ) : (
            <>
              Showing{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {showingFrom}–{showingTo}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {totalFiltered}
              </span>{" "}
              student{totalFiltered !== 1 ? "s" : ""}
            </>
          )}
        </p>
        <label className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-zinc-400">
            Rows per page:
          </span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              const n = Number(e.target.value) as ReportsRowOption;
              setRowsPerPage(n);
              setPage(1);
              localStorage.setItem(
                REPORTS_STUDENT_FEES_ROWS_STORAGE_KEY,
                String(n)
              );
            }}
            aria-label="Rows per page"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {REPORTS_ROW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalFiltered === 0 ? null : (
        <>
          <TableWrapper>
            <table className="w-full min-w-[600px]">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <tr>
                  <th className={thClass}>Student</th>
                  <th className={thClass}>Class</th>
                  <th className={`${thClass} text-right`}>Total Fees</th>
                  <th className={`${thClass} text-right`}>Paid</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {pagedRows.map((r) => (
                  <tr
                    key={r.studentId}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/30"
                  >
                    <td className={tdClass}>{r.studentName}</td>
                    <td className={tdMutedClass}>{r.className}</td>
                    <td className={`${tdClass} text-right`}>
                      {formatMoney(r.totalFee)}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {formatMoney(r.totalPaid)}
                    </td>
                    <td
                      className={`${tdClass} text-right ${r.balance > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}`}
                    >
                      {formatMoney(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                <tr>
                  <td className={tfootTdClass}>Total</td>
                  <td className={tfootTdClass}>
                    {totalFiltered} student{totalFiltered !== 1 ? "s" : ""}
                  </td>
                  <td className={`${tfootTdClass} text-right`}>
                    {formatMoney(filteredTotals.totalFee)}
                  </td>
                  <td className={`${tfootTdClass} text-right`}>
                    {formatMoney(filteredTotals.totalPaid)}
                  </td>
                  <td
                    className={`${tfootTdClass} text-right text-amber-600 dark:text-amber-400`}
                  >
                    {formatMoney(filteredTotals.balance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableWrapper>

          {totalPages > 1 ? (
            <nav
              className="flex flex-wrap items-center justify-center gap-2 print:hidden"
              aria-label="Student fees pagination"
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Previous
              </button>
              {paginationItems.map((item, idx) =>
                item === "ellipsis" ? (
                  <span
                    key={`fees-ellipsis-${idx}`}
                    className="px-2 text-sm text-slate-400 dark:text-zinc-500"
                    aria-hidden
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    aria-current={item === safePage ? "page" : undefined}
                    className={
                      item === safePage
                        ? "rounded-lg border border-school-primary bg-school-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                        : "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    }
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

// ─── 2. Class Payment Summary ──────────────────────────────

type ClassSummaryRow = {
  classId: string;
  className: string;
  studentCount: number;
  totalFee: number;
  totalPaid: number;
  outstanding: number;
};

function ClassSummaryTab({
  rows,
  formatMoney,
}: {
  rows: ClassSummaryRow[];
  formatMoney: (n: number) => string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<ReportsRowOption>(5);

  useEffect(() => {
    const stored = parseReportsRowsPerPage(
      localStorage.getItem(REPORTS_CLASS_SUMMARY_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.className.toLowerCase().includes(q));
  }, [rows, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const pagedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  const filteredTotals = useMemo(
    () => ({
      students: filteredRows.reduce((s, r) => s + r.studentCount, 0),
      totalFee: filteredRows.reduce((s, r) => s + r.totalFee, 0),
      totalPaid: filteredRows.reduce((s, r) => s + r.totalPaid, 0),
      outstanding: filteredRows.reduce((s, r) => s + r.outstanding, 0),
    }),
    [filteredRows]
  );

  const paginationItems = useMemo(
    () => getCompactPaginationItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const showingFrom =
    totalFiltered === 0 ? 0 : Math.min(startIndex + 1, totalFiltered);
  const showingTo =
    totalFiltered === 0
      ? 0
      : Math.min(startIndex + rowsPerPage, totalFiltered);

  if (rows.length === 0) {
    return <EmptyState message="No class data available." />;
  }

  return (
    <div className="space-y-3">
      <div className="print:hidden">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by class name..."
              aria-label="Search by class name"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-3 dark:border-zinc-700 print:hidden">
        <p className="min-w-0 text-sm text-slate-600 dark:text-zinc-400">
          {totalFiltered === 0 ? (
            "No classes match your search."
          ) : (
            <>
              Showing{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {showingFrom}–{showingTo}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {totalFiltered}
              </span>{" "}
              record{totalFiltered !== 1 ? "s" : ""}
            </>
          )}
        </p>
        <label className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-zinc-400">
            Rows per page:
          </span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              const n = Number(e.target.value) as ReportsRowOption;
              setRowsPerPage(n);
              setPage(1);
              localStorage.setItem(
                REPORTS_CLASS_SUMMARY_ROWS_STORAGE_KEY,
                String(n)
              );
            }}
            aria-label="Rows per page"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {REPORTS_ROW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalFiltered === 0 ? null : (
        <>
          <TableWrapper>
            <table className="w-full min-w-[600px]">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <tr>
                  <th className={thClass}>Class</th>
                  <th className={`${thClass} text-right`}>Students</th>
                  <th className={`${thClass} text-right`}>Total Fees</th>
                  <th className={`${thClass} text-right`}>Paid</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {pagedRows.map((r) => (
                  <tr
                    key={r.classId}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/30"
                  >
                    <td className={tdClass}>{r.className}</td>
                    <td className={`${tdMutedClass} text-right`}>
                      {r.studentCount}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {formatMoney(r.totalFee)}
                    </td>
                    <td
                      className={`${tdClass} text-right text-emerald-600 dark:text-emerald-400`}
                    >
                      {formatMoney(r.totalPaid)}
                    </td>
                    <td
                      className={`${tdClass} text-right ${r.outstanding > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}`}
                    >
                      {formatMoney(r.outstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                <tr>
                  <td className={tfootTdClass}>Total</td>
                  <td className={`${tfootTdClass} text-right`}>
                    {filteredTotals.students}
                  </td>
                  <td className={`${tfootTdClass} text-right`}>
                    {formatMoney(filteredTotals.totalFee)}
                  </td>
                  <td
                    className={`${tfootTdClass} text-right text-emerald-600 dark:text-emerald-400`}
                  >
                    {formatMoney(filteredTotals.totalPaid)}
                  </td>
                  <td
                    className={`${tfootTdClass} text-right text-amber-600 dark:text-amber-400`}
                  >
                    {formatMoney(filteredTotals.outstanding)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableWrapper>

          {totalPages > 1 ? (
            <nav
              className="flex flex-wrap items-center justify-center gap-2 print:hidden"
              aria-label="Class summary pagination"
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Previous
              </button>
              {paginationItems.map((item, idx) =>
                item === "ellipsis" ? (
                  <span
                    key={`class-sum-ellipsis-${idx}`}
                    className="px-2 text-sm text-slate-400 dark:text-zinc-500"
                    aria-hidden
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    aria-current={item === safePage ? "page" : undefined}
                    className={
                      item === safePage
                        ? "rounded-lg border border-school-primary bg-school-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                        : "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    }
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

// ─── 3. Outstanding Balances ───────────────────────────────

function OutstandingTab({
  rows,
  classes,
  formatMoney,
}: {
  rows: StudentFeeRow[];
  classes: ClassRow[];
  formatMoney: (n: number) => string;
}) {
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<ReportsRowOption>(5);

  useEffect(() => {
    const stored = parseReportsRowsPerPage(
      localStorage.getItem(REPORTS_OUTSTANDING_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  const sortedClassOptions = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name)),
    [classes]
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (classFilter && r.classId !== classFilter) return false;
      if (q && !r.studentName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, classFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, classFilter]);

  const totalFiltered = filteredRows.length;
  const filteredOutstandingTotal = useMemo(
    () => filteredRows.reduce((s, r) => s + r.balance, 0),
    [filteredRows]
  );

  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const pagedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  const filteredTotals = useMemo(
    () => ({
      totalFee: filteredRows.reduce((s, r) => s + r.totalFee, 0),
      totalPaid: filteredRows.reduce((s, r) => s + r.totalPaid, 0),
      balance: filteredRows.reduce((s, r) => s + r.balance, 0),
    }),
    [filteredRows]
  );

  const paginationItems = useMemo(
    () => getCompactPaginationItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const showingFrom =
    totalFiltered === 0 ? 0 : Math.min(startIndex + 1, totalFiltered);
  const showingTo =
    totalFiltered === 0
      ? 0
      : Math.min(startIndex + rowsPerPage, totalFiltered);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-12 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          All fees have been paid. No outstanding balances.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="print:hidden">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by student name..."
              aria-label="Search by student name"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400">
              Class
            </label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              aria-label="Filter by class"
              className="mt-1 w-full min-w-[10rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:w-48"
            >
              <option value="">All classes</option>
              {sortedClassOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {totalFiltered > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20 print:hidden">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {totalFiltered} student{totalFiltered !== 1 ? "s" : ""} with
            outstanding balances totalling{" "}
            <span className="font-bold">
              {formatMoney(filteredOutstandingTotal)}
            </span>
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-3 dark:border-zinc-700 print:hidden">
        <p className="min-w-0 text-sm text-slate-600 dark:text-zinc-400">
          {totalFiltered === 0 ? (
            "No students match your search or class filter."
          ) : (
            <>
              Showing{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {showingFrom}–{showingTo}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {totalFiltered}
              </span>{" "}
              record{totalFiltered !== 1 ? "s" : ""}
            </>
          )}
        </p>
        <label className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-zinc-400">
            Rows per page:
          </span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              const n = Number(e.target.value) as ReportsRowOption;
              setRowsPerPage(n);
              setPage(1);
              localStorage.setItem(
                REPORTS_OUTSTANDING_ROWS_STORAGE_KEY,
                String(n)
              );
            }}
            aria-label="Rows per page"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {REPORTS_ROW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalFiltered === 0 ? null : (
        <>
          <TableWrapper>
            <table className="w-full min-w-[600px]">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <tr>
                  <th className={thClass}>Student</th>
                  <th className={thClass}>Class</th>
                  <th className={`${thClass} text-right`}>Total Fees</th>
                  <th className={`${thClass} text-right`}>Paid</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {pagedRows.map((r) => (
                  <tr
                    key={r.studentId}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/30"
                  >
                    <td className={tdClass}>{r.studentName}</td>
                    <td className={tdMutedClass}>{r.className}</td>
                    <td className={`${tdClass} text-right`}>
                      {formatMoney(r.totalFee)}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {formatMoney(r.totalPaid)}
                    </td>
                    <td
                      className={`${tdClass} text-right font-semibold text-amber-600 dark:text-amber-400`}
                    >
                      {formatMoney(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                <tr>
                  <td className={tfootTdClass}>Total</td>
                  <td className={tfootTdClass}>
                    {totalFiltered} student{totalFiltered !== 1 ? "s" : ""}
                  </td>
                  <td className={`${tfootTdClass} text-right`}>
                    {formatMoney(filteredTotals.totalFee)}
                  </td>
                  <td className={`${tfootTdClass} text-right`}>
                    {formatMoney(filteredTotals.totalPaid)}
                  </td>
                  <td
                    className={`${tfootTdClass} text-right text-amber-600 dark:text-amber-400`}
                  >
                    {formatMoney(filteredTotals.balance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableWrapper>

          {totalPages > 1 ? (
            <nav
              className="flex flex-wrap items-center justify-center gap-2 print:hidden"
              aria-label="Outstanding pagination"
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Previous
              </button>
              {paginationItems.map((item, idx) =>
                item === "ellipsis" ? (
                  <span
                    key={`outstanding-ellipsis-${idx}`}
                    className="px-2 text-sm text-slate-400 dark:text-zinc-500"
                    aria-hidden
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    aria-current={item === safePage ? "page" : undefined}
                    className={
                      item === safePage
                        ? "rounded-lg border border-school-primary bg-school-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                        : "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    }
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

// ─── 4. Monthly Income Summary ─────────────────────────────

function formatMonthIncomeLabel(ym: string): string {
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-KE", { year: "numeric", month: "long" });
}

function MonthlyIncomeTab({
  rows,
  dateFrom,
  dateTo,
  formatMoney,
}: {
  rows: { month: string; total: number; count: number }[];
  dateFrom: string;
  dateTo: string;
  formatMoney: (n: number) => string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<ReportsRowOption>(5);

  useEffect(() => {
    const stored = parseReportsRowsPerPage(
      localStorage.getItem(REPORTS_MONTHLY_INCOME_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const label = formatMonthIncomeLabel(r.month).toLowerCase();
      return r.month.toLowerCase().includes(q) || label.includes(q);
    });
  }, [rows, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const pagedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  const filteredTotals = useMemo(
    () => ({
      count: filteredRows.reduce((s, r) => s + r.count, 0),
      total: filteredRows.reduce((s, r) => s + r.total, 0),
    }),
    [filteredRows]
  );

  const paginationItems = useMemo(
    () => getCompactPaginationItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const showingFrom =
    totalFiltered === 0 ? 0 : Math.min(startIndex + 1, totalFiltered);
  const showingTo =
    totalFiltered === 0
      ? 0
      : Math.min(startIndex + rowsPerPage, totalFiltered);

  if (rows.length === 0) {
    return (
      <EmptyState message="No payments found for the selected period." />
    );
  }

  return (
    <div className="space-y-3">
      {(dateFrom || dateTo) && (
        <div className="rounded-xl border border-[rgb(var(--school-primary-rgb)/0.25)] bg-[rgb(var(--school-primary-rgb)/0.10)] px-4 py-3 dark:border-[rgb(var(--school-primary-rgb)/0.32)] dark:bg-[rgb(var(--school-primary-rgb)/0.12)] print:hidden">
          <p className="text-sm text-school-primary dark:text-school-primary">
            Filtered:{" "}
            {dateFrom ? `from ${dateFrom}` : "all time"}
            {dateTo ? ` to ${dateTo}` : " to present"}
          </p>
        </div>
      )}

      <div className="print:hidden">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by month or year..."
              aria-label="Search by month or year"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-3 dark:border-zinc-700 print:hidden">
        <p className="min-w-0 text-sm text-slate-600 dark:text-zinc-400">
          {totalFiltered === 0 ? (
            "No months match your search."
          ) : (
            <>
              Showing{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {showingFrom}–{showingTo}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {totalFiltered}
              </span>{" "}
              record{totalFiltered !== 1 ? "s" : ""}
            </>
          )}
        </p>
        <label className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-zinc-400">
            Rows per page:
          </span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              const n = Number(e.target.value) as ReportsRowOption;
              setRowsPerPage(n);
              setPage(1);
              localStorage.setItem(
                REPORTS_MONTHLY_INCOME_ROWS_STORAGE_KEY,
                String(n)
              );
            }}
            aria-label="Rows per page"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {REPORTS_ROW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalFiltered === 0 ? null : (
        <>
          <TableWrapper>
            <table className="w-full min-w-[400px]">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <tr>
                  <th className={thClass}>Month</th>
                  <th className={`${thClass} text-right`}>Transactions</th>
                  <th className={`${thClass} text-right`}>Total Income</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {pagedRows.map((r) => (
                  <tr
                    key={r.month}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/30"
                  >
                    <td className={tdClass}>
                      {formatMonthIncomeLabel(r.month)}
                    </td>
                    <td className={`${tdMutedClass} text-right`}>{r.count}</td>
                    <td
                      className={`${tdClass} text-right font-semibold text-emerald-600 dark:text-emerald-400`}
                    >
                      {formatMoney(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                <tr>
                  <td className={tfootTdClass}>Grand Total</td>
                  <td className={`${tfootTdClass} text-right`}>
                    {filteredTotals.count}
                  </td>
                  <td
                    className={`${tfootTdClass} text-right text-emerald-600 dark:text-emerald-400`}
                  >
                    {formatMoney(filteredTotals.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableWrapper>

          {totalPages > 1 ? (
            <nav
              className="flex flex-wrap items-center justify-center gap-2 print:hidden"
              aria-label="Monthly income pagination"
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Previous
              </button>
              {paginationItems.map((item, idx) =>
                item === "ellipsis" ? (
                  <span
                    key={`monthly-ellipsis-${idx}`}
                    className="px-2 text-sm text-slate-400 dark:text-zinc-500"
                    aria-hidden
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    aria-current={item === safePage ? "page" : undefined}
                    className={
                      item === safePage
                        ? "rounded-lg border border-school-primary bg-school-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                        : "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    }
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
