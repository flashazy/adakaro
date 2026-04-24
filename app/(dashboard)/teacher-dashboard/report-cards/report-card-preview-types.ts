export interface ReportCardPreviewData {
  schoolName: string;
  /** School motto / tagline from settings; shown on PDFs when non-empty. */
  schoolMotto?: string | null;
  logoUrl: string | null;
  /** Public URL of official school stamp; shown near signatures when set. */
  schoolStampUrl: string | null;
  studentName: string;
  className: string;
  term: string;
  academicYear: string;
  teacherName: string;
  /**
   * True when the teacher whose name appears on the card holds the
   * Coordinator role for this class (i.e. has a row in `teacher_coordinators`
   * for the class). Drives the "Class Coordinator" vs. "Class teacher" label
   * in the preview and PDF. Defaults to `false` for plain class teachers.
   */
  teacherIsCoordinator: boolean;
  dateIssued: string;
  statusLabel: string;
  subjects: {
    subject: string;
    exam1Pct: string;
    exam2Pct: string;
    /**
     * Raw percentage (0–100) for each exam plus the term average. Optional so
     * older callers/snapshots stay compatible. Used by the on-screen "Show
     * scores as" toggle to re-render the same value as a percentage, marks
     * fraction (e.g. 41/50), or both. The persisted strings in `exam1Pct`,
     * `exam2Pct`, and `averagePct` remain the canonical fallback.
     */
    exam1PercentRaw?: number | null;
    exam2PercentRaw?: number | null;
    averagePercentRaw?: number | null;
    /** True when the saved score was edited after using the gradebook value. */
    exam1Overridden: boolean;
    exam2Overridden: boolean;
    averagePct: string;
    grade: string;
    /** Class rank by term average for this subject (ties share rank; "—" if no average). */
    position: string;
    comment: string;
    /**
     * Whether at least one major-exam score exists on the row from the
     * gradebook (April Midterm / June Terminal or term equivalents) **before**
     * the legacy `scorePercent`-only fallback. Used by NECTA PDF so subjects
     * with no `teacher_scores` entries show `'X'` instead of a derived grade.
     */
    hasMajorExamScore?: boolean;
    /**
     * Whether this subject contributes to the student's total score.
     * - `true`  → counted (one of the best 7 in secondary mode)
     * - `false` → dropped (extra subject beyond the best 7)
     * - `null`  → no indicator should be rendered (primary schools, or
     *            secondary students with ≤7 subjects where every subject counts)
     */
    selected: boolean | null;
  }[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    daysInTermLabel: string;
  };
  /**
   * Optional summary sentence printed below subject results. Shape is decided
   * by the school's level: primary schools surface average %, secondary
   * schools surface total marks of the best 7 subjects.
   */
  summary?: ReportCardSummary | null;
  /**
   * Shown after subject results when a coordinator saved dates for this
   * class/term/year. Omitted when there is no settings row.
   */
  schoolCalendar?: ReportCardSchoolCalendarSection | null;
  /**
   * Aggregated from `student_fee_balances` for this student and report period.
   * Omitted when no matching fee rows exist.
   */
  feeStatement?: ReportCardFeeStatementSection | null;
  /** Non-empty message from class report settings; line breaks preserved. */
  coordinatorMessage?: string | null;
  /** Non-empty list from class report settings. */
  requiredNextTermItems?: string[] | null;
}

/** Saved class report settings for this card's term (dates may be null → TBA). */
export interface ReportCardSchoolCalendarSection {
  closingDateLabel: string;
  openingDateLabel: string;
}

/** Mirrors `student_fee_balances` totals for the report period (no new maths). */
export interface ReportCardFeeStatementSection {
  currencyCode: string;
  totalFees: number;
  amountPaid: number;
  balanceDue: number;
}

/** Calendar, fees, coordinator note, and next-term list shown below subject results. */
export type ReportCardSupplementaryPreviewSlice = Pick<
  ReportCardPreviewData,
  | "schoolCalendar"
  | "feeStatement"
  | "coordinatorMessage"
  | "requiredNextTermItems"
>;

export interface ReportCardSummary {
  /** "primary" or "secondary"; controls phrasing in the footer line. */
  schoolLevel: "primary" | "secondary";
  /** 1-based class rank for the focus student (null if no comparable score). */
  rank: number | null;
  /** Number of cohort students with a comparable score (rank denominator). */
  totalStudents: number;
  /** Sum of best-7 subject averages (secondary only). */
  totalScore: number | null;
  /**
   * Legacy: mean of all subject averages as a percent (primary only).
   * No longer populated — both school levels now expose `totalScore` instead.
   * Kept on the type so older call sites continue to compile.
   */
  averagePercent: number | null;
  /** Pre-formatted footer sentence (or null when nothing to render). */
  sentence: string | null;
  /**
   * Subject names that contributed to the summary score for the focus
   * student. `null` when no per-subject indicator should be shown — i.e.
   * primary schools, or secondary students whose subject count is already
   * ≤ the best-N cap so nothing was dropped.
   */
  selectedSubjects: string[] | null;
  /**
   * Tanzanian Secondary School Division calculated from the best-7 subject
   * grade points (A=1, B=2, C=3, D=4, F=5). `null` for primary schools and
   * for secondary students with no scored subjects.
   */
  division: ReportCardDivision | null;
}

/**
 * Tanzanian secondary school Division summary derived from a student's best-7
 * grade points. `label` is the human-readable Roman numeral / "0" tag printed
 * on the report card footer.
 */
export interface ReportCardDivision {
  totalPoints: number;
  /** "I", "II", "III", "IV" or "0". */
  label: string;
}
