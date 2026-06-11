"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Loader2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingShell } from "@/components/dashboard/async-loading-shell";
import {
  assignStudentRanks,
  buildCapacityWarnings,
  computeStreamingPlacementResults,
  detectOverlappingDivisionPointsRules,
  filterRulesForDivisionMode,
  formatRuleSummary,
  formatStreamingPlacementReason,
  getDivisionTableDisplay,
  inferDivisionRuleMode,
  isDivisionPointsRule,
  isDivisionRule,
  isNumericRule,
  isPointsBasedDivisionMode,
  resolveDivisionRuleMode,
  studentRelatesToStream,
} from "@/lib/student-streaming/evaluate-rules";
import {
  DIVISION_ONLY_RULE_DIVISIONS,
  DIVISION_POINTS_RULE_DIVISIONS,
  STREAMING_PERFORMANCE_MEASURE_LABELS,
  type DivisionPointsStreamingRule,
  type DivisionRuleMode,
  type DivisionStreamingRule,
  type NumericStreamingRule,
  type StreamingExamOption,
  type StreamingOverviewStats,
  type StreamingParentClassOption,
  type StreamingPerformanceMeasure,
  type StreamingPlacementPreview,
  type StreamingPlacementStatus,
  type EnrichedStreamingStudent,
  type StreamingRuleEntry,
  type StreamingStreamClass,
  type StreamingStudentRow,
  type StudentStreamingPerformance,
} from "@/lib/student-streaming/types";
import { SubjectCompatibilityModal } from "@/components/students/subject-compatibility-modal";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import { checkSubjectCompatibilityAction } from "@/lib/student-subject-enrollment/subject-compatibility-actions";
import type { SubjectCompatibilityBatchResult } from "@/lib/student-subject-enrollment/subject-compatibility-types";
import {
  applyStudentStreamingAction,
  loadStreamingParentClassesAction,
  loadStreamingWorkspaceAction,
  saveStreamingRulesAction,
} from "./actions";

type BulkSelectionBarState = {
  count: number;
  canApply: boolean;
  message: string | null;
  helperText: string | null;
  showControls: boolean;
  eligibleIds: string[];
};

type BulkApplyEligibility = {
  withoutResults: EnrichedStreamingStudent[];
  eligible: EnrichedStreamingStudent[];
  skippedAlreadyPlaced: EnrichedStreamingStudent[];
};

const DIVISION_OPTIONS = DIVISION_ONLY_RULE_DIVISIONS;

function academicYearOptions(): string[] {
  const current = currentAcademicYear();
  const years: string[] = [];
  for (let y = current - 2; y <= current + 1; y += 1) {
    years.push(String(y));
  }
  return years;
}

function buildExampleNumericRules(
  streamClasses: StreamingStreamClass[]
): NumericStreamingRule[] {
  if (streamClasses.length === 0) return [];
  if (streamClasses.length === 1) {
    return [{ targetClassId: streamClasses[0]!.id, min: 0, max: 100 }];
  }
  if (streamClasses.length === 2) {
    return [
      { targetClassId: streamClasses[0]!.id, min: 50, max: 100 },
      { targetClassId: streamClasses[1]!.id, min: 0, max: 49.99 },
    ];
  }
  return [
    { targetClassId: streamClasses[0]!.id, min: 70, max: 100 },
    { targetClassId: streamClasses[1]!.id, min: 50, max: 69.99 },
    {
      targetClassId: streamClasses[streamClasses.length - 1]!.id,
      min: 0,
      max: 49.99,
    },
  ];
}

function buildExampleNectaPointsRules(
  streamClasses: StreamingStreamClass[]
): StreamingRuleEntry[] {
  if (streamClasses.length === 0) return [];
  if (streamClasses.length === 1) {
    return [
      {
        mode: "necta_points",
        targetClassId: streamClasses[0]!.id,
        division: "I",
        minPoints: 7,
        maxPoints: 17,
      },
      {
        mode: "division_only",
        targetClassId: streamClasses[0]!.id,
        divisions: ["II", "III", "IV", "0", "INC", "ABS"],
      },
    ];
  }
  if (streamClasses.length === 2) {
    return [
      {
        mode: "necta_points",
        targetClassId: streamClasses[0]!.id,
        division: "I",
        minPoints: 7,
        maxPoints: 12,
      },
      {
        mode: "necta_points",
        targetClassId: streamClasses[0]!.id,
        division: "I",
        minPoints: 13,
        maxPoints: 17,
      },
      {
        mode: "division_only",
        targetClassId: streamClasses[1]!.id,
        divisions: ["II", "III", "IV", "0", "INC", "ABS"],
      },
    ];
  }
  return [
    {
      mode: "necta_points",
      targetClassId: streamClasses[0]!.id,
      division: "I",
      minPoints: 7,
      maxPoints: 12,
    },
    {
      mode: "necta_points",
      targetClassId: streamClasses[1]!.id,
      division: "I",
      minPoints: 13,
      maxPoints: 17,
    },
    {
      mode: "necta_points",
      targetClassId: streamClasses[1]!.id,
      division: "II",
      minPoints: 18,
      maxPoints: 21,
    },
    {
      mode: "division_only",
      targetClassId: streamClasses[streamClasses.length - 1]!.id,
      divisions: ["III", "IV", "0", "INC", "ABS"],
    },
  ];
}

function buildExampleCustomPointsRules(
  streamClasses: StreamingStreamClass[]
): StreamingRuleEntry[] {
  if (streamClasses.length === 0) return [];
  if (streamClasses.length === 1) {
    return [
      {
        mode: "custom_points",
        targetClassId: streamClasses[0]!.id,
        division: "I",
        minPoints: 7,
        maxPoints: 10,
      },
      {
        mode: "division_only",
        targetClassId: streamClasses[0]!.id,
        divisions: ["II", "III", "IV", "0", "INC", "ABS"],
      },
    ];
  }
  if (streamClasses.length === 2) {
    return [
      {
        mode: "custom_points",
        targetClassId: streamClasses[0]!.id,
        division: "I",
        minPoints: 7,
        maxPoints: 10,
      },
      {
        mode: "custom_points",
        targetClassId: streamClasses[1]!.id,
        division: "I",
        minPoints: 11,
        maxPoints: 17,
      },
      {
        mode: "division_only",
        targetClassId: streamClasses[1]!.id,
        divisions: ["II", "III", "IV", "0", "INC", "ABS"],
      },
    ];
  }
  return [
    {
      mode: "custom_points",
      targetClassId: streamClasses[0]!.id,
      division: "I",
      minPoints: 7,
      maxPoints: 10,
    },
    {
      mode: "custom_points",
      targetClassId: streamClasses[1]!.id,
      division: "I",
      minPoints: 11,
      maxPoints: 17,
    },
    {
      mode: "custom_points",
      targetClassId: streamClasses[1]!.id,
      division: "II",
      minPoints: 18,
      maxPoints: 21,
    },
    {
      mode: "division_only",
      targetClassId: streamClasses[streamClasses.length - 1]!.id,
      divisions: ["III", "IV", "0", "INC", "ABS"],
    },
  ];
}

function buildExampleDivisionRules(
  streamClasses: StreamingStreamClass[]
): DivisionStreamingRule[] {
  if (streamClasses.length === 0) return [];
  if (streamClasses.length === 1) {
    return [
      {
        targetClassId: streamClasses[0]!.id,
        divisions: ["I", "II", "III", "IV", "0", "INC", "ABS"],
      },
    ];
  }
  if (streamClasses.length === 2) {
    return [
      { targetClassId: streamClasses[0]!.id, divisions: ["I"] },
      {
        targetClassId: streamClasses[1]!.id,
        divisions: ["II", "III", "IV", "0", "INC", "ABS"],
      },
    ];
  }
  return [
    { targetClassId: streamClasses[0]!.id, divisions: ["I"] },
    { targetClassId: streamClasses[1]!.id, divisions: ["II"] },
    {
      targetClassId: streamClasses[streamClasses.length - 1]!.id,
      divisions: ["III", "IV", "0", "INC", "ABS"],
    },
  ];
}

type PlacementPreviewRow = StreamingPlacementPreview;

