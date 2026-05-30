"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingShell } from "@/components/dashboard/async-loading-shell";
import { buildPlacementPreview, recommendStreamClassId } from "@/lib/student-streaming/evaluate-rules";
import {
  STREAMING_PERFORMANCE_MEASURE_LABELS,
  type DivisionStreamingRule,
  type NumericStreamingRule,
  type StreamingExamOption,
  type StreamingOverviewStats,
  type StreamingParentClassOption,
  type StreamingPerformanceMeasure,
  type StreamingRuleEntry,
  type StreamingStudentRow,
} from "@/lib/student-streaming/types";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import {
  applyStudentStreamingAction,
  loadStreamingParentClassesAction,
  loadStreamingWorkspaceAction,
  saveStreamingRulesAction,
} from "./actions";

const DIVISION_OPTIONS = ["I", "II", "III", "IV", "0", "INC", "ABS"] as const;

function academicYearOptions(): string[] {
  const current = currentAcademicYear();
  const years: string[] = [];
  for (let y = current - 2; y <= current + 1; y += 1) {
    years.push(String(y));
  }
  return years;
}

function buildExampleNumericRules(
  streamClasses: { id: string; name: string }[]
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

function buildExampleDivisionRules(
  streamClasses: { id: string; name: string }[]
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

function StreamingKpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80">
      <span className="text-2xl" aria-hidden>
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
  streamClasses: { id: string; name: string }[]
): NumericStreamingRule {
  return {
    targetClassId: streamClasses[0]?.id ?? "",
    min: 0,
    max: 100,
  };
}

function emptyDivisionRule(
  streamClasses: { id: string; name: string }[]
): DivisionStreamingRule {
  return {
    targetClassId: streamClasses[0]?.id ?? "",
    divisions: ["I"],
  };
}

export function StudentStreamingClient({
  initialAcademicYear,
}: {
  initialAcademicYear: string;
}) {
  const [parentClasses, setParentClasses] = useState<
    StreamingParentClassOption[]
  >([]);
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
  const [streamClasses, setStreamClasses] = useState<
    { id: string; name: string }[]
  >([]);
  const [examOptions, setExamOptions] = useState<StreamingExamOption[]>([]);
  const [rules, setRules] = useState<StreamingRuleEntry[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetClassId, setBulkTargetClassId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPlacements, setPendingPlacements] = useState<
    { studentId: string; targetClassId: string; targetClassName: string }[]
  >([]);
  const [applying, setApplying] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [individualAssignId, setIndividualAssignId] = useState<string | null>(
    null
  );

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
    setOverrides({});
    setSelectedIds(new Set());
    if (!examType && result.examOptions[0]) {
      setExamType(result.examOptions[0].examType);
    }
    if (!bulkTargetClassId && result.streamClasses[0]) {
      setBulkTargetClassId(result.streamClasses[0].id);
    }
  }, [parentClassId, academicYear, examType, performanceMeasure]);

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

  const studentsWithOverrides = useMemo(() => {
    return students.map((s) => {
      const overrideId = overrides[s.id];
      const recommendedClassId =
        overrideId ??
        (rules.length > 0
          ? recommendStreamClassId(
              performanceMeasure,
              s.performance,
              rules
            )
          : s.recommendedClassId);
      return {
        ...s,
        effectiveRecommendedId: recommendedClassId,
        effectiveRecommendedName: recommendedClassId
          ? (streamNameById.get(recommendedClassId) ?? null)
          : null,
      };
    });
  }, [students, overrides, streamNameById, rules, performanceMeasure]);

  const canPlace = streamClasses.length > 0 && Boolean(examType);
  const selectedParent = parentClasses.find((c) => c.id === parentClassId);

  const applyExampleRules = () => {
    if (streamClasses.length === 0) {
      toast.error("Add stream classes before defining rules.");
      return;
    }
    setRules(
      performanceMeasure === "division"
        ? buildExampleDivisionRules(streamClasses)
        : buildExampleNumericRules(streamClasses)
    );
  };
  const preview = useMemo(
    () =>
      buildPlacementPreview(
        studentsWithOverrides.map((s) => ({
          recommendedClassId: s.effectiveRecommendedId,
          recommendedClassName: s.effectiveRecommendedName,
        })),
        streamNameById
      ),
    [studentsWithOverrides, streamNameById]
  );

  const handleSaveRules = async () => {
    if (!parentClassId || !examType) {
      toast.error("Select an exam before saving rules.");
      return;
    }
    setSavingRules(true);
    const result = await saveStreamingRulesAction({
      parentClassId,
      academicYear,
      examType,
      performanceMeasure,
      rules,
    });
    setSavingRules(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Streaming rules saved.");
    void refreshWorkspace();
  };

  const buildPlacementsFromSelection = (
    ids: string[],
    targetClassId: string
  ) => {
    const targetClassName = streamNameById.get(targetClassId) ?? "Unknown";
    return ids
      .map((studentId) => {
        const student = students.find((s) => s.id === studentId);
        if (!student || student.currentClassId === targetClassId) return null;
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
    }[]
  ) => {
    if (placements.length === 0) {
      toast.message("No placement changes to apply.");
      return;
    }
    setPendingPlacements(placements);
    setConfirmOpen(true);
  };

  const handleBulkApply = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      toast.error("Select at least one student.");
      return;
    }
    if (!bulkTargetClassId) {
      toast.error("Choose a target stream.");
      return;
    }
    openConfirmForPlacements(buildPlacementsFromSelection(ids, bulkTargetClassId));
  };

  const handleApplyRecommended = () => {
    const placements = studentsWithOverrides
      .filter(
        (s) =>
          selectedIds.has(s.id) &&
          s.effectiveRecommendedId &&
          s.currentClassId !== s.effectiveRecommendedId
      )
      .map((s) => ({
        studentId: s.id,
        targetClassId: s.effectiveRecommendedId!,
        targetClassName: s.effectiveRecommendedName ?? "Unknown",
      }));
    openConfirmForPlacements(placements);
  };

  const handleIndividualAssign = (studentId: string, targetClassId: string) => {
    openConfirmForPlacements(
      buildPlacementsFromSelection([studentId], targetClassId)
    );
    setIndividualAssignId(null);
  };

  const confirmApply = async () => {
    if (!parentClassId || !examType) return;
    setApplying(true);
    const result = await applyStudentStreamingAction({
      parentClassId,
      academicYear,
      examType,
      performanceMeasure,
      placements: pendingPlacements.map((p) => ({
        studentId: p.studentId,
        targetClassId: p.targetClassId,
      })),
    });
    setApplying(false);
    setConfirmOpen(false);
    setPendingPlacements([]);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    void refreshWorkspace();
  };

  const confirmPreview = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of pendingPlacements) {
      counts.set(p.targetClassName, (counts.get(p.targetClassName) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [pendingPlacements]);

  const addRule = () => {
    if (streamClasses.length === 0) return;
    setRules((prev) => [
      ...prev,
      performanceMeasure === "division"
        ? emptyDivisionRule(streamClasses)
        : emptyNumericRule(streamClasses),
    ]);
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
        i === index && "divisions" in rule ? { ...rule, ...patch } : rule
      )
    );
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
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
          Group students into streams based on examination performance. Students
          remain in the same academic level and year.
        </p>
      </div>

      {parentClasses.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          You are not assigned as a coordinator for any class. Ask your school
          admin to assign you as a class coordinator first.
        </div>
      )}

      {parentClasses.length > 0 && streamClasses.length === 0 && !loadingData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          No stream sections found for{" "}
          <span className="font-semibold">
            {selectedParent?.name ?? "this class"}
          </span>
          . Create stream classes (e.g. FORM ONE A, FORM ONE B) in{" "}
          <a
            href="/dashboard/classes"
            className="font-semibold underline underline-offset-2"
          >
            Classes
          </a>{" "}
          and link them to the parent class to enable placement.
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
          icon="👥"
          label="Students Eligible"
          value={stats.totalEligible}
        />
        <StreamingKpiCard
          icon="✅"
          label="Students Already Streamed"
          value={stats.alreadyStreamed}
        />
        <StreamingKpiCard
          icon="⏳"
          label="Awaiting Placement"
          value={stats.awaitingPlacement}
        />
        <StreamingKpiCard
          icon="🏫"
          label="Available Streams"
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
                <option value="">No coordinated classes</option>
              ) : (
                parentClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.streamClasses.length > 0
                      ? ` (${c.streamClasses.length} streams)`
                      : ""}
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">
                Streaming Rules
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyExampleRules}
                  disabled={streamClasses.length === 0}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Example rules
                </button>
                <button
                  type="button"
                  onClick={addRule}
                  disabled={streamClasses.length === 0}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
            </div>

            {rules.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Add rules to automatically recommend streams. Example: 70–100 →
                FORM ONE A.
              </p>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, index) =>
                  "divisions" in rule ? (
                    <div
                      key={`div-${index}`}
                      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/80 p-3 md:grid-cols-[1fr_1fr_auto] dark:border-zinc-700"
                    >
                      <div>
                        <span className="mb-1 block text-xs font-medium text-slate-500">
                          Divisions
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
                          Target stream
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
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div
                      key={`num-${index}`}
                      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/80 p-3 md:grid-cols-[1fr_1fr_1fr_auto] dark:border-zinc-700"
                    >
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
                          Target stream
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
                        Remove
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {preview.length > 0 && (
            <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                Placement Preview
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {preview.map((row) => (
                  <div
                    key={row.targetClassId}
                    className="rounded-xl border border-emerald-200/60 bg-white px-4 py-3 dark:border-emerald-900/30 dark:bg-zinc-900/60"
                  >
                    <p className="font-semibold text-slate-900 dark:text-zinc-50">
                      {row.targetClassName}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-zinc-400">
                      {row.studentCount} student
                      {row.studentCount === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-zinc-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">
                Students
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={bulkTargetClassId}
                  onChange={(e) => setBulkTargetClassId(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {streamClasses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleBulkApply}
                  disabled={!canPlace}
                  className="rounded-xl bg-school-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Assign selected to stream
                </button>
                <button
                  type="button"
                  onClick={handleApplyRecommended}
                  disabled={!canPlace}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-60 dark:border-zinc-700"
                >
                  Apply recommended
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={
                          students.length > 0 &&
                          selectedIds.size === students.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(students.map((s) => s.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        aria-label="Select all students"
                      />
                    </th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Admission No.</th>
                    <th className="px-4 py-3">Current Class</th>
                    {performanceMeasure === "average_score" && (
                      <th className="px-4 py-3">Average Score</th>
                    )}
                    {performanceMeasure === "division" && (
                      <th className="px-4 py-3">Division</th>
                    )}
                    {performanceMeasure === "total_marks" && (
                      <th className="px-4 py-3">Total Marks</th>
                    )}
                    <th className="px-4 py-3">Recommended Stream</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsWithOverrides.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-slate-100 dark:border-zinc-800"
                    >
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 font-medium">{s.fullName}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {s.admissionNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3">{s.currentClassName}</td>
                      {performanceMeasure === "average_score" && (
                        <td className="px-4 py-3 tabular-nums">
                          {s.performance.averageScorePercent != null
                            ? `${s.performance.averageScorePercent}%`
                            : "—"}
                        </td>
                      )}
                      {performanceMeasure === "division" && (
                        <td className="px-4 py-3">
                          {s.performance.division
                            ? s.performance.division === "INC" ||
                              s.performance.division === "ABS"
                              ? s.performance.division
                              : `Division ${s.performance.division}`
                            : "—"}
                        </td>
                      )}
                      {performanceMeasure === "total_marks" && (
                        <td className="px-4 py-3 tabular-nums">
                          {s.performance.totalMarks != null
                            ? Math.round(s.performance.totalMarks)
                            : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {s.effectiveRecommendedName ? (
                            <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-100">
                              {s.effectiveRecommendedName}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          <select
                            value={overrides[s.id] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setOverrides((prev) => {
                                const next = { ...prev };
                                if (!v) {
                                  delete next[s.id];
                                } else {
                                  next[s.id] = v;
                                }
                                return next;
                              });
                            }}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            <option value="">Auto</option>
                            {streamClasses.map((sc) => (
                              <option key={sc.id} value={sc.id}>
                                {sc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {individualAssignId === s.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              id={`assign-${s.id}`}
                              defaultValue={bulkTargetClassId}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              {streamClasses.map((sc) => (
                                <option key={sc.id} value={sc.id}>
                                  {sc.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById(
                                  `assign-${s.id}`
                                ) as HTMLSelectElement | null;
                                if (el) handleIndividualAssign(s.id, el.value);
                              }}
                              className="rounded-lg bg-school-primary px-2 py-1 text-xs text-white"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setIndividualAssignId(null)}
                              className="text-xs text-slate-500"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIndividualAssignId(s.id)}
                            disabled={!canPlace}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium disabled:opacity-60 dark:border-zinc-700"
                          >
                            Assign stream
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              Confirm streaming placement
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
              You are about to place {pendingPlacements.length} student
              {pendingPlacements.length === 1 ? "" : "s"} into streams.
            </p>
            <ul className="mt-4 space-y-1 text-sm">
              {confirmPreview.map(([name, count]) => (
                <li key={name}>
                  <span className="font-medium">{name}</span> → {count} student
                  {count === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmApply()}
                disabled={applying}
                className="inline-flex items-center gap-2 rounded-xl bg-school-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {applying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
