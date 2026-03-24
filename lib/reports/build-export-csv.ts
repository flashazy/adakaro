/**
 * Server-side CSV for reports export (plan-gated). Mirrors dashboard reports aggregations.
 */

export interface BalanceRow {
  student_id: string;
  student_name: string;
  fee_structure_id: string;
  fee_name: string;
  total_fee: number;
  total_paid: number;
  balance: number;
  due_date: string | null;
}

export interface PaymentRow {
  id: string;
  student_id: string;
  amount: number;
  payment_method: string | null;
  payment_date: string;
  reference_number: string | null;
}

export interface ClassRow {
  id: string;
  name: string;
}

export interface StudentClassRow {
  id: string;
  class_id: string;
}

export type ReportExportTab =
  | "student-fees"
  | "class-summary"
  | "outstanding"
  | "monthly-income";

function escapeCell(v: string): string {
  return v.includes(",") || v.includes('"') || v.includes("\n")
    ? `"${v.replace(/"/g, '""')}"`
    : v;
}

function toCsv(headers: string[], rows: string[][]): string {
  return [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\n");
}

export function buildReportsExportCsv(
  tab: ReportExportTab,
  balances: BalanceRow[],
  payments: PaymentRow[],
  classes: ClassRow[],
  studentClasses: StudentClassRow[],
  dateFrom: string,
  dateTo: string
): { filename: string; csv: string } {
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const studentClassMap = new Map(studentClasses.map((sc) => [sc.id, sc.class_id]));

  const studentFeeRows: {
    studentName: string;
    className: string;
    totalFee: number;
    totalPaid: number;
    balance: number;
  }[] = [];

  const feeMap = new Map<
    string,
    {
      studentName: string;
      className: string;
      totalFee: number;
      totalPaid: number;
      balance: number;
    }
  >();

  balances.forEach((b) => {
    const existing = feeMap.get(b.student_id);
    if (existing) {
      existing.totalFee += Number(b.total_fee);
      existing.totalPaid += Number(b.total_paid);
      existing.balance += Number(b.balance);
    } else {
      const cid = studentClassMap.get(b.student_id) ?? "";
      feeMap.set(b.student_id, {
        studentName: b.student_name,
        className: classMap.get(cid) ?? "—",
        totalFee: Number(b.total_fee),
        totalPaid: Number(b.total_paid),
        balance: Number(b.balance),
      });
    }
  });
  feeMap.forEach((v) => studentFeeRows.push(v));
  studentFeeRows.sort((a, b) => a.studentName.localeCompare(b.studentName));

  const classSummaryRows: {
    className: string;
    studentCount: number;
    totalFee: number;
    totalPaid: number;
    outstanding: number;
  }[] = [];

  const csMap = new Map<
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
    const existing = csMap.get(cid);
    if (existing) {
      existing.totalFee += Number(b.total_fee);
      existing.totalPaid += Number(b.total_paid);
      existing.outstanding += Math.max(0, Number(b.balance));
      studentsPerClass.get(cid)!.add(b.student_id);
    } else {
      csMap.set(cid, {
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
    const row = csMap.get(classId);
    if (row) row.studentCount = students.size;
  });
  csMap.forEach((v) => classSummaryRows.push(v));
  classSummaryRows.sort((a, b) => a.className.localeCompare(b.className));

  const outstandingRows = studentFeeRows.filter((r) => r.balance > 0);

  const filteredPayments = payments.filter((p) => {
    if (dateFrom && p.payment_date < dateFrom) return false;
    if (dateTo && p.payment_date > dateTo) return false;
    return true;
  });

  const monthlyMap = new Map<string, { month: string; total: number; count: number }>();
  filteredPayments.forEach((p) => {
    const month = p.payment_date.substring(0, 7);
    const existing = monthlyMap.get(month);
    if (existing) {
      existing.total += Number(p.amount);
      existing.count += 1;
    } else {
      monthlyMap.set(month, { month, total: Number(p.amount), count: 1 });
    }
  });
  const monthlyIncomeRows = Array.from(monthlyMap.values()).sort((a, b) =>
    b.month.localeCompare(a.month)
  );

  const now = new Date().toISOString().split("T")[0];

  switch (tab) {
    case "student-fees":
      return {
        filename: `student-fee-report-${now}.csv`,
        csv: toCsv(
          ["Student", "Class", "Total Fees", "Paid", "Balance"],
          studentFeeRows.map((r) => [
            r.studentName,
            r.className,
            String(r.totalFee),
            String(r.totalPaid),
            String(r.balance),
          ])
        ),
      };
    case "class-summary":
      return {
        filename: `class-payment-summary-${now}.csv`,
        csv: toCsv(
          ["Class", "Students", "Total Fees", "Collected", "Outstanding"],
          classSummaryRows.map((r) => [
            r.className,
            String(r.studentCount),
            String(r.totalFee),
            String(r.totalPaid),
            String(r.outstanding),
          ])
        ),
      };
    case "outstanding":
      return {
        filename: `outstanding-balances-${now}.csv`,
        csv: toCsv(
          ["Student", "Class", "Total Fees", "Paid", "Balance"],
          outstandingRows.map((r) => [
            r.studentName,
            r.className,
            String(r.totalFee),
            String(r.totalPaid),
            String(r.balance),
          ])
        ),
      };
    case "monthly-income":
      return {
        filename: `monthly-income-${now}.csv`,
        csv: toCsv(
          ["Month", "Transactions", "Total Income"],
          monthlyIncomeRows.map((r) => [r.month, String(r.count), String(r.total)])
        ),
      };
    default:
      return { filename: `report-${now}.csv`, csv: "" };
  }
}
