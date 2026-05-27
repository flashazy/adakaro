export const PROMOTION_DECISIONS = ["promote", "repeat", "graduate"] as const;

export type PromotionDecision = (typeof PROMOTION_DECISIONS)[number];

export interface PromotionTrackRow {
  id: string;
  track_name: string;
}

export interface PromotionClassRow {
  id: string;
  name: string;
  track_id: string | null;
  track_name: string | null;
  progression_order: number | null;
  student_count: number;
  next_class_id: string | null;
  next_class_name: string | null;
}

export interface PromotionStudentRow {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_id: string;
}

export interface PromotionStudentWithGrades {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_id: string;
  /** Overall average (%) calculated from Term 2 report cards. */
  term2AveragePercent: number | null;
  /**
   * Whether a Term 2 report card row exists for this student (regardless
   * of approval status).
   */
  hasTerm2ReportCard: boolean;
  /**
   * Term 2 report card status bucket for the promotion modal.
   * - not_generated: no report_cards row exists
   * - pending_approval: generated but not yet approved
   * - approved: status = 'approved'
   */
  term2ReportCardStatus: "not_generated" | "pending_approval" | "approved";
  /**
   * Whether "Promote" is allowed for this student.
   * Only allowed when the Term 2 report card exists and is approved.
   */
  canPromote: boolean;
  /**
   * Suggested decision based on Term 2 average vs school minimum grade.
   * Only computed when `canPromote` is true and min grade exists.
   */
  suggestedDecision: PromotionDecision | null;
}

export interface LoadClassPromotionStudentsResult {
  students: PromotionStudentWithGrades[];
  nextClassName: string | null;
  rulesMode: "manual" | "auto";
  minAverageGrade: number | null;
  ruleSource: "school_default" | "class_override" | null;
}

export interface ApplyPromotionEntry {
  studentId: string;
  decision: PromotionDecision;
}

export interface ApplyPromotionResult {
  ok: true;
  promoted: number;
  repeated: number;
  graduated: number;
  message: string;
}
