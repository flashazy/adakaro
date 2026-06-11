import type {
  DivisionPointsStreamingRule,
  DivisionRuleMode,
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
import {
  DIVISION_ONLY_RULE_DIVISIONS,
  DIVISION_POINTS_RULE_DIVISIONS,
  NECTA_DIVISION_POINT_RANGES,
} from "@/lib/student-streaming/types";

export function isDivisionRule(
  rule: StreamingRuleEntry
): rule is DivisionStreamingRule {
  return "divisions" in rule && Array.isArray(rule.divisions);
}

export function isDivisionPointsRule(
  rule: StreamingRuleEntry
): rule is DivisionPointsStreamingRule {
  return (
    "division" in rule &&
    "minPoints" in rule &&
    "maxPoints" in rule &&
    !("divisions" in rule)
  );
}

export function isNumericRule(
  rule: StreamingRuleEntry
): rule is NumericStreamingRule {
  return "min" in rule && "max" in rule && !isDivisionPointsRule(rule);
}

export function isPointsBasedDivisionMode(
  mode: DivisionRuleMode
): mode is "necta_points" | "custom_points" {
  return mode === "necta_points" || mode === "custom_points";
}

/** Infer workspace mode from persisted rules. */
export function inferDivisionRuleMode(
  rules: StreamingRuleEntry[]
): DivisionRuleMode {
  const pointsRules = rules.filter(isDivisionPointsRule);
  if (pointsRules.length === 0) return "division_only";
  if (pointsRules.some((r) => r.mode === "custom_points")) {
    return "custom_points";
  }
  return "necta_points";
}

function parseDivisionRuleModeValue(raw: unknown): DivisionRuleMode | null {
  const value = String(raw ?? "").trim();
  if (
    value === "division_only" ||
    value === "necta_points" ||
    value === "custom_points"
  ) {
    return value;
  }
  return null;
}

function parseStreamingRuleEntry(item: unknown): StreamingRuleEntry | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const targetClassId = String(row.targetClassId ?? "").trim();
  if (!targetClassId) return null;

  if (Array.isArray(row.divisions)) {
    return {
      mode: "division_only",
      targetClassId,
      divisions: row.divisions.map((d) => String(d)),
    };
  }

  const division = String(row.division ?? "").trim();
  const minPoints = Number(row.minPoints);
  const maxPoints = Number(row.maxPoints);
  if (division && Number.isFinite(minPoints) && Number.isFinite(maxPoints)) {
    const rawMode = String(row.mode ?? "").trim();
    const mode =
      rawMode === "custom_points" ? "custom_points" : "necta_points";
    return {
      mode,
      targetClassId,
      division,
      minPoints,
      maxPoints,
    };
  }

  const min = Number(row.min);
  const max = Number(row.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { targetClassId, min, max };
}

export function parseStreamingRuleEntries(raw: unknown): StreamingRuleEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: StreamingRuleEntry[] = [];
  for (const item of raw) {
    const parsed = parseStreamingRuleEntry(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Parse rules JSONB — supports legacy array or `{ divisionRuleMode, rules }`. */
export function parseStreamingRulesPayload(raw: unknown): {
  rules: StreamingRuleEntry[];
  divisionRuleMode: DivisionRuleMode | null;
} {
  if (Array.isArray(raw)) {
    return {
      rules: parseStreamingRuleEntries(raw),
      divisionRuleMode: null,
    };
  }
  if (raw && typeof raw === "object") {
    const doc = raw as Record<string, unknown>;
    return {
      rules: parseStreamingRuleEntries(doc.rules),
      divisionRuleMode: parseDivisionRuleModeValue(doc.divisionRuleMode),
    };
  }
  return { rules: [], divisionRuleMode: null };
}

export function resolveDivisionRuleMode(
  explicit: DivisionRuleMode | null | undefined,
  rules: StreamingRuleEntry[]
): DivisionRuleMode {
  return explicit ?? inferDivisionRuleMode(rules);
}

/** Rules that participate in matching for the active division workspace mode. */
export function filterRulesForDivisionMode(
  rules: StreamingRuleEntry[],
  mode: DivisionRuleMode
): StreamingRuleEntry[] {
  if (mode === "division_only") {
    return rules.filter(isDivisionRule);
  }
  if (mode === "necta_points") {
    return rules.filter(
      (rule) =>
        isDivisionRule(rule) ||
        (isDivisionPointsRule(rule) &&
          getDivisionPointsRuleMode(rule) === "necta_points")
    );
  }
  return rules.filter(
    (rule) =>
      isDivisionRule(rule) ||
      (isDivisionPointsRule(rule) &&
        getDivisionPointsRuleMode(rule) === "custom_points")
  );
}

export function serializeStreamingRulesPayload(
  rules: StreamingRuleEntry[],
  measure: StreamingPerformanceMeasure,
  divisionRuleMode: DivisionRuleMode | null
): unknown {
  if (measure !== "division") return rules;
  return {
    divisionRuleMode:
      divisionRuleMode ?? inferDivisionRuleMode(rules),
    rules,
  };
}

export function getDivisionPointsRuleMode(
  rule: DivisionPointsStreamingRule
): "necta_points" | "custom_points" {
  return rule.mode === "custom_points" ? "custom_points" : "necta_points";
}

export function isPositiveWholeNumber(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

/** Validate a rule range stays within official NECTA bands for the division. */
export function validateNectaPointsRuleRange(
  division: string,
  minPoints: number,
  maxPoints: number
): string | null {
  const key = division.trim().toUpperCase();
  const band =
    key in NECTA_DIVISION_POINT_RANGES
      ? NECTA_DIVISION_POINT_RANGES[
          key as keyof typeof NECTA_DIVISION_POINT_RANGES
        ]
      : null;
  if (!band) {
    return `Invalid division for NECTA points: ${division}.`;
  }
  const min = Math.min(minPoints, maxPoints);
  const max = Math.max(minPoints, maxPoints);
  if (key === "0") {
    if (min < band.min) {
      return `Division 0 NECTA points start at ${band.min}.`;
    }
    return null;
  }
  if (min < band.min || max > band.max) {
    return `NECTA Division ${key} allows ${band.min}–${band.max} points only.`;
  }
  return null;
}

export function validateDivisionPointsRule(
  rule: DivisionPointsStreamingRule
): string | null {
  if (!rule.division.trim()) {
    return "Each points rule must specify a division.";
  }
  if (
    !isPositiveWholeNumber(rule.minPoints) ||
    !isPositiveWholeNumber(rule.maxPoints)
  ) {
    return "Points must be positive whole numbers.";
  }
  if (rule.minPoints > rule.maxPoints) {
    return "Rule minimum points cannot exceed maximum points.";
  }
  if (getDivisionPointsRuleMode(rule) === "necta_points") {
    return validateNectaPointsRuleRange(
      rule.division,
      rule.minPoints,
      rule.maxPoints
    );
  }
  return null;
}

function formatDivisionLabelOnly(
  performance: StudentStreamingPerformance
): string | null {
  if (performance.subjectsScored === 0) return null;
  const div = (performance.division ?? "").trim();
  if (!div) return null;
  if (div === "INC" || div === "ABS") return div;
  return `Division ${div}`;
}

/** Compact string for points modes: "Division I · 7 pts", or INC/ABS. */
export function formatDivisionWithPoints(
  performance: StudentStreamingPerformance
): string | null {
  if (performance.subjectsScored === 0) return null;
  const div = (performance.division ?? "").trim();
  if (!div) return null;
  if (div === "INC" || div === "ABS") return div;
  const pts = performance.divisionPoints;
  if (pts != null && Number.isFinite(pts)) {
    return `Division ${div} · ${pts} pts`;
  }
  return `Division ${div}`;
}

export function formatDivisionPerformanceDisplay(
  performance: StudentStreamingPerformance,
  divisionRuleMode: DivisionRuleMode
): string | null {
  if (isPointsBasedDivisionMode(divisionRuleMode)) {
    return formatDivisionWithPoints(performance);
  }
  return formatDivisionLabelOnly(performance);
}

/** Parts for compact two-line division table cell. */
export function getDivisionTableDisplay(
  performance: StudentStreamingPerformance,
  divisionRuleMode: DivisionRuleMode = "division_only"
): { label: string; points: number | null } | null {
  if (performance.subjectsScored === 0) return null;
  const div = (performance.division ?? "").trim();
  if (!div) return null;
  if (div === "INC" || div === "ABS") {
    return { label: div, points: null };
  }
  if (divisionRuleMode === "division_only") {
    return { label: `Division ${div}`, points: null };
  }
  const pts = performance.divisionPoints;
  return {
    label: `Division ${div}`,
    points: pts != null && Number.isFinite(pts) ? pts : null,
  };
}

export function formatPerformanceValue(
  measure: StreamingPerformanceMeasure,
  performance: StudentStreamingPerformance,
  divisionRuleMode?: DivisionRuleMode | null
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
      return formatDivisionPerformanceDisplay(
        performance,
        resolveDivisionRuleMode(divisionRuleMode, [])
      );
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

/** Human-readable numeric range for placement summaries (%, Marks, etc.). */
export function formatNumericRuleRangeForMeasure(
  measure: StreamingPerformanceMeasure,
  min: number,
  max: number
): string {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const range = formatNumericRange(lo, hi);
  if (measure === "average_score") return `${range}%`;
  if (measure === "total_marks") return `${range} Marks`;
  return range;
}

export function formatRuleSummary(
  rule: StreamingRuleEntry,
  streamNameById: Map<string, string>,
  performanceMeasure?: StreamingPerformanceMeasure
): string {
  const target = streamNameById.get(rule.targetClassId) ?? "Unknown stream";
  if (isDivisionPointsRule(rule)) {
    const div = rule.division.trim() || "—";
    const min = Math.min(rule.minPoints, rule.maxPoints);
    const max = Math.max(rule.minPoints, rule.maxPoints);
    return `Division ${div}, ${min}–${max} points → ${target}`;
  }
  if (isDivisionRule(rule)) {
    const divisions = rule.divisions.map((d) => d.trim()).filter(Boolean);
    const label = divisions.map((d) => `Division ${d}`).join(", ");
    return `${label || "—"} → ${target}`;
  }
  if (isNumericRule(rule)) {
    const rangeLabel =
      performanceMeasure === "average_score" ||
      performanceMeasure === "total_marks"
        ? formatNumericRuleRangeForMeasure(
            performanceMeasure,
            rule.min,
            rule.max
          )
        : formatNumericRange(rule.min, rule.max);
    return `${rangeLabel} → ${target}`;
  }
  return `→ ${target}`;
}

function divisionMatchesRule(
  performance: StudentStreamingPerformance,
  rule: StreamingRuleEntry
): boolean {
  const division = (performance.division ?? "").trim().toUpperCase();
  if (!division) return false;

  if (isDivisionPointsRule(rule)) {
    const ruleDivision = rule.division.trim().toUpperCase();
    if (ruleDivision !== division) return false;
    const points = performance.divisionPoints;
    if (points == null || !Number.isFinite(points)) return false;
    const min = Math.min(rule.minPoints, rule.maxPoints);
    const max = Math.max(rule.minPoints, rule.maxPoints);
    return points >= min && points <= max;
  }

  if (isDivisionRule(rule)) {
    const normalized = rule.divisions.map((d) => d.trim().toUpperCase());
    return normalized.includes(division);
  }

  return false;
}

function activeRulesForMeasure(
  measure: StreamingPerformanceMeasure,
  rules: StreamingRuleEntry[],
  divisionRuleMode?: DivisionRuleMode | null
): StreamingRuleEntry[] {
  if (measure !== "division") return rules;
  const mode = resolveDivisionRuleMode(divisionRuleMode, rules);
  return filterRulesForDivisionMode(rules, mode);
}

/** First matching division rule (same order semantics as placement). */
export function findMatchingStreamingRule(
  measure: StreamingPerformanceMeasure,
  performance: StudentStreamingPerformance,
  rules: StreamingRuleEntry[],
  divisionRuleMode?: DivisionRuleMode | null
): StreamingRuleEntry | null {
  if (performance.subjectsScored === 0 || rules.length === 0) return null;

  const activeRules = activeRulesForMeasure(measure, rules, divisionRuleMode);

  if (measure === "division") {
    for (const rule of activeRules) {
      if (isDivisionRule(rule) || isDivisionPointsRule(rule)) {
        if (divisionMatchesRule(performance, rule)) return rule;
      }
    }
    return null;
  }

  const value =
    measure === "average_score"
      ? performance.averageScorePercent
      : performance.totalMarks;
  if (value == null || !Number.isFinite(value)) return null;

  for (const rule of activeRules) {
    if (!isNumericRule(rule)) continue;
    const min = Math.min(rule.min, rule.max);
    const max = Math.max(rule.min, rule.max);
    if (value >= min && value <= max) return rule;
  }
  return null;
}

export function recommendStreamClassId(
  measure: StreamingPerformanceMeasure,
  performance: StudentStreamingPerformance,
  rules: StreamingRuleEntry[],
  divisionRuleMode?: DivisionRuleMode | null
): string | null {
  if (performance.subjectsScored === 0 || rules.length === 0) return null;

  if (measure === "division") {
    const matched = findMatchingStreamingRule(
      measure,
      performance,
      rules,
      divisionRuleMode
    );
    return matched?.targetClassId ?? null;
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
  b: StudentStreamingPerformance,
  divisionRuleMode?: DivisionRuleMode | null
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
  const mode = divisionRuleMode ?? "division_only";
  if (mode === "division_only") {
    const rankA =
      DIVISION_RANK[(a.division ?? "").trim().toUpperCase()] ?? 99;
    const rankB =
      DIVISION_RANK[(b.division ?? "").trim().toUpperCase()] ?? 99;
    return rankA - rankB;
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
  measure: StreamingPerformanceMeasure,
  divisionRuleMode?: DivisionRuleMode | null
): (T & { rank: number | null })[] {
  const scored = students
    .map((student, index) => ({ student, index }))
    .filter(({ student }) => student.performance.subjectsScored > 0);

  scored.sort((left, right) => {
    const cmp = comparePerformanceForRanking(
      measure,
      left.student.performance,
      right.student.performance,
      divisionRuleMode
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
        scored[i - 1]!.student.performance,
        divisionRuleMode
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
  divisionRuleMode?: DivisionRuleMode | null;
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
            params.rules,
            params.divisionRuleMode
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
  divisionRuleMode?: DivisionRuleMode | null;
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
  isManualOverride: boolean,
  rules: StreamingRuleEntry[] = [],
  divisionRuleMode?: DivisionRuleMode | null
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
    case "division": {
      const mode = resolveDivisionRuleMode(divisionRuleMode, rules);
      const matched = findMatchingStreamingRule(
        measure,
        performance,
        rules,
        mode
      );
      const div = (performance.division ?? "").trim();
      const pts = performance.divisionPoints;
      if (matched && isDivisionPointsRule(matched)) {
        const min = Math.min(matched.minPoints, matched.maxPoints);
        const max = Math.max(matched.minPoints, matched.maxPoints);
        if (pts != null && Number.isFinite(pts)) {
          return `Matched Division ${matched.division} with ${pts} points`;
        }
        return `Matched Division ${matched.division} points ${min}–${max}`;
      }
      if (div) {
        if (
          isPointsBasedDivisionMode(mode) &&
          pts != null &&
          Number.isFinite(pts) &&
          div !== "INC" &&
          div !== "ABS"
        ) {
          return `Matched Division ${div} with ${pts} points`;
        }
        return `Matched Division ${div}`;
      }
      return "Recommended by streaming rules";
    }
    default:
      return "Recommended by streaming rules";
  }
}

/** Detect overlapping inclusive point ranges within the same division. */
export function detectOverlappingDivisionPointsRules(
  rules: StreamingRuleEntry[]
): string | null {
  const pointsRules = rules.filter(isDivisionPointsRule);
  for (let i = 0; i < pointsRules.length; i += 1) {
    for (let j = i + 1; j < pointsRules.length; j += 1) {
      const a = pointsRules[i]!;
      const b = pointsRules[j]!;
      if (a.division.trim().toUpperCase() !== b.division.trim().toUpperCase()) {
        continue;
      }
      const aMin = Math.min(a.minPoints, a.maxPoints);
      const aMax = Math.max(a.minPoints, a.maxPoints);
      const bMin = Math.min(b.minPoints, b.maxPoints);
      const bMax = Math.max(b.minPoints, b.maxPoints);
      if (aMin <= bMax && bMin <= aMax) {
        return `Overlapping point ranges for Division ${a.division}: ${aMin}–${aMax} and ${bMin}–${bMax}. Adjust ranges — first matching rule wins.`;
      }
    }
  }
  return null;
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

const PRIMARY_DIVISIONS = ["I", "II", "III", "IV", "0"] as const;
const TAIL_DIVISIONS = ["INC", "ABS"] as const;

export function compareStreamClassNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function sortStreamClassesByName<T extends { name: string }>(
  streams: T[]
): T[] {
  return [...streams].sort((a, b) => compareStreamClassNames(a.name, b.name));
}

function roundNumericBound(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Split a numeric range into equal bands (index 0 = highest band). */
function buildEvenNumericBands(
  count: number,
  overallMin: number,
  overallMax: number
): { min: number; max: number }[] {
  if (count <= 0) return [];
  if (count === 1) {
    return [{ min: overallMin, max: overallMax }];
  }

  const span = overallMax - overallMin;
  const step = span / count;
  const bands: { min: number; max: number }[] = [];

  for (let i = 0; i < count; i += 1) {
    const bandIndex = count - 1 - i;
    const min = roundNumericBound(overallMin + bandIndex * step);
    const max =
      bandIndex === count - 1
        ? roundNumericBound(overallMax)
        : roundNumericBound(overallMin + (bandIndex + 1) * step - 0.01);
    bands.push({ min, max });
  }

  return bands;
}

export function inferTotalMarksCeilingFromPerformance(
  performances: Pick<StudentStreamingPerformance, "totalMarks">[],
  fallback = 1000
): number {
  let max = 0;
  for (const performance of performances) {
    const total = performance.totalMarks;
    if (total != null && Number.isFinite(total) && total > max) {
      max = total;
    }
  }
  if (max <= 0) return fallback;
  return Math.ceil(max / 100) * 100;
}

export function buildExampleNumericRules(
  streamClasses: StreamingStreamClass[],
  measure: "average_score" | "total_marks",
  options?: { totalMarksCeiling?: number | null }
): NumericStreamingRule[] {
  if (streamClasses.length === 0) return [];

  const [overallMin, overallMax] =
    measure === "average_score"
      ? [0, 100]
      : [0, options?.totalMarksCeiling ?? 1000];

  const bands = buildEvenNumericBands(
    streamClasses.length,
    overallMin,
    overallMax
  );

  return bands.map((band, index) => ({
    targetClassId: streamClasses[index]!.id,
    min: band.min,
    max: band.max,
  }));
}

export function buildExampleDivisionRules(
  streamClasses: StreamingStreamClass[]
): DivisionStreamingRule[] {
  const count = streamClasses.length;
  if (count === 0) return [];

  if (count === 1) {
    return [
      {
        targetClassId: streamClasses[0]!.id,
        divisions: [...DIVISION_ONLY_RULE_DIVISIONS],
      },
    ];
  }

  const groups: string[][] = Array.from({ length: count }, () => []);
  let primaryIndex = 0;

  for (
    let streamIndex = 0;
    streamIndex < count - 1 && primaryIndex < PRIMARY_DIVISIONS.length;
    streamIndex += 1
  ) {
    groups[streamIndex]!.push(PRIMARY_DIVISIONS[primaryIndex]!);
    primaryIndex += 1;
  }

  while (primaryIndex < PRIMARY_DIVISIONS.length) {
    groups[count - 1]!.push(PRIMARY_DIVISIONS[primaryIndex]!);
    primaryIndex += 1;
  }
  groups[count - 1]!.push(...TAIL_DIVISIONS);

  return groups
    .map((divisions, index) => ({
      targetClassId: streamClasses[index]!.id,
      divisions,
    }))
    .filter((rule) => rule.divisions.length > 0);
}

function subdivideInclusiveRange(
  min: number,
  max: number,
  parts: number
): { min: number; max: number }[] {
  if (parts <= 0) return [];
  if (parts === 1) return [{ min, max }];

  const total = max - min + 1;
  const size = Math.max(1, Math.floor(total / parts));
  const bands: { min: number; max: number }[] = [];
  let cursor = min;

  for (let part = 0; part < parts; part += 1) {
    const end = part === parts - 1 ? max : Math.min(max, cursor + size - 1);
    bands.push({ min: cursor, max: end });
    cursor = end + 1;
  }

  return bands;
}

function buildExampleDivisionPointsRules(
  streamClasses: StreamingStreamClass[],
  mode: "necta_points" | "custom_points"
): StreamingRuleEntry[] {
  const count = streamClasses.length;
  if (count === 0) return [];

  if (count === 1) {
    const streamId = streamClasses[0]!.id;
    return [
      {
        mode,
        targetClassId: streamId,
        division: "I",
        minPoints: 7,
        maxPoints: mode === "necta_points" ? 17 : 10,
      },
      {
        mode: "division_only",
        targetClassId: streamId,
        divisions: ["II", "III", "IV", "0", "INC", "ABS"],
      },
    ];
  }

  const rules: StreamingRuleEntry[] = [];
  const pointSlots = count - 1;
  let streamIndex = 0;

  for (
    let divisionIndex = 0;
    divisionIndex < DIVISION_POINTS_RULE_DIVISIONS.length &&
    streamIndex < pointSlots;
    divisionIndex += 1
  ) {
    const division = DIVISION_POINTS_RULE_DIVISIONS[divisionIndex]!;
    const range = NECTA_DIVISION_POINT_RANGES[division];
    const streamsLeft = pointSlots - streamIndex;
    const divisionsLeft =
      DIVISION_POINTS_RULE_DIVISIONS.length - divisionIndex;
    const allocation = Math.max(1, Math.ceil(streamsLeft / divisionsLeft));
    const bands = subdivideInclusiveRange(range.min, range.max, allocation);

    for (const band of bands) {
      if (streamIndex >= pointSlots) break;
      rules.push({
        mode,
        targetClassId: streamClasses[streamIndex]!.id,
        division,
        minPoints: band.min,
        maxPoints: band.max,
      });
      streamIndex += 1;
    }
  }

  while (streamIndex < pointSlots) {
    const range = NECTA_DIVISION_POINT_RANGES["0"];
    rules.push({
      mode,
      targetClassId: streamClasses[streamIndex]!.id,
      division: "0",
      minPoints: range.min,
      maxPoints: range.max,
    });
    streamIndex += 1;
  }

  rules.push({
    mode: "division_only",
    targetClassId: streamClasses[count - 1]!.id,
    divisions: [...TAIL_DIVISIONS],
  });

  return rules;
}

export function buildExampleNectaPointsRules(
  streamClasses: StreamingStreamClass[]
): StreamingRuleEntry[] {
  return buildExampleDivisionPointsRules(streamClasses, "necta_points");
}

export function buildExampleCustomPointsRules(
  streamClasses: StreamingStreamClass[]
): StreamingRuleEntry[] {
  return buildExampleDivisionPointsRules(streamClasses, "custom_points");
}

export function findStreamsWithoutRules(
  streamClasses: StreamingStreamClass[],
  rules: StreamingRuleEntry[],
  performanceMeasure: StreamingPerformanceMeasure,
  divisionRuleMode: DivisionRuleMode
): StreamingStreamClass[] {
  const activeRules =
    performanceMeasure === "division"
      ? filterRulesForDivisionMode(rules, divisionRuleMode)
      : rules;
  const coveredStreamIds = new Set(
    activeRules.map((rule) => rule.targetClassId).filter(Boolean)
  );

  return streamClasses.filter((stream) => !coveredStreamIds.has(stream.id));
}
