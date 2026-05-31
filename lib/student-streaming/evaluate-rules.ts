import type {
  DivisionStreamingRule,
  EnrichedStreamingStudent,
  NumericStreamingRule,
  StreamingPerformanceMeasure,
  StreamingPlacementPreview,
  StreamingPlacementResults,
  StreamingPlacementStatus,
  StreamingRuleEntry,
  StreamingStreamClass,
  StreamingStudentRow,
  StreamingSummaryCounts,
  StudentStreamingPerformance,
} from "@/lib/student-streaming/types";

export function isDivisionRule(
  rule: StreamingRuleEntry
): rule is DivisionStreamingRule {
  return "divisions" in rule && Array.isArray(rule.divisions);
}

export function isNumericRule(
  rule: StreamingRuleEntry
): rule is NumericStreamingRule {
  return "min" in rule && "max" in rule;
}

export function formatPerformanceValue(
  measure: StreamingPerformanceMeasure,
  performance: StudentStreamingPerformance
): string | null {
  if (performance.subjectsScored === 0) return null;
  switch (measure) {
    case "average_score":
      return performance.averageScorePercent != null
        ? `${performance.averageScorePercent}%`
        : null;
    case "total_marks":
      return performance.totalMarks != null
        ? String(Math.round(performance.totalMarks))
        : null;
    case "division":
      return performance.division != null
        ? performance.division === "INC" || performance.division === "ABS"
          ? performance.division
          : `Division ${performance.division}`
        : null;
    default:
      return null;
  }
}

const DIVISION_RANK: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  "0": 5,
  INC: 6,
  ABS: 7,
};

