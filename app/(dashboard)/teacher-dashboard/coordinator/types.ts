import type { GradebookMajorExamTypeValue } from "@/lib/gradebook-major-exams";
import type { ReportCardPreviewData } from "../report-cards/report-card-preview-types";
import type { ReportCardStatus } from "../report-cards/report-card-types";
import type { SchoolLevel } from "@/lib/school-level";

/**
 * Shared coordinator-dashboard types and client-safe constants.
 *
 * This module MUST remain free of any `server-only` or admin-client imports so
 * the client component (`coordinator-client.tsx`) can reuse these definitions
 * without accidentally pulling server code into the browser bundle. All data
 * loading lives in `data.ts` which imports these types.
 */

export const MAJOR_EXAM_LABELS: Record<GradebookMajorExamTypeValue, string> = {
  April_Midterm: "April Midterm",
  June_Terminal: "June Terminal",
  September_Midterm: "September Midterm",
  December_Annual: "December Annual",
};

export type MajorExamStatus =
  | { state: "missing" }
  | {
      state: "created";
      studentsScored: number;
      rosterSize: number;
    };

export interface CoordinatorSubjectOverview {
  subjectId: string | null;
  name: string;
  /** Status per major exam, keyed by exam type. */
  examStatus: Record<GradebookMajorExamTypeValue, MajorExamStatus>;
}

export interface CoordinatorReportCardItem {
  reportCardId: string;
  studentId: string;
  studentName: string;
  parentEmail: string | null;
  /** Admission / candidate number (CNO on NECTA-style secondary sheet). */
  admissionNumber: string | null;
  /** Student sex for NECTA-style summary rows (F / M). */
  gender: "male" | "female" | null;
  status: ReportCardStatus;
  /** Preview data (pre-built) ready for client-side PDF download. */
  preview: ReportCardPreviewData;
}

export interface CoordinatorClassOverview {
  classId: string;
  className: string;
  schoolId: string;
  schoolName: string;
  /** School motto from settings (PDFs only when set). */
  schoolMotto?: string | null;
  schoolLogoUrl: string | null;
  /** Drives report-card ranking maths (primary = avg %, secondary = best 7). */
  schoolLevel: SchoolLevel;
  academicYear: string;
  studentCount: number;
  subjects: CoordinatorSubjectOverview[];
  reportCards: CoordinatorReportCardItem[];
}

export interface CoordinatorOverview {
  teacherName: string;
  classes: CoordinatorClassOverview[];
}
