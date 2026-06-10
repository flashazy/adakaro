export type SyllabusSubtopicStatus =
  | "not_started"
  | "in_progress"
  | "completed";

export interface SyllabusClassOption {
  id: string;
  name: string;
  schoolId: string;
}

export interface SyllabusSubjectOption {
  subjectId: string | null;
  name: string;
}

export interface SyllabusSubtopicRow {
  id: string;
  topicId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  status: SyllabusSubtopicStatus;
  completedAt: string | null;
  updatedAt: string | null;
  note: string | null;
  noteUpdatedAt: string | null;
}

export interface SyllabusTopicRow {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  subtopics: SyllabusSubtopicRow[];
  completedSubtopics: number;
  totalSubtopics: number;
  coveragePercent: number;
  isTopicComplete: boolean;
}

export interface SyllabusCoverageSummary {
  totalTopics: number;
  totalSubtopics: number;
  completedSubtopics: number;
  coveragePercent: number;
}

export interface SyllabusCoverageOverviewRow {
  classId: string;
  className: string;
  subjectId: string | null;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  totalSubtopics: number;
  completedSubtopics: number;
  coveragePercent: number;
}

export interface TeacherSyllabusAssignment {
  assignmentId: string;
  classId: string;
  className: string;
  subjectId: string | null;
  subjectName: string;
  academicYear: string;
  schoolId: string;
}
