export type ReportCardStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "changes_requested";

export interface TeacherClassOption {
  classId: string;
  className: string;
  academicYears: string[];
  /**
   * True when the current teacher holds the Coordinator role for this class
   * (has a row in `teacher_coordinators`). Used to swap the report card label
   * from "Class teacher" to "Class Coordinator".
   */
  isCoordinator: boolean;
}

/** Teacher-assigned subjects for report-card filters (class + academic year). */
export interface ReportCardSubjectFilterOption {
  id: string;
  name: string;
}

export interface ReportCardCommentRow {
  id: string;
  subject: string;
  comment: string | null;
  scorePercent: number | null;
  letterGrade: string | null;
  exam1Score: number | null;
  exam2Score: number | null;
  calculatedScore: number | null;
  calculatedGrade: string | null;
  /** Gradebook % stored when teacher overrides exam1 after autofill. */
  exam1GradebookOriginal: number | null;
  exam2GradebookOriginal: number | null;
  exam1ScoreOverridden: boolean;
  exam2ScoreOverridden: boolean;
  /**
   * Class rank for this subject (1 = highest term average). Persisted by
   * the coordinator's `Generate Report Cards` flow so the preview can show
   * a position even when the live class-wide ranking has no data to work with.
   */
  position: number | null;
}

export interface StudentReportRow {
  studentId: string;
  fullName: string;
  parentEmail: string | null;
  reportCardId: string | null;
  status: ReportCardStatus | null;
  comments: ReportCardCommentRow[];
}

export interface PendingReportCardRow {
  id: string;
  studentName: string;
  className: string;
  term: string;
  academicYear: string;
  submittedAt: string | null;
}
