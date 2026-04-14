export interface ReportCardPreviewData {
  schoolName: string;
  logoUrl: string | null;
  studentName: string;
  className: string;
  term: string;
  academicYear: string;
  teacherName: string;
  dateIssued: string;
  statusLabel: string;
  subjects: {
    subject: string;
    exam1Pct: string;
    exam2Pct: string;
    /** True when the saved score was edited after using the gradebook value. */
    exam1Overridden: boolean;
    exam2Overridden: boolean;
    averagePct: string;
    grade: string;
    /** Class rank by term average for this subject (ties share rank; "—" if no average). */
    position: string;
    comment: string;
  }[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    daysInTermLabel: string;
  };
}
