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
    averagePct: string;
    grade: string;
    comment: string;
  }[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    daysInTermLabel: string;
  };
}
