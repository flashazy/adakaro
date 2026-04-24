import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  reportAcademicYearToEnrollmentYear,
} from "@/lib/student-subject-enrollment-queries";
import type {
  ReportCardFeeStatementSection,
  ReportCardSchoolCalendarSection,
  ReportCardSupplementaryPreviewSlice,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-types";
import {
  normalizeSchoolCurrency,
  type SchoolCurrencyCode,
} from "@/lib/currency";
import { REPORT_SCHOOL_DATE_TBA } from "@/lib/reportFormatter";

type Admin = SupabaseClient<Database>;
type FeeBalanceRow = Database["public"]["Views"]["student_fee_balances"]["Row"];

/**
 * Fee structures use `fee_structures.term` as calendar year (e.g. "2025") or
 * occasionally the same labels as report cards ("Term 1"). Match either the
 * report term label or the enrolment year implied by the report academic year
 * string — no new calculations beyond filtering the existing view rows.
 */
export function feeBalanceRowMatchesReportPeriod(
  feeStructureTerm: string | null | undefined,
  reportTerm: string,
  reportAcademicYear: string
): boolean {
  const ft = (feeStructureTerm ?? "").trim();
  if (!ft) return false;
  const rt = reportTerm.trim();
  if (ft === rt) return true;
  const reportYear = reportAcademicYearToEnrollmentYear(reportAcademicYear);
  if (ft === String(reportYear)) return true;
  const m = ft.match(/\d{4}/);
  if (m && parseInt(m[0], 10) === reportYear) return true;
  return false;
}

function formatLongDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(d);
}

function calendarSectionFromSettingsRow(
  row: Database["public"]["Tables"]["class_report_settings"]["Row"] | null
): ReportCardSchoolCalendarSection | null {
  if (!row) return null;
  const closing = formatLongDate(row.closing_date);
  const opening = formatLongDate(row.opening_date);
  return {
    closingDateLabel: closing ?? REPORT_SCHOOL_DATE_TBA,
    openingDateLabel: opening ?? REPORT_SCHOOL_DATE_TBA,
  };
}

function messageFromSettings(
  row: Database["public"]["Tables"]["class_report_settings"]["Row"] | null
): string | null {
  const t = (row?.coordinator_message ?? "").trim();
  if (!t) return null;
  return t.length > 500 ? t.slice(0, 500) : t;
}

function itemsFromSettings(
  row: Database["public"]["Tables"]["class_report_settings"]["Row"] | null
): string[] | null {
  const raw = row?.required_items;
  if (!raw || !Array.isArray(raw)) return null;
  const cleaned = raw
    .map((s) => String(s ?? "").trim())
    .filter((s) => s.length > 0);
  return cleaned.length > 0 ? cleaned : null;
}

export function feeStatementForStudent(
  balanceRows: FeeBalanceRow[],
  studentId: string,
  reportTerm: string,
  reportAcademicYear: string,
  currencyCode: SchoolCurrencyCode
): ReportCardFeeStatementSection | null {
  const matching = balanceRows.filter(
    (r) =>
      r.student_id === studentId &&
      feeBalanceRowMatchesReportPeriod(r.term, reportTerm, reportAcademicYear)
  );
  if (matching.length === 0) return null;
  let totalFees = 0;
  let amountPaid = 0;
  let balanceDue = 0;
  for (const r of matching) {
    totalFees += Number(r.total_fee);
    amountPaid += Number(r.total_paid);
    balanceDue += Number(r.balance);
  }
  return {
    currencyCode,
    totalFees,
    amountPaid,
    balanceDue,
  };
}

export type ReportCardSupplementarySlice = {
  schoolCalendar: ReportCardSchoolCalendarSection | null;
  feeStatement: ReportCardFeeStatementSection | null;
  coordinatorMessage: string | null;
  requiredNextTermItems: string[] | null;
};

/**
 * Loads class-level settings plus optional per-student fee aggregates for report cards.
 */
export async function loadReportCardSupplementaryBatch(
  admin: Admin,
  params: {
    settingsClassId: string;
    schoolId: string;
    term: string;
    academicYear: string;
    studentIds: string[];
  }
): Promise<{
  shared: Omit<
    ReportCardSupplementarySlice,
    "feeStatement"
  >;
  feeByStudentId: Map<string, ReportCardFeeStatementSection | null>;
  currencyCode: SchoolCurrencyCode;
}> {
  const term = params.term.trim();
  const yearInt = reportAcademicYearToEnrollmentYear(params.academicYear);

  const [{ data: schoolRow }, { data: settingsRow }] = await Promise.all([
    admin
      .from("schools")
      .select("currency")
      .eq("id", params.schoolId)
      .maybeSingle(),
    admin
      .from("class_report_settings")
      .select("*")
      .eq("class_id", params.settingsClassId)
      .eq("term", term)
      .eq("academic_year", yearInt)
      .maybeSingle(),
  ]);

  const currencyCode = normalizeSchoolCurrency(
    (schoolRow as { currency?: string | null } | null)?.currency
  );

  const settings = settingsRow as
    | Database["public"]["Tables"]["class_report_settings"]["Row"]
    | null;

  const shared = {
    schoolCalendar: calendarSectionFromSettingsRow(settings),
    coordinatorMessage: messageFromSettings(settings),
    requiredNextTermItems: itemsFromSettings(settings),
  };

  const feeByStudentId = new Map<string, ReportCardFeeStatementSection | null>();
  const ids = [...new Set(params.studentIds)].filter(Boolean);
  if (ids.length === 0) {
    return { shared, feeByStudentId, currencyCode };
  }

  const { data: balRaw } = await admin
    .from("student_fee_balances")
    .select("student_id, term, total_fee, total_paid, balance")
    .in("student_id", ids);

  const balRows = (balRaw ?? []) as FeeBalanceRow[];

  for (const sid of ids) {
    feeByStudentId.set(
      sid,
      feeStatementForStudent(
        balRows,
        sid,
        term,
        params.academicYear,
        currencyCode
      )
    );
  }

  return { shared, feeByStudentId, currencyCode };
}

export function mergeSupplementaryForPreview(
  shared: Omit<ReportCardSupplementarySlice, "feeStatement">,
  feeStatement: ReportCardFeeStatementSection | null
): ReportCardSupplementaryPreviewSlice {
  return {
    schoolCalendar: shared.schoolCalendar,
    feeStatement,
    coordinatorMessage: shared.coordinatorMessage,
    requiredNextTermItems: shared.requiredNextTermItems,
  };
}
