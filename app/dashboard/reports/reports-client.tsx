"use client";

import { useState, useMemo, useRef } from "react";
import { formatCurrency } from "@/lib/currency";

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

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;

  const csv = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Main component ──────────────────────────────────────

export function ReportsClient({
  balances,
  payments,
  classes,
  studentClasses,
  schoolName,
  currencyCode,
}: Props) {
  const money = (n: number) => formatCurrency(n, currencyCode);
  const [activeTab, setActiveTab] = useState<ReportTab>("student-fees");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
    const map = new Map<
      string,
      {
        studentName: string;
        className: string;
        classId: string;
        totalFee: number;
        totalPaid: number;
        balance: number;
      }
    >();

    balances.forEach((b) => {
      const existing = map.get(b.student_id);
      if (existing) {
        existing.totalFee += Number(b.total_fee);
        existing.totalPaid += Number(b.total_paid);
        existing.balance += Number(b.balance);
      } else {
        const cid = studentClassMap.get(b.student_id) ?? "";
        map.set(b.student_id, {
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

  function handleExportCsv() {
    const now = new Date().toISOString().split("T")[0];

    switch (activeTab) {
      case "student-fees":
        downloadCsv(
          `student-fee-report-${now}.csv`,
          ["Student", "Class", "Total Fees", "Paid", "Balance"],
          studentFeeRows.map((r) => [
            r.studentName,
            r.className,
            String(r.totalFee),
            String(r.totalPaid),
            String(r.balance),
          ])
        );
        break;
      case "class-summary":
        downloadCsv(
          `class-payment-summary-${now}.csv`,
          ["Class", "Students", "Total Fees", "Collected", "Outstanding"],
          classSummaryRows.map((r) => [
            r.className,
            String(r.studentCount),
            String(r.totalFee),
            String(r.totalPaid),
            String(r.outstanding),
          ])
        );
        break;
      case "outstanding":
        downloadCsv(
          `outstanding-balances-${now}.csv`,
          ["Student", "Class", "Total Fees", "Paid", "Balance"],
          outstandingRows.map((r) => [
            r.studentName,
            r.className,
            String(r.totalFee),
            String(r.totalPaid),
            String(r.balance),
          ])
        );
        break;
      case "monthly-income":
        downloadCsv(
          `monthly-income-${now}.csv`,
          ["Month", "Transactions", "Total Income"],
          monthlyIncomeRows.map((r) => [
            r.month,
            String(r.count),
            String(r.total),
          ])
        );
        break;
    }
  }

  function handlePrint() {
    window.print();
  }

  // ── Totals ──────────────────────────────────────────────

  const grandTotalFee = studentFeeRows.reduce((s, r) => s + r.totalFee, 0);
  const grandTotalPaid = studentFeeRows.reduce((s, r) => s + r.totalPaid, 0);
  const grandBalance = studentFeeRows.reduce((s, r) => s + r.balance, 0);
  const grandOutstanding = outstandingRows.reduce((s, r) => s + r.balance, 0);
  const grandMonthlyIncome = monthlyIncomeRows.reduce(
    (s, r) => s + r.total,
    0
  );

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
                ? "bg-indigo-600 text-white shadow-sm"
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
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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

      {/* Export buttons */}
      <div className="mt-4 flex gap-2 print:hidden">
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
      </div>

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
          <StudentFeeReport
            rows={studentFeeRows}
            grandTotal={grandTotalFee}
            grandPaid={grandTotalPaid}
            grandBalance={grandBalance}
            formatMoney={money}
          />
        )}
        {activeTab === "class-summary" && (
          <ClassSummaryReport
            rows={classSummaryRows}
            grandTotal={grandTotalFee}
            grandPaid={grandTotalPaid}
            grandOutstanding={grandBalance > 0 ? grandBalance : 0}
            formatMoney={money}
          />
        )}
        {activeTab === "outstanding" && (
          <OutstandingReport
            rows={outstandingRows}
            grandOutstanding={grandOutstanding}
            formatMoney={money}
          />
        )}
        {activeTab === "monthly-income" && (
          <MonthlyIncomeReport
            rows={monthlyIncomeRows}
            grandTotal={grandMonthlyIncome}
            dateFrom={dateFrom}
            dateTo={dateTo}
            formatMoney={money}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

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

// ─── 1. Student Fee Report ─────────────────────────────────

function StudentFeeReport({
  rows,
  grandTotal,
  grandPaid,
  grandBalance,
  formatMoney,
}: {
  rows: { studentName: string; className: string; totalFee: number; totalPaid: number; balance: number }[];
  grandTotal: number;
  grandPaid: number;
  grandBalance: number;
  formatMoney: (n: number) => string;
}) {
  if (rows.length === 0) return <EmptyState message="No student fee data available." />;

  return (
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
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30">
              <td className={tdClass}>{r.studentName}</td>
              <td className={tdMutedClass}>{r.className}</td>
              <td className={`${tdClass} text-right`}>{formatMoney(r.totalFee)}</td>
              <td className={`${tdClass} text-right`}>{formatMoney(r.totalPaid)}</td>
              <td className={`${tdClass} text-right ${r.balance > 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}`}>
                {formatMoney(r.balance)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-slate-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50">
          <tr>
            <td className={tfootTdClass}>Total</td>
            <td className={tfootTdClass}>{rows.length} students</td>
            <td className={`${tfootTdClass} text-right`}>{formatMoney(grandTotal)}</td>
            <td className={`${tfootTdClass} text-right`}>{formatMoney(grandPaid)}</td>
            <td className={`${tfootTdClass} text-right text-amber-600 dark:text-amber-400`}>
              {formatMoney(grandBalance)}
            </td>
          </tr>
        </tfoot>
      </table>
    </TableWrapper>
  );
}

// ─── 2. Class Payment Summary ──────────────────────────────

function ClassSummaryReport({
  rows,
  grandTotal,
  grandPaid,
  grandOutstanding,
  formatMoney,
}: {
  rows: { className: string; studentCount: number; totalFee: number; totalPaid: number; outstanding: number }[];
  grandTotal: number;
  grandPaid: number;
  grandOutstanding: number;
  formatMoney: (n: number) => string;
}) {
  if (rows.length === 0) return <EmptyState message="No class data available." />;

  return (
    <TableWrapper>
      <table className="w-full min-w-[600px]">
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/50">
          <tr>
            <th className={thClass}>Class</th>
            <th className={`${thClass} text-right`}>Students</th>
            <th className={`${thClass} text-right`}>Total Fees</th>
            <th className={`${thClass} text-right`}>Collected</th>
            <th className={`${thClass} text-right`}>Outstanding</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30">
              <td className={tdClass}>{r.className}</td>
              <td className={`${tdMutedClass} text-right`}>{r.studentCount}</td>
              <td className={`${tdClass} text-right`}>{formatMoney(r.totalFee)}</td>
              <td className={`${tdClass} text-right text-emerald-600 dark:text-emerald-400`}>
                {formatMoney(r.totalPaid)}
              </td>
              <td className={`${tdClass} text-right ${r.outstanding > 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}`}>
                {formatMoney(r.outstanding)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-slate-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50">
          <tr>
            <td className={tfootTdClass}>Total</td>
            <td className={`${tfootTdClass} text-right`}>{rows.reduce((s, r) => s + r.studentCount, 0)}</td>
            <td className={`${tfootTdClass} text-right`}>{formatMoney(grandTotal)}</td>
            <td className={`${tfootTdClass} text-right text-emerald-600 dark:text-emerald-400`}>
              {formatMoney(grandPaid)}
            </td>
            <td className={`${tfootTdClass} text-right text-amber-600 dark:text-amber-400`}>
              {formatMoney(grandOutstanding)}
            </td>
          </tr>
        </tfoot>
      </table>
    </TableWrapper>
  );
}

// ─── 3. Outstanding Balances ───────────────────────────────

function OutstandingReport({
  rows,
  grandOutstanding,
  formatMoney,
}: {
  rows: { studentName: string; className: string; totalFee: number; totalPaid: number; balance: number }[];
  grandOutstanding: number;
  formatMoney: (n: number) => string;
}) {
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
    <>
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          {rows.length} student{rows.length !== 1 ? "s" : ""} with outstanding
          balances totalling{" "}
          <span className="font-bold">{formatMoney(grandOutstanding)}</span>
        </p>
      </div>

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
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                <td className={tdClass}>{r.studentName}</td>
                <td className={tdMutedClass}>{r.className}</td>
                <td className={`${tdClass} text-right`}>{formatMoney(r.totalFee)}</td>
                <td className={`${tdClass} text-right`}>{formatMoney(r.totalPaid)}</td>
                <td className={`${tdClass} text-right text-amber-600 dark:text-amber-400 font-semibold`}>
                  {formatMoney(r.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50">
            <tr>
              <td className={tfootTdClass}>Total</td>
              <td className={tfootTdClass}>{rows.length} students</td>
              <td className={`${tfootTdClass} text-right`}>
                {formatMoney(rows.reduce((s, r) => s + r.totalFee, 0))}
              </td>
              <td className={`${tfootTdClass} text-right`}>
                {formatMoney(rows.reduce((s, r) => s + r.totalPaid, 0))}
              </td>
              <td className={`${tfootTdClass} text-right text-amber-600 dark:text-amber-400`}>
                {formatMoney(grandOutstanding)}
              </td>
            </tr>
          </tfoot>
        </table>
      </TableWrapper>
    </>
  );
}

// ─── 4. Monthly Income Summary ─────────────────────────────

function MonthlyIncomeReport({
  rows,
  grandTotal,
  dateFrom,
  dateTo,
  formatMoney,
}: {
  rows: { month: string; total: number; count: number }[];
  grandTotal: number;
  dateFrom: string;
  dateTo: string;
  formatMoney: (n: number) => string;
}) {
  if (rows.length === 0) return <EmptyState message="No payments found for the selected period." />;

  const formatMonth = (ym: string) => {
    const [year, month] = ym.split("-");
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString("en-KE", { year: "numeric", month: "long" });
  };

  return (
    <>
      {(dateFrom || dateTo) && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            Filtered:{" "}
            {dateFrom ? `from ${dateFrom}` : "all time"}
            {dateTo ? ` to ${dateTo}` : " to present"}
          </p>
        </div>
      )}

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
            {rows.map((r) => (
              <tr key={r.month} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                <td className={tdClass}>{formatMonth(r.month)}</td>
                <td className={`${tdMutedClass} text-right`}>{r.count}</td>
                <td className={`${tdClass} text-right text-emerald-600 dark:text-emerald-400 font-semibold`}>
                  {formatMoney(r.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50">
            <tr>
              <td className={tfootTdClass}>Grand Total</td>
              <td className={`${tfootTdClass} text-right`}>
                {rows.reduce((s, r) => s + r.count, 0)}
              </td>
              <td className={`${tfootTdClass} text-right text-emerald-600 dark:text-emerald-400`}>
                {formatMoney(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </TableWrapper>
    </>
  );
}
