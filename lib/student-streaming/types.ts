import type { GradebookMajorExamTypeValue } from "@/lib/gradebook-major-exams";

export const STREAMING_PERFORMANCE_MEASURES = [
  "average_score",
  "division",
  "total_marks",
] as const;

export type StreamingPerformanceMeasure =
  (typeof STREAMING_PERFORMANCE_MEASURES)[number];

export const STREAMING_PERFORMANCE_MEASURE_LABELS: Record<
  StreamingPerformanceMeasure,
  string
> = {
  average_score: "Average Score (%)",
  division: "Division",
  total_marks: "Total Marks",
};

export interface StreamingParentClassOption {
  id: string;
  name: string;
  schoolId: string;
  streamClasses: { id: string; name: string }[];
}

export interface StreamingExamOption {
  examType: GradebookMajorExamTypeValue;
  label: string;
  studentsWithResults: number;
}

export interface NumericStreamingRule {
  targetClassId: string;
  min: number;
  max: number;
}

export interface DivisionStreamingRule {
  targetClassId: string;
  divisions: string[];
}

export type StreamingRuleEntry = NumericStreamingRule | DivisionStreamingRule;

export interface StudentStreamingPerformance {
  averageScorePercent: number | null;
  totalMarks: number | null;
  division: string | null;
  divisionPoints: number | null;
  subjectsScored: number;
}

export interface StreamingStudentRow {
  id: string;
  fullName: string;
  admissionNumber: string | null;
  currentClassId: string;
  currentClassName: string;
  performance: StudentStreamingPerformance;
  recommendedClassId: string | null;
  recommendedClassName: string | null;
  performanceDisplay: string | null;
}

export interface StreamingOverviewStats {
  totalEligible: number;
  alreadyStreamed: number;
  awaitingPlacement: number;
  availableStreams: number;
  lastStreamingActivityAt: string | null;
}

export interface StreamingPlacementPreview {
  targetClassId: string;
  targetClassName: string;
  studentCount: number;
}

export interface StreamingHistoryRow {
  id: string;
  studentName: string;
  admissionNumber: string | null;
  previousClassName: string;
  newClassName: string;
  performanceMeasure: StreamingPerformanceMeasure;
  performanceValue: string;
  examLabel: string;
  academicYear: string;
  coordinatorName: string;
  createdAt: string;
  parentClassName: string;
}
