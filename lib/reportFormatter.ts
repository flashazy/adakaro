/**
 * Parent-facing copy for report card sections built from raw coordinator inputs.
 * Coordinators still enter plain dates, text, and list items elsewhere — only
 * the rendered report applies this wording.
 */

import { formatCurrency } from "@/lib/currency";
import type { SchoolLevel } from "@/lib/school-level";

/** Matches the label used when a term date is not set in class report settings. */
export const REPORT_SCHOOL_DATE_TBA = "Dates to be announced";

function isDateTba(label: string | null | undefined): boolean {
  const t = (label ?? "").trim();
  return t.length === 0 || t === REPORT_SCHOOL_DATE_TBA;
}

/** True when the label is a real calendar value (not blank, not the shared TBA phrase). */
function hasRealDate(label: string | null | undefined): boolean {
  return !isDateTba(label);
}

/**
 * Turns closing/opening labels (already human-readable dates, or TBA) into
 * a warm, parent-facing paragraph.
 */
export function formatDateRange(closingDate: string, openingDate: string): string {
  const hasClosing = hasRealDate(closingDate);
  const hasOpening = hasRealDate(openingDate);

  if (!hasClosing && !hasOpening) {
    return "School calendar dates will be communicated soon. Please stay in touch with the school for further updates.";
  }

  if (hasClosing && hasOpening) {
    return `The school will close on ${closingDate.trim()} and reopen on ${openingDate.trim()}.
We kindly encourage parents to ensure students return on time, ready to continue with their studies.`;
  }

  if (hasClosing) {
    return (
      `The school will close on ${closingDate.trim()}. ` +
      "The reopening date will be communicated in due course."
    );
  }

  return (
    `The school will reopen on ${openingDate.trim()}. ` +
    "We look forward to welcoming students back for the new term."
  );
}

/**
 * Wraps the coordinator’s own words in a softer, natural tone.
 * Preserves internal line breaks from the original message.
 */
export function formatCoordinatorMessage(message: string): string {
  if (!message || !message.trim()) return "";

  const cleaned = message.trim().replace(/\.+$/, "");
  const normalized = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  const closing =
    /[.!?]$/.test(normalized.trimEnd()) ? "" : ".";

  return `Kindly note that ${normalized}${closing}
We appreciate your cooperation in supporting your child's progress and helping them meet school expectations.`;
}

function titleCaseItem(item: string): string {
  const t = item.trim();
  if (!t) return "";
  return t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Presents required items with a supportive intro and bullet list (•) for preview/HTML.
 */
export function formatItems(items: string[]): string {
  const validItems = (items || [])
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => titleCaseItem(item));

  if (validItems.length === 0) return "";

  return `As we prepare for the upcoming term, please ensure your child comes with the following items:

${validItems.map((item) => `• ${item}`).join("\n")}

Providing these items will help your child settle in well and participate fully in school activities.`;
}

/**
 * Same wording as {@link formatItems}, with ASCII hyphens instead of bullets so
 * jsPDF’s default Helvetica renders list markers reliably.
 */
export function formatItemsForPdf(items: string[]): string {
  const s = formatItems(items);
  if (!s) return "";
  return s.replace(/\u2022 /g, "- ");
}

/** Direct, respectful fee reminder — amount comes from existing fee totals. */
export function formatFeeBalanceReminder(
  balanceDue: number,
  currencyCode: string
): string {
  const amt = formatCurrency(balanceDue, currencyCode);
  return `Kindly arrange to clear the outstanding balance of ${amt} before or on the reopening day.`;
}

function ordinalRankWord(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(Math.trunc(n));
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (abs % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export type AcademicReportSummaryInput = {
  studentName: string;
  term: string;
  academicYear: string;
  schoolLevel: SchoolLevel;
  rank: number;
  totalStudents: number;
  totalScore: number;
  division: { label: string; totalPoints: number } | null;
  /**
   * When false, the student has no computable subject averages for the total
   * (same signal as a null aggregate score before the legacy 0 fallback).
   */
  hasScoredSubjects: boolean;
};

/**
 * Natural school-report wording from rank, totals, and division — facts only,
 * tone adapts to placement; no grading maths here.
 */
export function formatAcademicReportSummary(
  input: AcademicReportSummaryInput
): string | null {
  const {
    studentName,
    term,
    academicYear,
    schoolLevel,
    rank,
    totalStudents,
    totalScore,
    division,
    hasScoredSubjects,
  } = input;

  const name = (studentName ?? "").trim() || "This student";
  const termText = (term ?? "").trim();
  const yr = (academicYear ?? "").trim();
  const examPhrase = [termText, yr].filter(Boolean).join(" ");

  if (rank == null || totalStudents <= 0) return null;

  if (!hasScoredSubjects) {
    return `${name} does not yet have sufficient recorded marks for a complete academic summary.`;
  }

  const ord = ordinalRankWord(rank);

  let divisionSentence = "";
  if (schoolLevel === "secondary" && division) {
    const pt =
      division.totalPoints === 1 ? "1 point" : `${division.totalPoints} points`;
    divisionSentence = ` The student was placed in Division ${division.label} with ${pt}.`;
  }

  if (totalStudents === 1) {
    return `${name} completed the ${examPhrase} examinations with a total of ${totalScore} marks.${divisionSentence}`.trimEnd();
  }

  if (totalScore === 0) {
    return (
      `${name} completed the ${examPhrase} assessments with a recorded total of 0 marks.` +
      ` Further academic follow-up may be needed to support progress.${divisionSentence}`
    ).trimEnd();
  }

  const isFirst = rank === 1;
  const topQuarter = rank <= Math.max(1, Math.ceil(totalStudents / 4));
  const isLast = rank === totalStudents && totalStudents > 1;

  if (isFirst) {
    return (
      `${name} performed very well in the ${examPhrase} examinations, securing ${ord} position out of ${totalStudents} students with a total of ${totalScore} marks.` +
      divisionSentence
    ).trimEnd();
  }

  if (topQuarter) {
    return (
      `${name} showed strong academic performance in the ${examPhrase} examinations, securing ${ord} position out of ${totalStudents} students with a total of ${totalScore} marks.` +
      divisionSentence
    ).trimEnd();
  }

  const neutral =
    `${name} completed the ${examPhrase} examinations with a total of ${totalScore} marks and was placed ${ord} out of ${totalStudents} students.`;

  if (isLast) {
    return (neutral + " There is room for improvement in the coming term." + divisionSentence).trimEnd();
  }

  return (neutral + divisionSentence).trimEnd();
}

/**
 * Report-card attendance: human sentence from days present (incl. late) and
 * days absent. Returns `null` when there is no meaningful data (e.g. both
 * zero or non-numeric) so the section can be hidden.
 */
export function formatAttendance(
  presentDays?: number,
  absentDays?: number
): string | null {
  const hasPresent =
    typeof presentDays === "number" && Number.isFinite(presentDays) && presentDays > 0;
  const hasAbsent =
    typeof absentDays === "number" && Number.isFinite(absentDays) && absentDays > 0;

  if (!hasPresent && !hasAbsent) {
    return null;
  }

  if (hasPresent && hasAbsent) {
    return `The student attended ${presentDays} school days and was absent for ${absentDays} days during the term.`;
  }
  if (hasPresent) {
    return `The student attended ${presentDays} school days during the term.`;
  }
  return `The student was absent for ${absentDays} days during the term.`;
}
