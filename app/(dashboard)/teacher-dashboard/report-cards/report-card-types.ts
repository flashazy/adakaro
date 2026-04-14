export type ReportCardStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "changes_requested";

export interface TeacherClassOption {
  classId: string;
  className: string;
  academicYears: string[];
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