/** Parse optional stream capacity from a class description field. */
export function parseStreamCapacity(description: string | null): number | null {
  if (!description?.trim()) return null;
  const capacityMatch = description.match(/capacity\s*:?\s*(\d+)/i);
  if (capacityMatch) {
    const n = Number(capacityMatch[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (/^\d+$/.test(description.trim())) {
    const n = Number(description.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export function formatNumericRange(min: number, max: number): string {
  const minLabel = Number.isInteger(min) ? String(min) : min.toFixed(1);
  const maxLabel = Number.isInteger(max) ? String(max) : max.toFixed(1);
  return `${minLabel}–${maxLabel}`;
}

export function formatRuleSummary(
  rule: StreamingRuleEntry,
  streamNameById: Map<string, string>
): string {
  const target = streamNameById.get(rule.targetClassId) ?? "Unknown stream";
  if (isDivisionRule(rule)) {
    const divisions = rule.divisions.map((d) => d.trim()).filter(Boolean);
    return `${divisions.join(", ") || "—"} → ${target}`;
  }
  if (isNumericRule(rule)) {
    return `${formatNumericRange(rule.min, rule.max)} → ${target}`;
  }
  return `→ ${target}`;
}

export function recommendStreamClassId(
  measure: StreamingPerformanceMeasure,
  performance: StudentStreamingPerformance,
  rules: StreamingRuleEntry[]
): string | null {
  if (performance.subjectsScored === 0 || rules.length === 0) return null;

  if (measure === "division") {
    const division = (performance.division ?? "").trim();
    if (!division) return null;
    for (const rule of rules) {
      if (!isDivisionRule(rule)) continue;
      const normalized = rule.divisions.map((d) => d.trim().toUpperCase());
      if (normalized.includes(division.toUpperCase())) {
        return rule.targetClassId;
      }
    }
    return null;
  }

  const value =
    measure === "average_score"
      ? performance.averageScorePercent
      : performance.totalMarks;
  if (value == null || !Number.isFinite(value)) return null;

  for (const rule of rules) {
    if (!isNumericRule(rule)) continue;
    const min = Math.min(rule.min, rule.max);
    const max = Math.max(rule.min, rule.max);
    if (value >= min && value <= max) {
      return rule.targetClassId;
    }
  }
  return null;
}

export function comparePerformanceForRanking(
  measure: StreamingPerformanceMeasure,
  a: StudentStreamingPerformance,
  b: StudentStreamingPerformance
): number {
  const aScored = a.subjectsScored > 0;
  const bScored = b.subjectsScored > 0;
  if (aScored && !bScored) return -1;
  if (!aScored && bScored) return 1;
  if (!aScored && !bScored) return 0;

  if (measure === "average_score") {
    return (b.averageScorePercent ?? -1) - (a.averageScorePercent ?? -1);
  }
  if (measure === "total_marks") {
    return (b.totalMarks ?? -1) - (a.totalMarks ?? -1);
  }
  const rankA =
    a.divisionPoints ??
    DIVISION_RANK[(a.division ?? "").trim().toUpperCase()] ??
    99;
  const rankB =
    b.divisionPoints ??
    DIVISION_RANK[(b.division ?? "").trim().toUpperCase()] ??
    99;
  return rankA - rankB;
}

export function assignStudentRanks<
  T extends { performance: StudentStreamingPerformance; fullName?: string },
>(
  students: T[],
  measure: StreamingPerformanceMeasure
): (T & { rank: number | null })[] {
  const scored = students
    .map((student, index) => ({ student, index }))
    .filter(({ student }) => student.performance.subjectsScored > 0);

  scored.sort((left, right) => {
    const cmp = comparePerformanceForRanking(
      measure,
      left.student.performance,
      right.student.performance
    );
    if (cmp !== 0) return cmp;
    return (left.student.fullName ?? "").localeCompare(
      right.student.fullName ?? "",
      undefined,
      { sensitivity: "base" }
    );
  });

  const rankByIndex = new Map<number, number>();
  let rank = 0;
  for (let i = 0; i < scored.length; i += 1) {
    const entry = scored[i]!;
    if (
      i > 0 &&
      comparePerformanceForRanking(
        measure,
        entry.student.performance,
        scored[i - 1]!.student.performance
      ) === 0
    ) {
      rankByIndex.set(entry.index, rankByIndex.get(scored[i - 1]!.index)!);
    } else {
      rank += 1;
      rankByIndex.set(entry.index, rank);
    }
  }

  return students.map((student, index) => ({
    ...student,
    rank:
      student.performance.subjectsScored > 0
        ? (rankByIndex.get(index) ?? null)
        : null,
  }));
}

export function buildPlacementPreview(
  students: { recommendedClassId: string | null; recommendedClassName: string | null }[],
  streamNameById: Map<string, string>
): { targetClassId: string; targetClassName: string; studentCount: number }[] {
  const counts = new Map<string, number>();
  for (const s of students) {
    if (!s.recommendedClassId) continue;
    counts.set(
      s.recommendedClassId,
      (counts.get(s.recommendedClassId) ?? 0) + 1
    );
  }
  return [...counts.entries()]
    .map(([targetClassId, studentCount]) => ({
      targetClassId,
      targetClassName: streamNameById.get(targetClassId) ?? "Unknown",
      studentCount,
    }))
    .sort((a, b) => a.targetClassName.localeCompare(b.targetClassName));
}

export function buildFullPlacementPreview(
  students: { recommendedClassId: string | null }[],
  streamClasses: { id: string; name: string }[]
): { targetClassId: string; targetClassName: string; studentCount: number }[] {
  const counts = new Map(streamClasses.map((stream) => [stream.id, 0]));
  for (const student of students) {
    if (!student.recommendedClassId) continue;
    if (!counts.has(student.recommendedClassId)) continue;
    counts.set(
      student.recommendedClassId,
      (counts.get(student.recommendedClassId) ?? 0) + 1
    );
  }
  return streamClasses.map((stream) => ({
    targetClassId: stream.id,
    targetClassName: stream.name,
    studentCount: counts.get(stream.id) ?? 0,
  }));
}

export function resolvePlacementStatus(params: {
  hasExamResult: boolean;
  currentStreamName: string;
  currentClassId: string;
  effectivePlacementTargetId: string | null;
  ruleRecommendedId: string | null;
  hasExplicitOverride: boolean;
  streamIds: Set<string>;
}): StreamingPlacementStatus {
  const {
    hasExamResult,
    currentStreamName,
    currentClassId,
    effectivePlacementTargetId,
    ruleRecommendedId,
    hasExplicitOverride,
    streamIds,
  } = params;

  if (!hasExamResult) {
    return "no_result";
  }

  const recommended = ruleRecommendedId;
  const target = effectivePlacementTargetId;

  if (
    recommended &&
    target &&
    target !== recommended
  ) {
    return "manual_override";
  }
  if (hasExplicitOverride && !recommended && target) {
    return "manual_override";
  }

  if (target && currentClassId === target) {
    return "placed";
  }
  if (recommended && currentClassId === recommended && !hasExplicitOverride) {
    return "placed";
  }

  const isInStream =
    currentStreamName !== "Unassigned" && streamIds.has(currentClassId);

  if (isInStream) {
    const goal = target ?? recommended;
    if (goal && currentClassId !== goal) {
      return "needs_transfer";
    }
  }

  if (!isInStream) {
    return "unassigned";
  }

  return "needs_transfer";
}

export function computeStreamingSummary(
  students: { placementStatus: StreamingPlacementStatus; performance: { subjectsScored: number } }[]
): StreamingSummaryCounts {
  let reviewed = 0;
  let alreadyCorrect = 0;
  let needTransfer = 0;
  let manualOverrides = 0;
  let withoutResults = 0;

  for (const student of students) {
    if (student.performance.subjectsScored > 0) reviewed += 1;
    switch (student.placementStatus) {
      case "placed":
        alreadyCorrect += 1;
        break;
      case "needs_transfer":
      case "unassigned":
        needTransfer += 1;
        break;
      case "manual_override":
        manualOverrides += 1;
        break;
      case "no_result":
        withoutResults += 1;
        break;
      default:
        break;
    }
  }

  return {
    reviewed,
    alreadyCorrect,
    needTransfer,
    manualOverrides,
    withoutResults,
  };
}

export function buildPlacementPreviewWithCapacity(
  students: {
    id: string;
    currentClassId: string;
    placementTargetId: string | null;
  }[],
  streamClasses: { id: string; name: string; capacity: number | null }[]
): StreamingPlacementPreview[] {
  return computeStreamPreviewsFromPlacementStudents(students, streamClasses);
}

function buildStreamNameMap(
  streamClasses: StreamingStreamClass[],
  students: StreamingStudentRow[]
): Map<string, string> {
  const streamNameById = new Map(streamClasses.map((stream) => [stream.id, stream.name]));
  for (const student of students) {
    if (!streamNameById.has(student.currentClassId)) {
      streamNameById.set(student.currentClassId, student.currentClassName);
    }
  }
  return streamNameById;
}

function enrichStreamingStudents(params: {
  students: StreamingStudentRow[];
  rules: StreamingRuleEntry[];
  overrides: Record<string, string>;
  streamClasses: StreamingStreamClass[];
  performanceMeasure: StreamingPerformanceMeasure;
}): EnrichedStreamingStudent[] {
  const streamIds = new Set(params.streamClasses.map((stream) => stream.id));
  const streamNameById = buildStreamNameMap(params.streamClasses, params.students);

  return params.students.map((student) => {
    const hasExamResult = student.performance.subjectsScored > 0;
    const ruleRecommendedId =
      params.rules.length > 0
        ? recommendStreamClassId(
            params.performanceMeasure,
            student.performance,
            params.rules
          )
        : student.recommendedClassId;
    const hasExplicitOverride = params.overrides[student.id] != null;
    const placementTargetId = hasExamResult
      ? (params.overrides[student.id] ?? ruleRecommendedId ?? null)
      : (params.overrides[student.id] ?? null);
    const effectivePlacementTargetId = placementTargetId;
    const ruleRecommendedName = ruleRecommendedId
      ? (streamNameById.get(ruleRecommendedId) ?? null)
      : null;
    const placementTargetName = effectivePlacementTargetId
      ? (streamNameById.get(effectivePlacementTargetId) ?? null)
      : null;
    const isManualTarget =
      hasExamResult &&
      ruleRecommendedId != null &&
      effectivePlacementTargetId != null &&
      effectivePlacementTargetId !== ruleRecommendedId;
    const placementStatus = resolvePlacementStatus({
      hasExamResult,
      currentStreamName: student.currentStreamName,
      currentClassId: student.currentClassId,
      effectivePlacementTargetId,
      ruleRecommendedId,
      hasExplicitOverride,
      streamIds,
    });
    const isMoving =
      effectivePlacementTargetId != null &&
      student.currentClassId !== effectivePlacementTargetId;
    const isStaying =
      effectivePlacementTargetId != null &&
      student.currentClassId === effectivePlacementTargetId;

    return {
      ...student,
      hasExamResult,
      ruleRecommendedId,
      ruleRecommendedName,
      placementTargetId,
      effectivePlacementTargetId,
      placementTargetName,
      isManualTarget,
      placementStatus,
      isActionComplete: isStaying,
      isMoving,
      isStaying,
    };
  });
}

function resolvePreviewPlacementTarget(
  student: {
    currentClassId: string;
    ruleRecommendedId: string | null;
    appliedPlacementClassId: string | null;
  },
  override: string | undefined,
  streamIds: Set<string>
): string | null {
  if (override != null) {
    return override;
  }
  if (
    student.appliedPlacementClassId &&
    student.currentClassId === student.appliedPlacementClassId
  ) {
    return student.appliedPlacementClassId;
  }
  if (student.ruleRecommendedId) {
    return student.ruleRecommendedId;
  }
  if (streamIds.has(student.currentClassId)) {
    return student.currentClassId;
  }
  return null;
}

function computeStreamPreviewsFromPlacementStudents(
  students: {
    currentClassId: string;
    placementTargetId: string | null;
  }[],
  streamClasses: { id: string; name: string; capacity: number | null }[]
): StreamingPlacementPreview[] {
  return streamClasses.map((stream) => {
    const currentOccupancy = students.filter(
      (student) => student.currentClassId === stream.id
    ).length;

    let incomingCount = 0;
    let leavingCount = 0;
    let stayingCount = 0;

    for (const student of students) {
      const target = student.placementTargetId;
      if (!target) continue;

      if (target === stream.id && student.currentClassId === stream.id) {
        stayingCount += 1;
      }
      if (target === stream.id && student.currentClassId !== stream.id) {
        incomingCount += 1;
      }
      if (student.currentClassId === stream.id && target !== stream.id) {
        leavingCount += 1;
      }
    }

    const finalTotal = currentOccupancy + incomingCount - leavingCount;
    const netChange = finalTotal - currentOccupancy;
    const capacity = stream.capacity;

    return {
      targetClassId: stream.id,
      targetClassName: stream.name,
      studentCount: stayingCount + incomingCount,
      currentOccupancy,
      incomingCount,
      leavingCount,
      stayingCount,
      finalTotal,
      netChange,
      capacity,
      isOverCapacity: capacity != null && finalTotal > capacity,
    };
  });
}

function computeStreamingPlacementImpact(
  students: Pick<
    EnrichedStreamingStudent,
    "currentClassId" | "effectivePlacementTargetId" | "isMoving"
  >[],
  streamPreviews: StreamingPlacementPreview[]
): { studentsMoving: number; streamsAffected: number } {
  const studentsMoving = students.filter((student) => student.isMoving).length;
  const streamsAffected = streamPreviews.filter(
    (row) => row.incomingCount > 0 || row.leavingCount > 0
  ).length;

  return { studentsMoving, streamsAffected };
}

/** Single source of truth for streaming placement calculations used across the UI. */
export function computeStreamingPlacementResults(params: {
  students: StreamingStudentRow[];
  rules: StreamingRuleEntry[];
  overrides: Record<string, string>;
  streamClasses: StreamingStreamClass[];
  performanceMeasure: StreamingPerformanceMeasure;
}): StreamingPlacementResults {
  const students = enrichStreamingStudents(params);
  const streamIds = new Set(params.streamClasses.map((stream) => stream.id));
  const streamPreviews = computeStreamPreviewsFromPlacementStudents(
    students.map((student) => ({
      currentClassId: student.currentClassId,
      placementTargetId: resolvePreviewPlacementTarget(
        {
          currentClassId: student.currentClassId,
          ruleRecommendedId: student.ruleRecommendedId,
          appliedPlacementClassId: student.appliedPlacementClassId,
        },
        params.overrides[student.id],
        streamIds
      ),
    })),
    params.streamClasses
  );
  const summary = computeStreamingSummary(students);
  const impact = computeStreamingPlacementImpact(students, streamPreviews);

  return {
    students,
    streamPreviews,
    summary,
    impact,
  };
}

/** Whether a student is related to a stream for preview-card filtering. */
export function studentRelatesToStream(
  student: {
    currentClassId: string;
    effectivePlacementTargetId: string | null;
    ruleRecommendedId: string | null;
  },
  streamId: string
): boolean {
  return (
    student.currentClassId === streamId ||
    student.effectivePlacementTargetId === streamId ||
    student.ruleRecommendedId === streamId
  );
}

export function formatStreamingPlacementReason(
  measure: StreamingPerformanceMeasure,
  performance: StudentStreamingPerformance,
  isManualOverride: boolean
): string {
  if (isManualOverride) {
    return "Manual override selected by coordinator";
  }
  if (performance.subjectsScored === 0) {
    return "Manual placement (no exam result)";
  }
  switch (measure) {
    case "average_score":
      return performance.averageScorePercent != null
        ? `Recommended by streaming rules (${performance.averageScorePercent}%)`
        : "Recommended by streaming rules";
    case "total_marks":
      return performance.totalMarks != null
        ? `Recommended by streaming rules (${Math.round(performance.totalMarks)} marks)`
        : "Recommended by streaming rules";
    case "division":
      return performance.division
        ? `Recommended by streaming rules (Division ${performance.division})`
        : "Recommended by streaming rules";
    default:
      return "Recommended by streaming rules";
  }
}

export function buildCapacityWarnings(
  streamClasses: { id: string; name: string; capacity: number | null }[],
  students: { id: string; currentClassId: string }[],
  pendingPlacements: { studentId: string; targetClassId: string }[]
): string[] {
  const warnings: string[] = [];
  const incomingByStream = new Map<string, Set<string>>();

  for (const placement of pendingPlacements) {
    const set = incomingByStream.get(placement.targetClassId) ?? new Set<string>();
    set.add(placement.studentId);
    incomingByStream.set(placement.targetClassId, set);
  }

  for (const stream of streamClasses) {
    if (stream.capacity == null) continue;
    const incoming = incomingByStream.get(stream.id);
    if (!incoming?.size) continue;

    const currentCount = students.filter(
      (student) => student.currentClassId === stream.id
    ).length;

    let netArrivals = 0;
    for (const studentId of incoming) {
      const student = students.find((row) => row.id === studentId);
      if (!student) {
        netArrivals += 1;
        continue;
      }
      if (student.currentClassId !== stream.id) netArrivals += 1;
    }

    const projected = currentCount + netArrivals;
    if (projected > stream.capacity) {
      warnings.push(`${stream.name} exceeds its configured capacity.`);
    }
  }

  return warnings;
}
