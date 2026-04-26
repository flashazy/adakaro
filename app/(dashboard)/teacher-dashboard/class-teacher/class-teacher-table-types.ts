/** Row shapes for class-teacher dashboard tables (shared server + client). */

export type ClassTeacherStudentParentRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string | null;
  /** Semicolon-separated when multiple guardians are linked. */
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
};

export type ClassTeacherAttendanceRow = {
  id: string;
  attendanceDate: string;
  status: string;
  subjectName: string;
  studentName: string;
  recordedByName: string | null;
};

export type ClassTeacherGradeRow = {
  studentName: string;
  subject: string;
  assignmentTitle: string;
  maxScore: number;
  score: string | null;
  teacherName: string | null;
};
