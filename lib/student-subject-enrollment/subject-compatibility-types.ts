export type SubjectCompatibilityStatus = "allowed" | "warning" | "blocked";

export interface SubjectCompatibilityMove {
  studentId: string;
  targetClassId: string;
}

export interface SubjectCompatibilityStudentResult {
  studentId: string;
  studentName: string;
  targetClassId: string;
  status: SubjectCompatibilityStatus;
  compatibleSubjectNames: string[];
  missingSubjectNames: string[];
}

export interface SubjectCompatibilityBatchResult {
  status: SubjectCompatibilityStatus;
  students: SubjectCompatibilityStudentResult[];
}

export const SUBJECT_COMPATIBILITY_AUDIT_NOTE =
  "Student moved with subject compatibility warning.";
