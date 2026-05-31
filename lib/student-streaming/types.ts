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

export interface StreamingStreamClass {
  id: string;
  name: string;
  /** Parsed from class description when configured (e.g. "Capacity: 20"). */
  capacity: number | null;
}

export interface StreamingParentClassOption {
  id: string;
  name: string;
  schoolId: string;
  streamClasses: StreamingStreamClass[];
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
  /** @deprecated Use parentClassName + currentStreamName */
  currentClassName: string;
  parentClassName: string;
  currentStreamName: string;
  performance: StudentStreamingPerformance;
  recommendedClassId: string | null;
  recommendedClassName: string | null;
  /** Latest confirmed placement target for this exam when it matches current class. */
  appliedPlacementClassId: string | null;
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
  /** Students with this stream as placement target. */
  studentCount: number;
  currentOccupancy: number;
  incomingCount: number;
  leavingCount: number;
  /** Students already in this stream with matching placement target. */
  stayingCount: number;
  /** Projected headcount after placements. */
  finalTotal: number;
  /** After Placement - Current (equals incomingCount - leavingCount). */
  netChange: number;
  capacity: number | null;
  isOverCapacity: boolean;
}

export type StreamingPlacementStatus =
  | "placed"
  | "needs_transfer"
  | "unassigned"
  | "manual_override"
  | "no_result";

export interface StreamingSummaryCounts {
  reviewed: number;
  alreadyCorrect: number;
  needTransfer: number;
  manualOverrides: number;
  withoutResults: number;
}

export interface EnrichedStreamingStudent extends StreamingStudentRow {
  hasExamResult: boolean;
  ruleRecommendedId: string | null;
  ruleRecommendedName: string | null;
  placementTargetId: string | null;
  effectivePlacementTargetId: string | null;
  placementTargetName: string | null;
  isManualTarget: boolean;
  placementStatus: StreamingPlacementStatus;
  isActionComplete: boolean;
  /** Current stream differs from placement target. */
  isMoving: boolean;
  /** Already in the correct stream for their placement target. */
  isStaying: boolean;
}

export interface StreamingPlacementImpact {
  studentsMoving: number;
  streamsAffected: number;
}

export interface StreamingPlacementResults {
  students: EnrichedStreamingStudent[];
  streamPreviews: StreamingPlacementPreview[];
  summary: StreamingSummaryCounts;
  impact: StreamingPlacementImpact;
}

export interface StreamingHistoryRow {
  id: string;
  studentName: string;
  admissionNumber: string | null;
  previousClassName: string;
  newClassName: string;
  recommendedClassName: string | null;
  isManualChange: boolean;
  performanceMeasure: StreamingPerformanceMeasure;
  performanceValue: string;
  examLabel: string;
  academicYear: string;
  coordinatorName: string;
  createdAt: string;
  parentClassName: string;
}