function PlacementPreviewChange({
  incomingCount,
  leavingCount,
}: {
  incomingCount: number;
  leavingCount: number;
}) {
  const base =
    "inline-flex h-7 min-w-[5.5rem] items-center justify-center rounded-md border px-2.5 text-xs font-semibold tabular-nums leading-none whitespace-nowrap";

  if (incomingCount === 0 && leavingCount === 0) {
    return (
      <span
        className={`${base} border-slate-200 bg-slate-100/80 font-medium text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400`}
      >
        No change
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {incomingCount > 0 && (
        <span
          className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200`}
        >
          +{incomingCount} Joining
        </span>
      )}
      {leavingCount > 0 && (
        <span
          className={`${base} border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200`}
        >
          -{leavingCount} Leaving
        </span>
      )}
    </div>
  );
}

function PlacementStreamCard({
  row,
  isActive,
  onSelect,
}: {
  row: PlacementPreviewRow;
  isActive: boolean;
  onSelect: (streamId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row.targetClassId)}
      className={`flex h-full w-full flex-col rounded-xl border bg-white px-3 py-3 text-left transition-[border-color,box-shadow] duration-150 dark:bg-zinc-900/60 ${
        isActive
          ? "border-slate-400 ring-1 ring-slate-300/80 dark:border-zinc-500 dark:ring-zinc-600"
          : row.isOverCapacity
            ? "border-amber-200/90 hover:border-amber-300 hover:shadow-sm dark:border-amber-900/50 dark:hover:border-amber-800"
            : "border-slate-200/80 hover:border-school-primary/20 hover:shadow-sm dark:border-zinc-700/80"
      }`}
      aria-pressed={isActive}
      aria-label={`Filter students for ${row.targetClassName}`}
    >
      <h3
        className="truncate text-sm font-bold text-slate-900 dark:text-zinc-50"
        title={row.targetClassName}
      >
        {row.targetClassName}
      </h3>

      <p className="mt-2 text-2xl font-semibold tabular-nums leading-none text-slate-900 dark:text-zinc-50">
        {row.finalTotal}
      </p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
        After Placement
      </p>

      <p className="mt-3 text-[11px] tabular-nums text-slate-500 dark:text-zinc-400">
        Current:{" "}
        <span className="font-medium text-slate-700 dark:text-zinc-300">
          {row.currentOccupancy}
        </span>
      </p>

      <div className="mt-auto pt-3">
        <PlacementPreviewChange
          incomingCount={row.incomingCount}
          leavingCount={row.leavingCount}
        />
      </div>
    </button>
  );
}

const STREAM_CHIP_CLASS =
  "inline-flex h-6 min-w-[4.75rem] max-w-[8.5rem] items-center justify-center truncate rounded-full border px-2.5 text-[11px] font-medium leading-none";

const PLACEMENT_TARGET_SELECT_CLASS =
  "h-6 w-full max-w-[8.5rem] rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-medium leading-none text-slate-700 transition-colors duration-150 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";

const ACTION_CELL =
  "inline-flex h-6 w-[3.25rem] shrink-0 items-center justify-center rounded-md text-[11px] font-medium leading-none tabular-nums transition-colors duration-150";

const ROW_HOVER_CLASS =
  "border-t border-slate-200/40 transition-colors duration-200 ease-out hover:bg-slate-50/70 dark:border-zinc-800/50 dark:hover:bg-zinc-800/20";

const TABLE_HEADER_CLASS =
  "px-2 py-2 font-semibold uppercase tracking-[0.06em] text-slate-600 dark:text-zinc-400";

const MUTED_CELL_CLASS =
  "text-[11px] font-normal text-slate-400 dark:text-zinc-500";

function DivisionPerformanceCell({
  performance,
  divisionRuleMode,
}: {
  performance: StudentStreamingPerformance;
  divisionRuleMode: DivisionRuleMode;
}) {
  const display = getDivisionTableDisplay(performance, divisionRuleMode);
  if (!display) {
    return <span className={MUTED_CELL_CLASS}>—</span>;
  }
  if (
    display.points == null &&
    (display.label === "INC" || display.label === "ABS")
  ) {
    return (
      <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
        {display.label}
      </span>
    );
  }
  return (
    <div className="leading-tight">
      <div className="text-[11px] font-semibold text-slate-900 dark:text-zinc-100">
        {display.label}
      </div>
      {display.points != null && (
        <div className="text-[10px] tabular-nums text-slate-500 dark:text-zinc-400">
          {display.points} pts
        </div>
      )}
    </div>
  );
}

const PAGINATION_BUTTON_CLASS =
  "inline-flex h-7 min-w-[4.5rem] items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors duration-150 hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

const STREAMING_RULES_EXPANDED_KEY = "adakaro-streaming-rules-expanded";

type StudentStatusFilter =
  | "correct"
  | "need_action"
  | "no_result"
  | "override";

function matchesStatusFilter(
  status: StreamingPlacementStatus,
  filter: StudentStatusFilter | null
): boolean {
  if (!filter) return true;
  switch (filter) {
    case "correct":
      return status === "placed";
    case "need_action":
      return status === "needs_transfer" || status === "unassigned";
    case "no_result":
      return status === "no_result";
    case "override":
      return status === "manual_override";
    default:
      return true;
  }
}

function matchesStudentSearch(
  student: { fullName: string; admissionNumber: string | null },
  query: string
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const q = trimmed.toLowerCase();
  if (student.fullName.toLowerCase().includes(q)) return true;
  if (student.admissionNumber?.toLowerCase().includes(q)) return true;
  return false;
}

function StreamPill({
  name,
  variant = "neutral",
}: {
  name: string;
  variant?: "neutral" | "recommended";
}) {
  if (variant === "recommended") {
    return (
      <span
        className={`${STREAM_CHIP_CLASS} border-violet-200/90 bg-violet-50/90 text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/35 dark:text-violet-200`}
        title={name}
      >
        {name}
      </span>
    );
  }

  return (
    <span
      className="inline-block max-w-[8rem] truncate text-[11px] text-slate-600 dark:text-zinc-400"
      title={name}
    >
      {name}
    </span>
  );
}

function PlacementStatusBadge({
  status,
}: {
  status: StreamingPlacementStatus;
}) {
  const config: Record<StreamingPlacementStatus, { label: string; classes: string }> =
    {
      placed: {
        label: "Correct Stream",
        classes:
          "border-emerald-300/70 bg-emerald-100/80 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-100",
      },
      needs_transfer: {
        label: "Needs Placement",
        classes:
          "border-amber-300/70 bg-amber-100/80 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100",
      },
      unassigned: {
        label: "Needs Placement",
        classes:
          "border-amber-300/70 bg-amber-100/80 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100",
      },
      manual_override: {
        label: "Manual Change",
        classes:
          "border-violet-200/80 bg-violet-50/90 text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-200",
      },
      no_result: {
        label: "No Exam Result",
        classes:
          "border-yellow-200/50 bg-yellow-50/60 text-yellow-800/80 dark:border-yellow-900/20 dark:bg-yellow-950/15 dark:text-yellow-200/80",
      },
    };

  const { label, classes } = config[status];

  return (
    <span
      className={`inline-flex h-6 items-center rounded-md border px-2.5 text-[11px] font-medium leading-none whitespace-nowrap ${classes}`}
    >
      {label}
    </span>
  );
}

function SummaryKpiCard({
  label,
  value,
  isActive = false,
  onClick,
}: {
  label: string;
  value: number;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const className = `flex min-h-[3rem] flex-col justify-center rounded-md border bg-slate-50/40 px-2.5 py-2.5 text-left transition-[border-color,background-color] duration-150 dark:bg-zinc-900/25 ${
    isActive
      ? "border-slate-300 bg-white ring-1 ring-slate-200/70 dark:border-zinc-600 dark:bg-zinc-900/50 dark:ring-zinc-700/80"
      : "border-slate-200/60 hover:border-slate-300/80 hover:bg-white dark:border-zinc-700/50 dark:hover:border-zinc-600/80"
  } ${onClick ? "cursor-pointer" : ""}`;

  const content = (
    <>
      <p className="text-xl font-semibold leading-none tabular-nums text-slate-800 dark:text-zinc-100">
        {value}
      </p>
      <p className="mt-1.5 truncate text-xs font-medium leading-snug text-slate-600 dark:text-zinc-400">
        {label}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function hasPendingPlacementChange(
  student: { id: string; currentClassId: string },
  pendingTargets: Record<string, string>
): boolean {
  const pendingTarget = pendingTargets[student.id];
  return pendingTarget != null && pendingTarget !== student.currentClassId;
}

function rowActionType(
  student: {
    id: string;
    currentClassId: string;
    currentStreamName: string;
    ruleRecommendedId: string | null;
    effectivePlacementTargetId: string | null;
  },
  streamIds: Set<string>,
  savingStudentIds: Set<string>,
  pendingTargets: Record<string, string>
): "already_correct" | "confirm" | "transfer" | "none" | "saving" {
  if (savingStudentIds.has(student.id)) return "saving";

  if (hasPendingPlacementChange(student, pendingTargets)) {
    if (
      student.currentStreamName === "Unassigned" ||
      !streamIds.has(student.currentClassId)
    ) {
      return "confirm";
    }
    return "transfer";
  }

  if (
    student.ruleRecommendedId &&
    student.currentClassId === student.ruleRecommendedId
  ) {
    return "already_correct";
  }

  const applyTarget =
    student.ruleRecommendedId ?? student.effectivePlacementTargetId;
  if (!applyTarget) return "none";
  if (student.currentClassId === applyTarget) return "already_correct";

  if (
    student.currentStreamName === "Unassigned" ||
    !streamIds.has(student.currentClassId)
  ) {
    return "confirm";
  }
  return "transfer";
}

function displayPlacementStatus(
  student: {
    id: string;
    currentClassId: string;
    ruleRecommendedId: string | null;
    placementStatus: StreamingPlacementStatus;
  },
  pendingTargets: Record<string, string>
): StreamingPlacementStatus {
  const pendingTarget = pendingTargets[student.id];
  if (
    pendingTarget != null &&
    pendingTarget !== student.currentClassId
  ) {
    const isManual =
      student.ruleRecommendedId != null &&
      pendingTarget !== student.ruleRecommendedId;
    return isManual ? "manual_override" : "needs_transfer";
  }
  return student.placementStatus;
}

function getRowPlacementTargetId(
  student: { id: string; effectivePlacementTargetId: string | null },
  pendingTargets: Record<string, string>
): string | null {
  return pendingTargets[student.id] ?? student.effectivePlacementTargetId ?? null;
}

function resolveApplyTargetId(
  student: {
    id: string;
    effectivePlacementTargetId: string | null;
    ruleRecommendedId: string | null;
  },
  pendingTargets: Record<string, string>,
  bulkTargetClassId?: string
): string | null {
  const explicitPending = pendingTargets[student.id];
  if (explicitPending != null) {
    return explicitPending;
  }
  if (bulkTargetClassId) {
    return bulkTargetClassId;
  }
  return (
    student.effectivePlacementTargetId ?? student.ruleRecommendedId ?? null
  );
}

function getBulkDisplayStatus(
  student: EnrichedStreamingStudent,
  pendingTargets: Record<string, string>
): StreamingPlacementStatus {
  return displayPlacementStatus(student, pendingTargets);
}

function isBulkAlreadyPlaced(
  student: EnrichedStreamingStudent,
  pendingTargets: Record<string, string>
): boolean {
  return getBulkDisplayStatus(student, pendingTargets) === "placed";
}

function isBulkEligibleStudent(
  student: EnrichedStreamingStudent,
  pendingTargets: Record<string, string>
): boolean {
  const status = getBulkDisplayStatus(student, pendingTargets);
  if (status === "no_result" || status === "placed") {
    return false;
  }
  return (
    status === "needs_transfer" ||
    status === "unassigned" ||
    status === "manual_override"
  );
}

function getBulkApplyEligibility(params: {
  selectedStudents: EnrichedStreamingStudent[];
  pendingTargets: Record<string, string>;
}): BulkApplyEligibility {
  const { selectedStudents, pendingTargets } = params;
  const withoutResults = selectedStudents.filter(
    (s) => getBulkDisplayStatus(s, pendingTargets) === "no_result"
  );
  const skippedAlreadyPlaced = selectedStudents.filter((s) =>
    isBulkAlreadyPlaced(s, pendingTargets)
  );
  const eligible = selectedStudents.filter((s) =>
    isBulkEligibleStudent(s, pendingTargets)
  );

  return { withoutResults, eligible, skippedAlreadyPlaced };
}

function formatBulkApplyHelperText(
  eligibleCount: number,
  skippedPlacedCount: number
): string | null {
  if (eligibleCount === 0 || skippedPlacedCount === 0) {
    return null;
  }
  const placedLabel =
    eligibleCount === 1 ? "1 student will be placed." : `${eligibleCount} students will be placed.`;
  const skippedLabel =
    skippedPlacedCount === 1
      ? "1 already placed will be skipped."
      : `${skippedPlacedCount} already placed will be skipped.`;
  return `${placedLabel} ${skippedLabel}`;
}

function resolveBulkSelectionBarState(params: {
  selectedStudents: EnrichedStreamingStudent[];
  pendingTargets: Record<string, string>;
  bulkTargetClassId: string;
  canPlace: boolean;
}): BulkSelectionBarState {
  const { selectedStudents, pendingTargets, bulkTargetClassId, canPlace } =
    params;
  const count = selectedStudents.length;
  const { withoutResults, eligible, skippedAlreadyPlaced } =
    getBulkApplyEligibility({
      selectedStudents,
      pendingTargets,
    });

  if (withoutResults.length > 0) {
    const message =
      withoutResults.length === count && count === 1
        ? "Selected student has no exam result."
        : "Some selected students have no exam result.";
    return {
      count,
      canApply: false,
      message,
      helperText: null,
      showControls: false,
      eligibleIds: [],
    };
  }

  if (eligible.length === 0) {
    const message =
      count === 1
        ? "Selected student is already placed."
        : "Selected students are already placed.";
    return {
      count,
      canApply: false,
      message,
      helperText: null,
      showControls: false,
      eligibleIds: [],
    };
  }

  return {
    count,
    canApply: canPlace && Boolean(bulkTargetClassId),
    message: null,
    helperText: formatBulkApplyHelperText(
      eligible.length,
      skippedAlreadyPlaced.length
    ),
    showControls: true,
    eligibleIds: eligible.map((student) => student.id),
  };
}

function StreamingKpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800"
        aria-hidden
      >
        {icon}
      </span>
      <div>
        <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-zinc-50">
          {value}
        </p>
        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
          {label}
        </p>
      </div>
    </div>
  );
}

function emptyNumericRule(
  streamClasses: StreamingStreamClass[]
): NumericStreamingRule {
  return {
    targetClassId: streamClasses[0]?.id ?? "",
    min: 0,
    max: 100,
  };
}

function emptyDivisionRule(
  streamClasses: StreamingStreamClass[]
): DivisionStreamingRule {
  return {
    mode: "division_only",
    targetClassId: streamClasses[0]?.id ?? "",
    divisions: ["I"],
  };
}

function emptyDivisionPointsRule(
  streamClasses: StreamingStreamClass[],
  mode: "necta_points" | "custom_points"
): DivisionPointsStreamingRule {
  return {
    mode,
    targetClassId: streamClasses[0]?.id ?? "",
    division: "I",
    minPoints: mode === "custom_points" ? 7 : 7,
    maxPoints: mode === "custom_points" ? 10 : 12,
  };
}

export function StudentStreamingClient({
  initialAcademicYear,
}: {
  initialAcademicYear: string;
}) {
  const router = useRouter();
  const [parentClasses, setParentClasses] = useState<
    StreamingParentClassOption[]
  >([]);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [academicYear, setAcademicYear] = useState(initialAcademicYear);
  const [parentClassId, setParentClassId] = useState("");
  const [examType, setExamType] = useState("");
  const [performanceMeasure, setPerformanceMeasure] =
    useState<StreamingPerformanceMeasure>("average_score");

  const [stats, setStats] = useState<StreamingOverviewStats>({
    totalEligible: 0,
    alreadyStreamed: 0,
    awaitingPlacement: 0,
    availableStreams: 0,
    lastStreamingActivityAt: null,
  });
  const [students, setStudents] = useState<StreamingStudentRow[]>([]);
  const [streamClasses, setStreamClasses] = useState<StreamingStreamClass[]>([]);
  const [examOptions, setExamOptions] = useState<StreamingExamOption[]>([]);
  const [rules, setRules] = useState<StreamingRuleEntry[]>([]);
  const [divisionRuleMode, setDivisionRuleMode] =
    useState<DivisionRuleMode>("division_only");
  const [schoolLevel, setSchoolLevel] = useState<string | null>(null);
  const [nectaGuideExpanded, setNectaGuideExpanded] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetClassId, setBulkTargetClassId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"default" | "recommended">(
    "default"
  );
  const [confirmMeta, setConfirmMeta] = useState<{
    skippedNoResult?: number;
    skippedNoRule?: number;
    bulkTargetStreamName?: string;
    noPendingChanges?: boolean;
    noResultManual?: boolean;
    studentName?: string;
    individualDetail?: {
      studentName: string;
      currentStreamName: string;
      targetStreamName: string;
      reason: string;
      actionType: "transfer" | "confirm";
    };
  }>({});
  const [pendingPlacements, setPendingPlacements] = useState<
    { studentId: string; targetClassId: string; targetClassName: string }[]
  >([]);
  const [applying, setApplying] = useState(false);
  const [compatibilityModalOpen, setCompatibilityModalOpen] = useState(false);
  const [compatibilityModalMode, setCompatibilityModalMode] = useState<
    "warning" | "blocked"
  >("warning");
  const [compatibilityResult, setCompatibilityResult] =
    useState<SubjectCompatibilityBatchResult | null>(null);
  const [savingStudentIds, setSavingStudentIds] = useState<Set<string>>(
    new Set()
  );
  const [savingRules, setSavingRules] = useState(false);
  const [previewStreamFilter, setPreviewStreamFilter] = useState<string | null>(
    null
  );
  const [studentSearch, setStudentSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter | null>(
    null
  );
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [rulesExpanded, setRulesExpanded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STREAMING_RULES_EXPANDED_KEY);
      if (stored === "true") {
        setRulesExpanded(true);
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const toggleRulesExpanded = () => {
    setRulesExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STREAMING_RULES_EXPANDED_KEY, String(next));
      } catch {
        // ignore localStorage errors
      }
      return next;
    });
  };

  useEffect(() => {
    void (async () => {
      setLoadingInit(true);
      const result = await loadStreamingParentClassesAction();
      setLoadingInit(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setParentClasses(result.classes);
      setIsCoordinator(result.isCoordinator);
      if (result.classes.length > 0 && !parentClassId) {
        setParentClassId(result.classes[0]!.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (!parentClassId) return;
    setLoadingData(true);
    setError(null);
    const result = await loadStreamingWorkspaceAction({
      parentClassId,
      academicYear,
      examType,
      performanceMeasure,
    });
    setLoadingData(false);
    if (!result.ok) {
      setError(result.error);
      setStudents([]);
      return;
    }
    setStats(result.stats);
    setStudents(result.students);
    setStreamClasses(result.streamClasses);
    setExamOptions(result.examOptions);
    setRules(result.rules);
    setSchoolLevel(result.schoolLevel);
    setDivisionRuleMode(
      result.divisionRuleMode ??
        inferDivisionRuleMode(result.rules)
    );
    setOverrides({});
    setSelectedIds(new Set());
    setPreviewStreamFilter(null);
    setStudentSearch("");
    setStatusFilter(null);
    setCurrentPage(1);
    if (!examType && result.examOptions[0]) {
      setExamType(result.examOptions[0].examType);
    }
    if (!bulkTargetClassId && result.streamClasses[0]) {
      setBulkTargetClassId(result.streamClasses[0].id);
    }
  }, [parentClassId, academicYear, examType, performanceMeasure]);

  const reloadStreamingDataFromServer = useCallback(async () => {
    if (!parentClassId) return false;
    const result = await loadStreamingWorkspaceAction({
      parentClassId,
      academicYear,
      examType,
      performanceMeasure,
    });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setStats(result.stats);
    setStudents(result.students);
    setStreamClasses(result.streamClasses);
    setExamOptions(result.examOptions);
    setRules(result.rules);
    setSchoolLevel(result.schoolLevel);
    setDivisionRuleMode(
      result.divisionRuleMode ??
        inferDivisionRuleMode(result.rules)
    );
    setOverrides({});
    setSelectedIds(new Set());
    setPreviewStreamFilter(null);
    if (!examType && result.examOptions[0]) {
      setExamType(result.examOptions[0].examType);
    }
    if (!bulkTargetClassId && result.streamClasses[0]) {
      setBulkTargetClassId(result.streamClasses[0].id);
    }
    return true;
  }, [
    parentClassId,
    academicYear,
    examType,
    performanceMeasure,
    bulkTargetClassId,
  ]);

  useEffect(() => {
    if (parentClassId) void refreshWorkspace();
  }, [parentClassId, academicYear, examType, performanceMeasure, refreshWorkspace]);

  const streamNameById = useMemo(() => {
    const map = new Map(streamClasses.map((s) => [s.id, s.name]));
    for (const s of students) {
      if (!map.has(s.currentClassId)) {
        map.set(s.currentClassId, s.currentClassName);
      }
    }
    return map;
  }, [streamClasses, students]);

  const streamIds = useMemo(
    () => new Set(streamClasses.map((s) => s.id)),
    [streamClasses]
  );

  const effectiveDivisionRuleMode = useMemo(
    () =>
      performanceMeasure === "division"
        ? resolveDivisionRuleMode(divisionRuleMode, rules)
        : "division_only",
    [performanceMeasure, divisionRuleMode, rules]
  );

  const activeRulesForMode = useMemo(
    () =>
      performanceMeasure === "division"
        ? filterRulesForDivisionMode(rules, effectiveDivisionRuleMode)
        : rules,
    [performanceMeasure, rules, effectiveDivisionRuleMode]
  );

  const placementResults = useMemo(
    () =>
      computeStreamingPlacementResults({
        students,
        rules,
        overrides,
        streamClasses,
        performanceMeasure,
        divisionRuleMode: effectiveDivisionRuleMode,
      }),
    [
      students,
      rules,
      overrides,
      streamClasses,
      performanceMeasure,
      effectiveDivisionRuleMode,
    ]
  );

  const enrichedStudents = placementResults.students;
  const streamingSummary = placementResults.summary;
  const preview = placementResults.streamPreviews;
  const previewImpact = placementResults.impact;

  const rankedStudents = useMemo(() => {
    const withRanks = assignStudentRanks(
      enrichedStudents,
      performanceMeasure,
      effectiveDivisionRuleMode
    );
    return [...withRanks].sort((a, b) => {
      if (a.rank == null && b.rank == null) {
        return a.fullName.localeCompare(b.fullName, undefined, {
          sensitivity: "base",
        });
      }
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.fullName.localeCompare(b.fullName, undefined, {
        sensitivity: "base",
      });
    });
  }, [enrichedStudents, performanceMeasure, effectiveDivisionRuleMode]);

  const displayedStudents = useMemo(() => {
    if (!previewStreamFilter) return rankedStudents;
    return rankedStudents.filter((s) =>
      studentRelatesToStream(s, previewStreamFilter)
    );
  }, [rankedStudents, previewStreamFilter]);

  const filteredStudents = useMemo(() => {
    return displayedStudents.filter(
      (s) =>
        matchesStudentSearch(s, studentSearch) &&
        matchesStatusFilter(s.placementStatus, statusFilter)
    );
  }, [displayedStudents, studentSearch, statusFilter]);

  const totalFiltered = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize) || 1);
  const effectivePage = Math.min(currentPage, totalPages);

  const paginatedStudents = useMemo(() => {
    const start = (effectivePage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, effectivePage, pageSize]);

  const paginationRange = useMemo(() => {
    if (totalFiltered === 0) {
      return { start: 0, end: 0 };
    }
    const start = (effectivePage - 1) * pageSize + 1;
    const end = Math.min(effectivePage * pageSize, totalFiltered);
    return { start, end };
  }, [totalFiltered, effectivePage, pageSize]);

  const pageStudentIds = useMemo(
    () => paginatedStudents.map((s) => s.id),
    [paginatedStudents]
  );

  const allPageSelected =
    pageStudentIds.length > 0 &&
    pageStudentIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    setCurrentPage(1);
  }, [studentSearch, statusFilter, previewStreamFilter, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const toggleStatusFilter = (filter: StudentStatusFilter) => {
    setStatusFilter((current) => (current === filter ? null : filter));
  };

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of pageStudentIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const previewStreamFilterName = previewStreamFilter
    ? (streamNameById.get(previewStreamFilter) ?? null)
    : null;

  const handlePreviewStreamSelect = (streamId: string) => {
    setPreviewStreamFilter((current) =>
      current === streamId ? null : streamId
    );
  };

  const canPlace = streamClasses.length > 0 && Boolean(examType);
  const selectedParent = parentClasses.find((c) => c.id === parentClassId);

  const bulkSelectionBar = useMemo((): BulkSelectionBarState | null => {
    if (selectedIds.size === 0) return null;
    const selectedStudents = enrichedStudents.filter((s) =>
      selectedIds.has(s.id)
    );
    return resolveBulkSelectionBarState({
      selectedStudents,
      pendingTargets: overrides,
      bulkTargetClassId,
      canPlace,
    });
  }, [
    selectedIds,
    enrichedStudents,
    overrides,
    bulkTargetClassId,
    canPlace,
  ]);

  const isSecondarySchool = schoolLevel === "secondary";

  const rulesOverlapWarning = useMemo(() => {
    if (performanceMeasure !== "division") return null;
    if (!isPointsBasedDivisionMode(effectiveDivisionRuleMode)) return null;
    return detectOverlappingDivisionPointsRules(activeRulesForMode);
  }, [
    performanceMeasure,
    effectiveDivisionRuleMode,
    activeRulesForMode,
  ]);

  const applyExampleRules = () => {
    if (streamClasses.length === 0) {
      toast.error("Add stream classes before defining rules.");
      return;
    }
    if (performanceMeasure === "division") {
      if (divisionRuleMode === "necta_points" && isSecondarySchool) {
        setRules(buildExampleNectaPointsRules(streamClasses));
      } else if (divisionRuleMode === "custom_points" && isSecondarySchool) {
        setRules(buildExampleCustomPointsRules(streamClasses));
      } else {
        setRules(buildExampleDivisionRules(streamClasses));
      }
      return;
    }
    setRules(buildExampleNumericRules(streamClasses));
  };
  const capacityWarnings = useMemo(
    () =>
      buildCapacityWarnings(streamClasses, students, pendingPlacements),
    [streamClasses, students, pendingPlacements]
  );

  const handleSaveRules = async () => {
    if (!parentClassId || !examType) {
      toast.error("Select an exam before saving rules.");
      return;
    }
    if (rules.length === 0) {
      toast.error("Add at least one rule before saving.");
      return;
    }
    if (rulesOverlapWarning) {
      toast.error(rulesOverlapWarning);
      return;
    }
    if (
      performanceMeasure === "division" &&
      isPointsBasedDivisionMode(divisionRuleMode) &&
      !isSecondarySchool
    ) {
      toast.error(
        "Points-based division rules are only available for secondary schools."
      );
      return;
    }
    setSavingRules(true);
    const result = await saveStreamingRulesAction({
      parentClassId,
      academicYear,
      examType,
      performanceMeasure,
      rules,
      divisionRuleMode: effectiveDivisionRuleMode,
    });
    setSavingRules(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Streaming rules saved.");
  };

  const buildPlacementsFromSelection = (
    ids: string[],
    bulkTargetClassId?: string,
    pendingTargets: Record<string, string> = overridesRef.current
  ) => {
    return ids
      .map((studentId) => {
        const student = enrichedStudents.find((s) => s.id === studentId);
        if (!student) return null;
        const targetClassId = resolveApplyTargetId(
          student,
          pendingTargets,
          bulkTargetClassId
        );
        if (!targetClassId || student.currentClassId === targetClassId) {
          return null;
        }
        const targetClassName =
          streamNameById.get(targetClassId) ?? "Unknown";
        return { studentId, targetClassId, targetClassName };
      })
      .filter(
        (p): p is { studentId: string; targetClassId: string; targetClassName: string } =>
          p != null
      );
  };

  const buildPlacementsForPendingSelection = (
    ids: string[],
    pendingTargets: Record<string, string> = overridesRef.current
  ) => {
    return ids
      .map((studentId) => {
        const student = enrichedStudents.find((s) => s.id === studentId);
        if (!student || !hasPendingPlacementChange(student, pendingTargets)) {
          return null;
        }
        const targetClassId = pendingTargets[studentId]!;
        const targetClassName =
          streamNameById.get(targetClassId) ?? "Unknown";
        return { studentId, targetClassId, targetClassName };
      })
      .filter(
        (p): p is { studentId: string; targetClassId: string; targetClassName: string } =>
          p != null
      );
  };

  const openConfirmForPlacements = (
    placements: {
      studentId: string;
      targetClassId: string;
      targetClassName: string;
    }[],
    mode: "default" | "recommended" = "default",
    meta: {
      skippedNoResult?: number;
      skippedNoRule?: number;
      bulkTargetStreamName?: string;
      noPendingChanges?: boolean;
      noResultManual?: boolean;
      studentName?: string;
      individualDetail?: {
        studentName: string;
        currentStreamName: string;
        targetStreamName: string;
        reason: string;
        actionType: "transfer" | "confirm";
      };
    } = {}
  ) => {
    if (placements.length === 0) {
      if ((meta.skippedNoResult ?? 0) > 0 || (meta.skippedNoRule ?? 0) > 0) {
        toast.message(
          `No eligible placements. ${meta.skippedNoResult ?? 0} without results, ${meta.skippedNoRule ?? 0} without matching rules.`
        );
      } else if (meta.noPendingChanges) {
        toast.message("No placement changes to apply.");
      } else {
        toast.message("Unable to apply the selected placement.");
      }
      return;
    }
    setConfirmMode(mode);
    setConfirmMeta(meta);
    setPendingPlacements(placements);
    setConfirmOpen(true);
  };

  const handleBulkApply = () => {
    const pendingTargets = overridesRef.current;
    const selected = enrichedStudents.filter((s) => selectedIds.has(s.id));
    if (selected.length === 0) {
      toast.error("Select at least one student.");
      return;
    }
    const barState = resolveBulkSelectionBarState({
      selectedStudents: selected,
      pendingTargets,
      bulkTargetClassId,
      canPlace,
    });
    if (!barState.canApply || barState.eligibleIds.length === 0) {
      if (barState.message) toast.message(barState.message);
      return;
    }
    if (!bulkTargetClassId) {
      toast.error("Choose a target stream.");
      return;
    }

    const targetStreamName =
      streamNameById.get(bulkTargetClassId) ?? "Unknown";
    const placements = barState.eligibleIds
      .map((studentId) => {
        const student = enrichedStudents.find((s) => s.id === studentId);
        if (!student || student.currentClassId === bulkTargetClassId) {
          return null;
        }
        return {
          studentId,
          targetClassId: bulkTargetClassId,
          targetClassName: targetStreamName,
        };
      })
      .filter(
        (p): p is { studentId: string; targetClassId: string; targetClassName: string } =>
          p != null
      );
    if (placements.length === 0) {
      toast.message("No placement changes to apply.");
      return;
    }
    openConfirmForPlacements(placements, "default", {
      skippedNoResult: 0,
      bulkTargetStreamName: targetStreamName,
    });
  };

  const handleApplyRecommended = () => {
    const selected = enrichedStudents.filter((s) => selectedIds.has(s.id));
    const skippedNoResult = selected.filter((s) => !s.hasExamResult).length;
    const skippedNoRule = selected.filter(
      (s) => s.hasExamResult && !s.ruleRecommendedId
    ).length;
    const placements = selected
      .filter(
        (s) =>
          s.hasExamResult &&
          s.ruleRecommendedId &&
          s.currentClassId !== s.ruleRecommendedId
      )
      .map((s) => ({
        studentId: s.id,
        targetClassId: s.ruleRecommendedId!,
        targetClassName: s.ruleRecommendedName ?? "Unknown",
      }));
    openConfirmForPlacements(placements, "recommended", {
      skippedNoResult,
      skippedNoRule,
    });
  };

  const handleIndividualAssign = (
    studentId: string,
    selectedTargetClassId?: string | null
  ) => {
    const pendingTargets = overridesRef.current;
    const student = enrichedStudents.find((s) => s.id === studentId);
    if (!student) return;

    const hasPending = hasPendingPlacementChange(student, pendingTargets);
    const targetClassId =
      pendingTargets[studentId] ??
      selectedTargetClassId ??
      student.effectivePlacementTargetId ??
      student.ruleRecommendedId ??
      null;

    if (!targetClassId || student.currentClassId === targetClassId) {
      openConfirmForPlacements([], "default", {
        noPendingChanges: !hasPending,
      });
      return;
    }
    const targetStreamName =
      streamNameById.get(targetClassId) ?? "Unknown";
    const meta: {
      skippedNoResult?: number;
      noResultManual?: boolean;
      studentName?: string;
      individualDetail?: {
        studentName: string;
        currentStreamName: string;
        targetStreamName: string;
        reason: string;
        actionType: "transfer" | "confirm";
      };
    } = {};

    const actionType =
      student &&
      (student.currentStreamName === "Unassigned" ||
        !streamIds.has(student.currentClassId))
        ? "confirm"
        : "transfer";

    if (student && !student.hasExamResult) {
      meta.noResultManual = true;
      meta.studentName = student.fullName;
      meta.skippedNoResult = 1;
      meta.individualDetail = {
        studentName: student.fullName,
        currentStreamName:
          student.currentStreamName === "Unassigned"
            ? "Unassigned"
            : student.currentStreamName,
        targetStreamName,
        reason: "Manual placement — no exam result on record",
        actionType,
      };
    } else if (student) {
      meta.individualDetail = {
        studentName: student.fullName,
        currentStreamName:
          student.currentStreamName === "Unassigned"
            ? "Unassigned"
            : student.currentStreamName,
        targetStreamName,
        reason: formatStreamingPlacementReason(
          performanceMeasure,
          student.performance,
          student.isManualTarget,
          rules,
          effectiveDivisionRuleMode
        ),
        actionType,
      };
    }

    openConfirmForPlacements(
      [
        {
          studentId,
          targetClassId,
          targetClassName: targetStreamName,
        },
      ],
      "default",
      meta
    );
  };

  const setPlacementTarget = (studentId: string, targetClassId: string) => {
    setOverrides((prev) => {
      const student = students.find((s) => s.id === studentId);
      if (student && targetClassId === student.currentClassId) {
        const next = { ...prev };
        delete next[studentId];
        return next;
      }
      return {
        ...prev,
        [studentId]: targetClassId,
      };
    });
  };

  const executePlacement = async (acknowledgeSubjectCompatibilityWarning: boolean) => {
    if (!parentClassId || !examType) return;
    const placementsSnapshot = [...pendingPlacements];
    const savingIds = new Set(placementsSnapshot.map((p) => p.studentId));
    setApplying(true);
    setSavingStudentIds(savingIds);
    try {
      const result = await applyStudentStreamingAction({
        parentClassId,
        academicYear,
        examType,
        performanceMeasure,
        placements: placementsSnapshot.map((p) => ({
          studentId: p.studentId,
          targetClassId: p.targetClassId,
        })),
        acknowledgeSubjectCompatibilityWarning,
      });
      if (!result.ok) {
        if ("requiresSubjectCompatibilityAck" in result) {
          setCompatibilityResult(result.compatibility);
          setCompatibilityModalMode("warning");
          setCompatibilityModalOpen(true);
          return;
        }
        toast.error(result.error);
        return;
      }
      const reloaded = await reloadStreamingDataFromServer();
      if (!reloaded) {
        toast.error(
          "Placement was saved but the page could not refresh. Please reload."
        );
        return;
      }
      router.refresh();
      setConfirmOpen(false);
      setConfirmMode("default");
      setConfirmMeta({});
      setPendingPlacements([]);
      setCompatibilityModalOpen(false);
      setCompatibilityResult(null);
      if (result.warning) {
        toast.warning(result.warning);
      }
      toast.success(result.message);
    } finally {
      setApplying(false);
      setSavingStudentIds(new Set());
    }
  };

  const handleConfirmPlacementClick = async () => {
    if (!parentClassId || !examType || pendingPlacements.length === 0) return;
    setApplying(true);
    try {
      const check = await checkSubjectCompatibilityAction(
        pendingPlacements.map((p) => ({
          studentId: p.studentId,
          targetClassId: p.targetClassId,
        }))
      );
      if (!check.ok) {
        toast.error(check.error);
        return;
      }
      if (check.result.status === "blocked") {
        setCompatibilityResult(check.result);
        setCompatibilityModalMode("blocked");
        setCompatibilityModalOpen(true);
        return;
      }
      if (check.result.status === "warning") {
        setCompatibilityResult(check.result);
        setCompatibilityModalMode("warning");
        setCompatibilityModalOpen(true);
        return;
      }
      await executePlacement(false);
    } finally {
      setApplying(false);
    }
  };

  const confirmSharedStreamSummary = useMemo(() => {
    if (pendingPlacements.length === 0) return null;
    const targetClassId = pendingPlacements[0]?.targetClassId;
    const streamName = pendingPlacements[0]?.targetClassName ?? "";
    if (!targetClassId) return null;
    const singleStream = pendingPlacements.every(
      (p) => p.targetClassId === targetClassId
    );
    if (!singleStream) return null;

    const currentCount = students.filter(
      (s) => s.currentClassId === targetClassId
    ).length;
    let movingCount = 0;
    for (const placement of pendingPlacements) {
      const student = students.find((s) => s.id === placement.studentId);
      if (student && student.currentClassId !== targetClassId) {
        movingCount += 1;
      }
    }

    return {
      streamName,
      count: pendingPlacements.length,
      currentCount,
      movingCount,
      afterCount: currentCount + movingCount,
    };
  }, [pendingPlacements, students]);

  const confirmPreview = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of pendingPlacements) {
      counts.set(p.targetClassName, (counts.get(p.targetClassName) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [pendingPlacements]);

  const confirmCapacityDetails = useMemo(() => {
    const details: {
      streamName: string;
      finalTotal: number;
      capacity: number | null;
      isOverCapacity: boolean;
    }[] = [];

    const targetIds = new Set(pendingPlacements.map((p) => p.targetClassId));
    for (const streamId of targetIds) {
      const stream = streamClasses.find((s) => s.id === streamId);
      if (!stream) continue;
      const currentOccupancy = students.filter(
        (s) => s.currentClassId === streamId
      ).length;
      let incoming = 0;
      for (const p of pendingPlacements) {
        if (p.targetClassId !== streamId) continue;
        const student = students.find((s) => s.id === p.studentId);
        if (student && student.currentClassId !== streamId) incoming += 1;
      }
      const finalTotal = currentOccupancy + incoming;
      details.push({
        streamName: stream.name,
        finalTotal,
        capacity: stream.capacity,
        isOverCapacity:
          stream.capacity != null && finalTotal > stream.capacity,
      });
    }
    return details.sort((a, b) => a.streamName.localeCompare(b.streamName));
  }, [pendingPlacements, streamClasses, students]);

  const addRule = () => {
    if (streamClasses.length === 0) return;
    if (performanceMeasure === "division") {
      if (isPointsBasedDivisionMode(divisionRuleMode) && isSecondarySchool) {
        setRules((prev) => [
          ...prev,
          emptyDivisionPointsRule(streamClasses, divisionRuleMode),
        ]);
      } else {
        setRules((prev) => [...prev, emptyDivisionRule(streamClasses)]);
      }
      return;
    }
    setRules((prev) => [...prev, emptyNumericRule(streamClasses)]);
  };

  const handleDivisionRuleModeChange = (mode: DivisionRuleMode) => {
    if (isPointsBasedDivisionMode(mode) && !isSecondarySchool) {
      toast.error(
        "Points-based division rules are only available for secondary schools."
      );
      return;
    }
    if (mode === "division_only") {
      const hasPointsRules = rules.some(isDivisionPointsRule);
      if (hasPointsRules) {
        setRules((prev) => prev.filter((rule) => !isDivisionPointsRule(rule)));
        toast.info("Points-based rules were removed. Division-only rules were kept.");
      }
    } else if (isPointsBasedDivisionMode(mode)) {
      setRules((prev) =>
        prev.map((rule) =>
          isDivisionPointsRule(rule) ? { ...rule, mode } : rule
        )
      );
    }
    setDivisionRuleMode(mode);
  };

  const updateNumericRule = (
    index: number,
    patch: Partial<NumericStreamingRule>
  ) => {
    setRules((prev) =>
      prev.map((rule, i) =>
        i === index && "min" in rule ? { ...rule, ...patch } : rule
      )
    );
  };

  const updateDivisionRule = (
    index: number,
    patch: Partial<DivisionStreamingRule>
  ) => {
    setRules((prev) =>
      prev.map((rule, i) =>
        i === index && isDivisionRule(rule) ? { ...rule, ...patch } : rule
      )
    );
  };

  const updateDivisionPointsRule = (
    index: number,
    patch: Partial<DivisionPointsStreamingRule>
  ) => {
    setRules((prev) =>
      prev.map((rule, i) =>
        i === index && isDivisionPointsRule(rule) ? { ...rule, ...patch } : rule
      )
    );
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const moveRule = (index: number, direction: -1 | 1) => {
    setRules((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  if (loadingInit) {
    return (
      <AsyncLoadingShell
        message="Loading Student Streaming…"
        slowMessage="Still loading coordinated classes…"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
          Student Streaming &amp; Placement
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Automatically recommend the best stream for each student based on exam
          performance, then apply placements with confidence.
        </p>
      </div>

      {parentClasses.length === 0 && !isCoordinator && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          You are not assigned as a coordinator for any class. Ask your school
          admin to assign you as a class coordinator first.
        </div>
      )}

      {parentClasses.length === 0 && isCoordinator && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80">
          <p className="text-base font-semibold text-slate-900 dark:text-zinc-50">
            No streaming classes available yet
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-zinc-400">
            Student streaming requires parent classes with stream sections
            (e.g. FORM ONE with FORM ONE A, FORM ONE B, FORM ONE C). Create
            stream classes in{" "}
            <a
              href="/dashboard/classes"
              className="font-semibold text-school-primary underline underline-offset-2"
            >
              Classes
            </a>{" "}
            and link each stream to its parent class.
          </p>
        </div>
      )}

      {parentClasses.length > 0 && streamClasses.length === 0 && !loadingData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          No stream sections found for{" "}
          <span className="font-semibold">
            {selectedParent?.name ?? "this class"}
          </span>
          . Create stream classes (e.g. FORM ONE A, FORM ONE B, FORM ONE C) in{" "}
          <a
            href="/dashboard/classes"
            className="font-semibold underline underline-offset-2"
          >
            Classes
          </a>{" "}
          and link them to the parent class.
        </div>
      )}

      {!examType && parentClassId && !loadingData && examOptions.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100">
          Select an exam with recorded results to calculate performance and
          recommendations.
        </div>
      )}

      {!examType && parentClassId && !loadingData && examOptions.length === 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100">
          No examination results found for this class and academic year. Enter
          scores in the gradebook first.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        <StreamingKpiCard
          icon={<Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          label="Students Reviewed"
          value={stats.totalEligible}
        />
        <StreamingKpiCard
          icon={
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          }
          label="Already Placed"
          value={stats.alreadyStreamed}
        />
        <StreamingKpiCard
          icon={<Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          label="Awaiting Stream"
          value={stats.awaitingPlacement}
        />
        <StreamingKpiCard
          icon={
            <Layers className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          }
          label="Streams Available"
          value={stats.availableStreams}
        />
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-zinc-700/80 dark:bg-zinc-900/30">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          Filters
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Academic Year
            </span>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              disabled={parentClasses.length === 0}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {academicYearOptions().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Exam
            </span>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              disabled={parentClasses.length === 0}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Select exam…</option>
              {examOptions.map((e) => (
                <option key={e.examType} value={e.examType}>
                  {e.label}
                  {e.studentsWithResults > 0
                    ? ` (${e.studentsWithResults} with results)`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Class
            </span>
            <select
              value={parentClassId}
              onChange={(e) => setParentClassId(e.target.value)}
              disabled={parentClasses.length === 0}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {parentClasses.length === 0 ? (
                <option value="">No eligible parent classes</option>
              ) : (
                parentClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Performance Measure
            </span>
            <select
              value={performanceMeasure}
              onChange={(e) =>
                setPerformanceMeasure(e.target.value as StreamingPerformanceMeasure)
              }
              disabled={parentClasses.length === 0}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {(
                Object.entries(STREAMING_PERFORMANCE_MEASURE_LABELS) as [
                  StreamingPerformanceMeasure,
                  string,
                ][]
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      )}

      {loadingData ? (
        <AsyncLoadingShell
          message="Loading performance data…"
          slowMessage="Calculating scores and recommendations…"
        />
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80">
            <div
              className={`flex flex-wrap items-center justify-between gap-3 ${
                rulesExpanded || rules.length > 0 ? "mb-4" : ""
              }`}
            >
              <button
                type="button"
                onClick={toggleRulesExpanded}
                className="inline-flex items-center gap-2 rounded-lg text-left transition-colors hover:text-slate-700 dark:hover:text-zinc-200"
                aria-expanded={rulesExpanded}
                aria-controls="streaming-rules-panel"
              >
                {rulesExpanded ? (
                  <ChevronUp
                    className="h-5 w-5 shrink-0 text-slate-500 dark:text-zinc-400"
                    aria-hidden
                  />
                ) : (
                  <ChevronDown
                    className="h-5 w-5 shrink-0 text-slate-500 dark:text-zinc-400"
                    aria-hidden
                  />
                )}
                <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">
                  Streaming Rules
                </h2>
              </button>
              {rulesExpanded && (
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addRule}
                      disabled={streamClasses.length === 0}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      Add rule
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveRules()}
                      disabled={savingRules || !examType}
                      className="inline-flex items-center gap-2 rounded-xl bg-school-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {savingRules ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Save rules
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={applyExampleRules}
                    disabled={streamClasses.length === 0}
                    className="text-xs font-medium text-school-primary hover:underline disabled:opacity-50"
                  >
                    Load example rules
                  </button>
                </div>
              )}
            </div>

            <div id="streaming-rules-panel">
            {performanceMeasure === "division" && rulesExpanded && (
              <div className="mb-4 space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                  How do you want to place students?
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDivisionRuleModeChange("division_only")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      divisionRuleMode === "division_only"
                        ? "bg-school-primary text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    }`}
                  >
                    Division only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDivisionRuleModeChange("necta_points")}
                    disabled={!isSecondarySchool}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      divisionRuleMode === "necta_points"
                        ? "bg-school-primary text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    }`}
                  >
                    NECTA points
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDivisionRuleModeChange("custom_points")}
                    disabled={!isSecondarySchool}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      divisionRuleMode === "custom_points"
                        ? "bg-school-primary text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    }`}
                  >
                    Custom points
                  </button>
                </div>
                {divisionRuleMode === "division_only" && (
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                    Place students by division result. Points are not used.
                  </p>
                )}
                {divisionRuleMode === "necta_points" && isSecondarySchool && (
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                    Uses official NECTA point ranges. Lower points mean stronger
                    performance.
                  </p>
                )}
                {divisionRuleMode === "custom_points" && isSecondarySchool && (
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                    Create your own point ranges for student placement.
                  </p>
                )}
                {!isSecondarySchool && (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Point-based placement is for secondary schools. Use Division
                    only for this school.
                  </p>
                )}
                {divisionRuleMode === "necta_points" && isSecondarySchool && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setNectaGuideExpanded((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-school-primary hover:underline"
                    >
                      {nectaGuideExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      Official NECTA point ranges
                    </button>
                    {nectaGuideExpanded && (
                      <ul className="mt-2 space-y-1 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
                        <li>Division I: 7–17 points</li>
                        <li>Division II: 18–21 points</li>
                        <li>Division III: 22–25 points</li>
                        <li>Division IV: 26–33 points</li>
                        <li>Division 0: 34+ points</li>
                      </ul>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 dark:text-zinc-500">
                  Rules are checked from top to bottom. The first match wins.
                </p>
              </div>
            )}
            {rulesOverlapWarning && rulesExpanded && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                {rulesOverlapWarning}
              </div>
            )}
            {activeRulesForMode.length === 0 ? (
              rulesExpanded ? (
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  No placement rules yet. Choose how to place students above,
                  then click{" "}
                  <span className="font-medium">Add rule</span>
                  {performanceMeasure === "division"
                    ? ""
                    : " to set score ranges for each stream"}
                  —or{" "}
                  <button
                    type="button"
                    onClick={applyExampleRules}
                    disabled={streamClasses.length === 0}
                    className="font-medium text-school-primary hover:underline disabled:opacity-50"
                  >
                    load example rules
                  </button>{" "}
                  to get started.
                </p>
              ) : null
            ) : (
              <div className={rulesExpanded ? "space-y-4" : ""}>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Placement summary
                  </p>
                  <ul className="space-y-1">
                    {activeRulesForMode.map((rule, index) => (
                      <li
                        key={`summary-${index}`}
                        className="text-sm font-medium text-slate-800 dark:text-zinc-100"
                      >
                        {formatRuleSummary(rule, streamNameById)}
                      </li>
                    ))}
                  </ul>
                  {rulesExpanded && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                      Recommendations update instantly as you edit rules below.
                      Save rules to persist them for this exam and measure.
                    </p>
                  )}
                </div>

                {rulesExpanded && (
                <div className="space-y-3">
                {activeRulesForMode.map((rule) => {
                  const index = rules.indexOf(rule);
                  if (index < 0) return null;
                  return isDivisionPointsRule(rule) &&
                  performanceMeasure === "division" &&
                  isPointsBasedDivisionMode(divisionRuleMode) ? (
                    <div
                      key={`pts-${index}`}
                      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/80 p-3 md:grid-cols-[auto_1fr_1fr_1fr_1fr_auto] dark:border-zinc-700"
                    >
                      <div className="flex flex-col gap-1 self-start">
                        <button
                          type="button"
                          onClick={() => moveRule(index, -1)}
                          disabled={index === 0}
                          className="rounded-lg border border-slate-200 p-1 disabled:opacity-40 dark:border-zinc-700"
                          aria-label="Move rule up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRule(index, 1)}
                          disabled={index === rules.length - 1}
                          className="rounded-lg border border-slate-200 p-1 disabled:opacity-40 dark:border-zinc-700"
                          aria-label="Move rule down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-500">
                          Division
                        </span>
                        <select
                          value={rule.division}
                          onChange={(e) =>
                            updateDivisionPointsRule(index, {
                              division: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          {DIVISION_POINTS_RULE_DIVISIONS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-medium text-slate-500">
                          {divisionRuleMode === "necta_points"
                            ? "From (points)"
                            : "Minimum points"}
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={rule.minPoints}
                          onChange={(e) =>
                            updateDivisionPointsRule(index, {
                              minPoints: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-medium text-slate-500">
                          {divisionRuleMode === "necta_points"
                            ? "To (points)"
                            : "Maximum points"}
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={rule.maxPoints}
                          onChange={(e) =>
                            updateDivisionPointsRule(index, {
                              maxPoints: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-500">
                          Place in stream
                        </span>
                        <select
                          value={rule.targetClassId}
                          onChange={(e) =>
                            updateDivisionPointsRule(index, {
                              targetClassId: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          {streamClasses.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        className="self-end rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Delete
                      </button>
                    </div>
                  ) : isDivisionRule(rule) ? (
                    <div
                      key={`div-${index}`}
                      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/80 p-3 md:grid-cols-[auto_1fr_1fr_auto] dark:border-zinc-700"
                    >
                      <div className="flex flex-col gap-1 self-start">
                        <button
                          type="button"
                          onClick={() => moveRule(index, -1)}
                          disabled={index === 0}
                          className="rounded-lg border border-slate-200 p-1 disabled:opacity-40 dark:border-zinc-700"
                          aria-label="Move rule up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRule(index, 1)}
                          disabled={index === rules.length - 1}
                          className="rounded-lg border border-slate-200 p-1 disabled:opacity-40 dark:border-zinc-700"
                          aria-label="Move rule down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                      <div>
                        <span className="mb-1 block text-xs font-medium text-slate-500">
                          {performanceMeasure === "division" &&
                          isPointsBasedDivisionMode(divisionRuleMode)
                            ? "Students with"
                            : "Division"}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {DIVISION_OPTIONS.map((d) => {
                            const checked = rule.divisions.includes(d);
                            return (
                              <label
                                key={d}
                                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const next = checked
                                      ? rule.divisions.filter((x) => x !== d)
                                      : [...rule.divisions, d];
                                    updateDivisionRule(index, {
                                      divisions: next,
                                    });
                                  }}
                                />
                                {d}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-500">
                          Place in stream
                        </span>
                        <select
                          value={rule.targetClassId}
                          onChange={(e) =>
                            updateDivisionRule(index, {
                              targetClassId: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          {streamClasses.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        className="self-end rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Delete
                      </button>
                    </div>
                  ) : isNumericRule(rule) ? (
                    <div
                      key={`num-${index}`}
                      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/80 p-3 md:grid-cols-[auto_1fr_1fr_1fr_auto] dark:border-zinc-700"
                    >
                      <div className="flex flex-col gap-1 self-start">
                        <button
                          type="button"
                          onClick={() => moveRule(index, -1)}
                          disabled={index === 0}
                          className="rounded-lg border border-slate-200 p-1 disabled:opacity-40 dark:border-zinc-700"
                          aria-label="Move rule up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRule(index, 1)}
                          disabled={index === rules.length - 1}
                          className="rounded-lg border border-slate-200 p-1 disabled:opacity-40 dark:border-zinc-700"
                          aria-label="Move rule down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                      <label>
                        <span className="mb-1 block text-xs font-medium text-slate-500">
                          Min
                        </span>
                        <input
                          type="number"
                          value={rule.min}
                          onChange={(e) =>
                            updateNumericRule(index, {
                              min: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-medium text-slate-500">
                          Max
                        </span>
                        <input
                          type="number"
                          value={rule.max}
                          onChange={(e) =>
                            updateNumericRule(index, {
                              max: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-medium text-slate-500">
                          Place in stream
                        </span>
                        <select
                          value={rule.targetClassId}
                          onChange={(e) =>
                            updateNumericRule(index, {
                              targetClassId: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          {streamClasses.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        className="self-end rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null;
                })}
                </div>
                )}
              </div>
            )}
            </div>
          </section>

          {activeRulesForMode.length > 0 && streamClasses.length > 0 && (
            <section className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/80">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">
                  Placement Preview
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  <span className="tabular-nums font-medium text-slate-700 dark:text-zinc-300">
                    {previewImpact.streamsAffected}
                  </span>{" "}
                  stream{previewImpact.streamsAffected === 1 ? "" : "s"} affected
                  <span className="mx-1.5 text-slate-300 dark:text-zinc-600">
                    •
                  </span>
                  <span className="tabular-nums font-medium text-slate-700 dark:text-zinc-300">
                    {previewImpact.studentsMoving}
                  </span>{" "}
                  student{previewImpact.studentsMoving === 1 ? "" : "s"} moving
                </p>
              </div>

              <div className="mt-3 grid auto-rows-fr grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
                {preview.map((row) => (
                  <PlacementStreamCard
                    key={row.targetClassId}
                    row={row}
                    isActive={previewStreamFilter === row.targetClassId}
                    onSelect={handlePreviewStreamSelect}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900/80">
            <div className="border-b border-slate-200/60 px-4 py-3 dark:border-zinc-700/60">
              <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Streaming Summary
              </h2>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <SummaryKpiCard
                  label="Reviewed"
                  value={streamingSummary.reviewed}
                  isActive={statusFilter === null && !studentSearch.trim()}
                  onClick={() => {
                    setStatusFilter(null);
                    setStudentSearch("");
                  }}
                />
                <SummaryKpiCard
                  label="Correct"
                  value={streamingSummary.alreadyCorrect}
                  isActive={statusFilter === "correct"}
                  onClick={() => toggleStatusFilter("correct")}
                />
                <SummaryKpiCard
                  label="Need Action"
                  value={streamingSummary.needTransfer}
                  isActive={statusFilter === "need_action"}
                  onClick={() => toggleStatusFilter("need_action")}
                />
                <SummaryKpiCard
                  label="Overrides"
                  value={streamingSummary.manualOverrides}
                  isActive={statusFilter === "override"}
                  onClick={() => toggleStatusFilter("override")}
                />
                <SummaryKpiCard
                  label="Missing Results"
                  value={streamingSummary.withoutResults}
                  isActive={statusFilter === "no_result"}
                  onClick={() => toggleStatusFilter("no_result")}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 px-4 py-2 dark:border-zinc-700/60">
              <h2 className="text-sm font-medium text-slate-900 dark:text-zinc-50">
                Students
              </h2>
              <div className="flex flex-col items-end gap-0.5">
                <button
                  type="button"
                  onClick={handleApplyRecommended}
                  disabled={!canPlace || selectedIds.size === 0}
                  className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Apply recommended
                </button>
                <p className="text-[10px] leading-snug text-slate-500 dark:text-zinc-400">
                  Places each student into their recommended stream.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-b border-slate-200/60 px-4 py-2.5 dark:border-zinc-700/60 sm:flex-row sm:items-center sm:justify-between">
              <label className="block min-w-0 flex-1 sm:max-w-sm">
                <span className="sr-only">Search students</span>
                <input
                  type="search"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search by name or admission number…"
                  className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </label>
              <label className="flex shrink-0 items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) =>
                    setPageSize(Number(e.target.value) as PageSizeOption)
                  }
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  aria-label="Students per page"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span>per page</span>
              </label>
            </div>

            {previewStreamFilter && previewStreamFilterName && (
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 bg-slate-50/50 px-4 py-1.5 dark:border-zinc-700/60 dark:bg-zinc-800/20">
                <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                  Showing students for{" "}
                  <span className="font-medium text-slate-800 dark:text-zinc-200">
                    {previewStreamFilterName}
                  </span>
                  <span className="ml-1 tabular-nums text-slate-500">
                    ({filteredStudents.length})
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setPreviewStreamFilter(null)}
                  className="text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Clear
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-xs lg:table-auto">
                <thead className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/98 text-left backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/98">
                  <tr>
                    <th className="w-8 px-2 py-2">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={(e) =>
                          toggleSelectAllOnPage(e.target.checked)
                        }
                        aria-label="Select all students on this page"
                      />
                    </th>
                    <th className={`w-[18%] ${TABLE_HEADER_CLASS}`}>
                      Student
                    </th>
                    <th className={`w-[10%] ${TABLE_HEADER_CLASS}`}>
                      Admission No.
                    </th>
                    <th className={`w-[11%] ${TABLE_HEADER_CLASS}`}>
                      Current Stream
                    </th>
                    {performanceMeasure === "average_score" && (
                      <th className={`w-[9%] ${TABLE_HEADER_CLASS}`}>
                        Average Score
                      </th>
                    )}
                    {performanceMeasure === "division" && (
                      <th className={`w-[9%] ${TABLE_HEADER_CLASS}`}>
                        Division
                      </th>
                    )}
                    {performanceMeasure === "total_marks" && (
                      <th className={`w-[9%] ${TABLE_HEADER_CLASS}`}>
                        Total Marks
                      </th>
                    )}
                    <th className={`w-[12%] ${TABLE_HEADER_CLASS}`}>
                      Recommended Stream
                    </th>
                    <th className={`w-[12%] ${TABLE_HEADER_CLASS}`}>
                      Placement Target
                    </th>
                    <th className={`w-[14%] ${TABLE_HEADER_CLASS}`}>
                      Status
                    </th>
                    <th className={`w-[3.25rem] ${TABLE_HEADER_CLASS}`}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-2 py-10 text-center text-xs text-slate-400 dark:text-zinc-500"
                      >
                        {studentSearch.trim() || statusFilter
                          ? "No students match your search or filter."
                          : previewStreamFilter
                            ? "No students linked to this stream."
                            : "No students to display."}
                      </td>
                    </tr>
                  ) : (
                  paginatedStudents.map((s) => (
                    <tr
                      key={s.id}
                      className={ROW_HOVER_CLASS}
                    >
                      <td className="px-2 py-1.5 align-middle">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(s.id);
                              else next.delete(s.id);
                              return next;
                            });
                          }}
                          aria-label={`Select ${s.fullName}`}
                        />
                      </td>
                      <td className="truncate px-2 py-1.5 align-middle text-xs font-bold text-slate-900 dark:text-zinc-50">
                        {s.fullName}
                        {hasPendingPlacementChange(s, overrides) && (
                          <span className="ml-1.5 inline-flex h-4 items-center rounded border border-amber-200/80 bg-amber-50/80 px-1.5 text-[10px] font-medium leading-none text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 align-middle text-[11px] tabular-nums text-slate-500 dark:text-zinc-400">
                        {s.admissionNumber ?? (
                          <span className={MUTED_CELL_CLASS}>—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 align-middle text-[11px]">
                        {s.currentStreamName === "Unassigned" ? (
                          <span className={MUTED_CELL_CLASS}>Unassigned</span>
                        ) : (
                          <StreamPill name={s.currentStreamName} />
                        )}
                      </td>
                      {performanceMeasure === "average_score" && (
                        <td className="px-2 py-1.5 align-middle text-xs font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                          {s.performance.averageScorePercent != null ? (
                            `${s.performance.averageScorePercent}%`
                          ) : (
                            <span className={MUTED_CELL_CLASS}>—</span>
                          )}
                        </td>
                      )}
                      {performanceMeasure === "division" && (
                        <td className="px-2 py-1.5 align-middle">
                          <DivisionPerformanceCell
                            performance={s.performance}
                            divisionRuleMode={effectiveDivisionRuleMode}
                          />
                        </td>
                      )}
                      {performanceMeasure === "total_marks" && (
                        <td className="px-2 py-1.5 align-middle text-xs font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                          {s.performance.totalMarks != null ? (
                            Math.round(s.performance.totalMarks)
                          ) : (
                            <span className={MUTED_CELL_CLASS}>—</span>
                          )}
                        </td>
                      )}
                      <td className="px-2 py-1.5 align-middle">
                        <div className="flex h-6 items-center">
                        {!s.hasExamResult ? (
                          <span className={MUTED_CELL_CLASS}>Not Available</span>
                        ) : s.ruleRecommendedName ? (
                          <StreamPill
                            name={s.ruleRecommendedName}
                            variant="recommended"
                          />
                        ) : (
                          <span className={MUTED_CELL_CLASS}>—</span>
                        )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <div className="flex h-6 items-center">
                        <select
                          value={
                            getRowPlacementTargetId(s, overrides) ?? ""
                          }
                          disabled={
                            !canPlace ||
                            streamClasses.length === 0 ||
                            savingStudentIds.has(s.id)
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            setPlacementTarget(s.id, v);
                          }}
                          className={PLACEMENT_TARGET_SELECT_CLASS}
                          aria-label={`Placement target for ${s.fullName}`}
                        >
                          {!s.effectivePlacementTargetId && (
                            <option value="">Select stream…</option>
                          )}
                          {streamClasses.map((sc) => (
                            <option key={sc.id} value={sc.id}>
                              {sc.name}
                            </option>
                          ))}
                        </select>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <div className="flex h-6 items-center">
                          <PlacementStatusBadge
                            status={displayPlacementStatus(s, overrides)}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        {(() => {
                          const action = rowActionType(
                            s,
                            streamIds,
                            savingStudentIds,
                            overrides
                          );
                          if (action === "saving") {
                            return (
                              <span
                                className={`${ACTION_CELL} text-slate-500 dark:text-zinc-400`}
                              >
                                Saving…
                              </span>
                            );
                          }
                          if (action === "already_correct") {
                            return (
                              <span
                                className={`${ACTION_CELL} text-slate-500 dark:text-zinc-400`}
                              >
                                Placed
                              </span>
                            );
                          }
                          if (action === "none") {
                            return (
                              <span
                                className={`${ACTION_CELL} ${MUTED_CELL_CLASS}`}
                              >
                                —
                              </span>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                handleIndividualAssign(
                                  s.id,
                                  getRowPlacementTargetId(s, overridesRef.current)
                                )
                              }
                              disabled={!canPlace || savingStudentIds.has(s.id)}
                              className={`${ACTION_CELL} border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800`}
                            >
                              Apply
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-200/70 bg-slate-50/30 px-4 py-2.5 dark:border-zinc-700/60 dark:bg-zinc-900/20">
                <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                  {totalFiltered === 0 ? (
                    "Showing 0 of 0 students"
                  ) : (
                    <>
                      Showing{" "}
                      <span className="tabular-nums font-medium text-slate-700 dark:text-zinc-300">
                        {paginationRange.start}–{paginationRange.end}
                      </span>{" "}
                      of{" "}
                      <span className="tabular-nums font-medium text-slate-700 dark:text-zinc-300">
                        {totalFiltered}
                      </span>{" "}
                      students
                    </>
                  )}
                </p>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.max(1, p - 1))
                    }
                    disabled={effectivePage <= 1}
                    className={PAGINATION_BUTTON_CLASS}
                  >
                    Previous
                  </button>
                  <span className="min-w-[5.5rem] text-center text-xs tabular-nums text-slate-500 dark:text-zinc-400">
                    Page {effectivePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={effectivePage >= totalPages}
                    className={PAGINATION_BUTTON_CLASS}
                  >
                    Next
                  </button>
                </div>
              </div>

              {bulkSelectionBar && (
                <div className="border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-1px_0_rgba(15,23,42,0.04)] dark:border-zinc-700 dark:bg-zinc-900/95 dark:shadow-[0_-1px_0_rgba(0,0,0,0.2)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">
                        Place selected students into one stream
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                        Use this only when you want all selected students to go
                        to the same stream.
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        <span className="tabular-nums font-medium text-slate-700 dark:text-zinc-300">
                          {bulkSelectionBar.count}
                        </span>{" "}
                        {bulkSelectionBar.count === 1
                          ? "student selected"
                          : "students selected"}
                      </p>
                    </div>
                    {bulkSelectionBar.showControls ? (
                      <div className="flex flex-col items-stretch gap-2 sm:items-end">
                        {bulkSelectionBar.helperText && (
                          <p className="text-xs text-slate-500 dark:text-zinc-400">
                            {bulkSelectionBar.helperText}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2.5">
                          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                            <span className="shrink-0">Target stream</span>
                            <select
                              value={bulkTargetClassId}
                              onChange={(e) =>
                                setBulkTargetClassId(e.target.value)
                              }
                              disabled={!bulkSelectionBar.canApply}
                              className={`${PLACEMENT_TARGET_SELECT_CLASS} max-w-[11rem] disabled:cursor-not-allowed disabled:opacity-50`}
                              aria-label="Target stream for selected students"
                            >
                              {streamClasses.map((sc) => (
                                <option key={sc.id} value={sc.id}>
                                  {sc.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={handleBulkApply}
                            disabled={!bulkSelectionBar.canApply}
                            className={`${ACTION_CELL} border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800`}
                          >
                            Place selected
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-zinc-400">
                        {bulkSelectionBar.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="streaming-confirm-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <h3
              id="streaming-confirm-title"
              className="text-lg font-semibold text-slate-900 dark:text-zinc-50"
            >
              {confirmMeta.individualDetail
                ? "Confirm placement?"
                : confirmMode === "recommended"
                  ? "Confirm recommended placement"
                  : confirmMeta.bulkTargetStreamName
                    ? "Confirm stream placement"
                    : "Confirm placement"}
            </h3>
            {confirmMeta.individualDetail ? (
              <dl className="mt-4 space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/60">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-zinc-400">Student</dt>
                  <dd className="font-medium text-slate-900 dark:text-zinc-50">
                    {confirmMeta.individualDetail.studentName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-zinc-400">
                    Current Stream
                  </dt>
                  <dd className="font-medium text-slate-900 dark:text-zinc-50">
                    {confirmMeta.individualDetail.currentStreamName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-zinc-400">
                    Target Stream
                  </dt>
                  <dd className="font-medium text-slate-900 dark:text-zinc-50">
                    {confirmMeta.individualDetail.targetStreamName}
                  </dd>
                </div>
                <div className="border-t border-slate-200/80 pt-2 dark:border-zinc-700">
                  <dt className="text-slate-500 dark:text-zinc-400">Reason</dt>
                  <dd className="mt-0.5 font-medium text-slate-800 dark:text-zinc-200">
                    {confirmMeta.individualDetail.reason}
                  </dd>
                </div>
              </dl>
            ) : (
            <div className="mt-2 space-y-3 text-sm text-slate-600 dark:text-zinc-400">
              {confirmMeta.noResultManual ? (
                <p>
                  {confirmMeta.studentName ? (
                    <>
                      <span className="font-medium">{confirmMeta.studentName}</span>{" "}
                      has no result for the selected exam. Continue with manual
                      placement?
                    </>
                  ) : (
                    <>
                      This student has no result for the selected exam.
                      Continue with manual placement?
                    </>
                  )}
                </p>
              ) : confirmMode === "recommended" ? (
                <>
                  <p>
                    You are about to place the selected students into their
                    recommended streams based on the streaming rules.
                  </p>
                  <p>
                    This action only changes stream allocation and does not
                    affect promotion status.
                  </p>
                </>
              ) : confirmMeta.bulkTargetStreamName &&
                confirmSharedStreamSummary ? (
                <>
                  <p>
                    You are about to move{" "}
                    <span className="font-medium tabular-nums">
                      {confirmSharedStreamSummary.count}
                    </span>{" "}
                    student
                    {confirmSharedStreamSummary.count === 1 ? "" : "s"} into{" "}
                    <span className="font-medium">
                      {confirmSharedStreamSummary.streamName}
                    </span>
                    .
                  </p>
                  <dl className="space-y-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
                    <div className="flex justify-between gap-4">
                      <dt>
                        Current students in{" "}
                        {confirmSharedStreamSummary.streamName}:
                      </dt>
                      <dd className="tabular-nums font-medium text-slate-900 dark:text-zinc-50">
                        {confirmSharedStreamSummary.currentCount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Students being added:</dt>
                      <dd className="tabular-nums font-medium text-slate-900 dark:text-zinc-50">
                        {confirmSharedStreamSummary.movingCount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-slate-200/80 pt-1.5 dark:border-zinc-700">
                      <dt>Total after placement:</dt>
                      <dd className="tabular-nums font-medium text-slate-900 dark:text-zinc-50">
                        {confirmSharedStreamSummary.afterCount}
                      </dd>
                    </div>
                  </dl>
                  <p>
                    {confirmSharedStreamSummary.count === 1
                      ? "This only changes the student's stream. It does not change their class level or promotion status."
                      : "This only changes the students' stream. It does not change their class level or promotion status."}
                  </p>
                </>
              ) : (
                <p>
                  You are about to place{" "}
                  <span className="font-medium tabular-nums">
                    {pendingPlacements.length}
                  </span>{" "}
                  student{pendingPlacements.length === 1 ? "" : "s"} into
                  selected streams. This does not change their academic year or
                  promotion status.
                </p>
              )}
            </div>
            )}
            {confirmMeta.individualDetail && confirmMeta.noResultManual && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                This student has no exam result for the selected exam. Proceed
                with manual placement?
              </p>
            )}
            {(confirmMeta.skippedNoResult ?? 0) > 0 && (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                {confirmMeta.skippedNoResult} selected student
                {(confirmMeta.skippedNoResult ?? 0) === 1 ? "" : "s"} skipped
                (no exam result).
              </p>
            )}
            {(confirmMeta.skippedNoRule ?? 0) > 0 && (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                {confirmMeta.skippedNoRule} selected student
                {(confirmMeta.skippedNoRule ?? 0) === 1 ? "" : "s"} skipped
                (no matching rule).
              </p>
            )}
            {confirmPreview.length > 0 &&
              confirmMode !== "recommended" &&
              !confirmMeta.bulkTargetStreamName && (
              <ul className="mt-4 space-y-1 text-sm">
                {confirmPreview.map(([name, count]) => (
                  <li key={name}>
                    <span className="font-medium">{name}</span> → {count}{" "}
                    student
                    {count === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            )}
            {confirmCapacityDetails.length > 0 &&
              !confirmMeta.bulkTargetStreamName && (
              <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-zinc-400">
                {confirmCapacityDetails.map((row) => (
                  <li key={row.streamName}>
                    <span className="font-medium">{row.streamName}</span>
                    {row.capacity != null ? (
                      <span
                        className={
                          row.isOverCapacity
                            ? " text-amber-800 dark:text-amber-200"
                            : ""
                        }
                      >
                        {" "}
                        · {row.finalTotal} / {row.capacity} after placement
                      </span>
                    ) : (
                      <span> · {row.finalTotal} after placement</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {capacityWarnings.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-semibold">Capacity warnings</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {capacityWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  You may still proceed if your school allows manual override.
                </p>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmMode("default");
                  setConfirmMeta({});
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmPlacementClick()}
                disabled={applying}
                className="inline-flex items-center gap-2 rounded-xl bg-school-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {applying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Confirm Placement"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <SubjectCompatibilityModal
        open={compatibilityModalOpen}
        mode={compatibilityModalMode}
        result={compatibilityResult}
        onClose={() => {
          if (applying) return;
          setCompatibilityModalOpen(false);
          setCompatibilityResult(null);
        }}
        onContinue={() => void executePlacement(true)}
        isContinuing={applying}
      />
    </div>
  );
}
