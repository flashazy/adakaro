export type StudentClassHistorySource = "streaming" | "promotion" | "admin_edit";

export interface RecordStudentClassMoveInput {
  schoolId: string;
  studentId: string;
  fromClassId: string | null;
  toClassId: string;
  source: StudentClassHistorySource;
  sourceId?: string | null;
  actorId?: string | null;
  academicYear?: string | null;
  effectiveAt?: string;
  notes?: string | null;
}
