export type TeacherDutyAssignmentStatus =
  | "active"
  | "upcoming"
  | "completed"
  | "revoked";

export interface TeacherDutyAssignment {
  id: string;
  schoolId: string;
  teacherId: string;
  teacherName: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  notes: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: TeacherDutyAssignmentStatus;
  remainingDays: number | null;
}

export interface ActiveDutyTeacher {
  teacherId: string;
  fullName: string;
  endDate: string;
}

export interface TeacherDutyContext {
  isOnDuty: boolean;
  assignment: {
    startDate: string;
    endDate: string;
  } | null;
}
