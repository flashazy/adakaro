export type SubjectCompatibilityStatus = "allowed" | "warning" | "blocked";

export type SubjectCompatibilityBlockReason =
  | "no_compatible_subjects"
  | "secondary_minimum_subjects";

export interface SubjectCompatibilityMove {
  studentId: string;
  targetClassId: string;
}

export interface SubjectCompatibilityStudentResult {
  studentId: string;
  studentName: string;
  targetClassId: string;
  targetClassName: string;
  status: SubjectCompatibilityStatus;
  blockReason?: SubjectCompatibilityBlockReason;
  currentSubjectCount: number;
  finalSubjectCount: number;
  compatibleSubjectNames: string[];
  missingSubjectNames: string[];
}

export interface SubjectCompatibilityBatchResult {
  status: SubjectCompatibilityStatus;
  students: SubjectCompatibilityStudentResult[];
}

export const SUBJECT_COMPATIBILITY_AUDIT_NOTE =
  "Student moved with subject compatibility warning.";

export function isSecondaryMinimumBlock(
  reason: SubjectCompatibilityBlockReason | undefined
): boolean {
  return reason === "secondary_minimum_subjects";
}
