"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  saBtnPrimarySm,
  saBtnSecondarySm,
  saInput,
  saSection,
  saSectionSubtitle,
  saSectionTitle,
  saTableHeadCell,
  saTableHeadRow,
  saTableRowHover,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { GeneratedLessonCard } from "@/components/super-admin/ai-training/generated-lesson-card";
import {
  CoverageRecommendations,
  DupRiskBadge,
  KnowledgeCompletionProgress,
  StatusBadge,
} from "@/components/super-admin/ai-training/lesson-review-shared";
import type {
  CurriculumAnalysis,
  GeneratedLessonDraft,
  GenerationSmartSuggestions,
} from "@/lib/ai-training/lesson-generator-types";
import type { QualityPipelineMetrics } from "@/lib/ai-training/knowledge-quality-report";
import { QUALITY_TIER_STYLES } from "@/lib/ai-training/knowledge-quality-rules";
import { cn } from "@/lib/utils";

type SortKey =
  | "quality"
  | "quality_asc"
  | "confidence"
  | "duplicate"
  | "coverage"
  | "readability"
  | "answer"
  | "intent";

type StatusFilter = "all" | "ready" | "needs_review" | "rejected" | "discarded";
type DupFilter = "all" | "none" | "low" | "medium" | "high";

interface LessonReviewPanelProps {
  analysis: CurriculumAnalysis;
  suggestions: GenerationSmartSuggestions;
  lessons: GeneratedLessonDraft[];
  blockedLessons?: GeneratedLessonDraft[];
  rejectedLessons?: GeneratedLessonDraft[];
  qualityMetrics?: QualityPipelineMetrics;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, selected: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onPreview: (lesson: GeneratedLessonDraft) => void;
  onEdit: (lesson: GeneratedLessonDraft) => void;
  onRegenerate: (lesson: GeneratedLessonDraft) => void;
  onApprove: (lesson: GeneratedLessonDraft) => void;
  onDiscard: (lesson: GeneratedLessonDraft) => void;
  onDuplicateReport: (lesson: GeneratedLessonDraft) => void;
  onApproveAll: () => void;
  onApproveSelected: () => void;
  onDiscardSelected: () => void;
  onRegenerateSelected: () => void;
  onExportDrafts: () => void;
  regenerating?: boolean;
  approving?: boolean;
}

export function LessonReviewPanel({
  analysis,
  suggestions,
  lessons,
  blockedLessons = [],
  rejectedLessons = [],
  qualityMetrics,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onPreview,
  onEdit,
  onRegenerate,
  onApprove,
  onDiscard,
  onDuplicateReport,
  onApproveAll,
  onApproveSelected,
  onDiscardSelected,
  onRegenerateSelected,
  onExportDrafts,
  regenerating,
  approving,
}: LessonReviewPanelProps) {
  const [view, setView] = useState<"table" | "cards">("table");
  const [sortBy, setSortBy] = useState<SortKey>("quality");
  const [search, setSearch] = useState("");
  const [intentFilter, setIntentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dupFilter, setDupFilter] = useState<DupFilter>("all");
  const [focusedIndex, setFocusedIndex] = useState(0);

  const intents = useMemo(
    () => [...new Set(lessons.map((l) => l.intentLabel))].sort(),
    [lessons]
  );

  const filteredLessons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lessons.filter((lesson) => {
      if (q && !lesson.question.toLowerCase().includes(q) && !lesson.answer.toLowerCase().includes(q)) {
        return false;
      }
      if (intentFilter && lesson.intentLabel !== intentFilter) return false;
      if (dupFilter !== "all" && lesson.duplicateRisk !== dupFilter) return false;
      if (statusFilter === "ready" && lesson.qualityStatus !== "ready") return false;
      if (statusFilter === "needs_review" && lesson.qualityStatus !== "needs_human_improvement") return false;
      if (statusFilter === "rejected" && lesson.qualityStatus !== "rejected") return false;
      if (statusFilter === "discarded" && lesson.reviewStatus !== "discarded") return false;
      if (statusFilter === "all" && lesson.reviewStatus === "discarded") return false;
      return true;
    });
  }, [lessons, search, intentFilter, statusFilter, dupFilter]);

  const sortedLessons = useMemo(() => {
    const list = [...filteredLessons];
    list.sort((a, b) => {
      const qa = a.qualityReport?.overallQuality ?? a.scores.overallScore;
      const qb = b.qualityReport?.overallQuality ?? b.scores.overallScore;
      const ca = a.qualityReport?.reviewerConfidence ?? a.estimatedConfidence;
      const cb = b.qualityReport?.reviewerConfidence ?? b.estimatedConfidence;
      switch (sortBy) {
        case "quality_asc":
          return qa - qb;
        case "confidence":
          return cb - ca;
        case "duplicate":
          return (b.qualityReport?.duplicateRiskPercent ?? 0) - (a.qualityReport?.duplicateRiskPercent ?? 0);
        case "coverage":
          return (b.qualityReport?.criteria.curriculumCoverage ?? 0) - (a.qualityReport?.criteria.curriculumCoverage ?? 0);
        case "readability":
          return (b.qualityReport?.criteria.humanReadability ?? 0) - (a.qualityReport?.criteria.humanReadability ?? 0);
        case "answer":
          return (b.qualityReport?.criteria.answerQuality ?? 0) - (a.qualityReport?.criteria.answerQuality ?? 0);
        case "intent":
          return a.intentLabel.localeCompare(b.intentLabel);
        case "quality":
        default:
          return qb - qa;
      }
    });
    return list;
  }, [filteredLessons, sortBy]);

  const activeLessons = useMemo(
    () => lessons.filter((l) => l.reviewStatus !== "discarded"),
    [lessons]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (sortedLessons.length === 0) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(sortedLessons.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === " " && sortedLessons[focusedIndex]) {
        e.preventDefault();
        onPreview(sortedLessons[focusedIndex]);
      } else if (e.key === "Enter" && sortedLessons[focusedIndex]) {
        e.preventDefault();
        onApprove(sortedLessons[focusedIndex]);
      } else if (e.key === "Delete" && sortedLessons[focusedIndex]) {
        e.preventDefault();
        onDiscard(sortedLessons[focusedIndex]);
      }
    },
    [sortedLessons, focusedIndex, onPreview, onApprove, onDiscard]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="space-y-6">
      <KnowledgeCompletionProgress
        completed={analysis.existingCount + activeLessons.filter((l) => l.qualityStatus === "ready").length}
        target={analysis.targetCount}
        averageQuality={qualityMetrics?.averageQualityScore}
        readyCount={qualityMetrics?.readyCount}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SuggestionCard label="Coverage improved" value={`+${suggestions.coverageImprovedPercent}%`} tone="emerald" />
        <SuggestionCard label="Missing intents" value={`${suggestions.missingIntentsBefore} → ${suggestions.missingIntentsAfter}`} tone="indigo" />
        <SuggestionCard label="Est. AI accuracy" value={`${suggestions.estimatedAccuracyPercent}%`} tone="violet" />
        <SuggestionCard
          label="Duplicate risk"
          value={suggestions.duplicateRiskLabel}
          tone={
            suggestions.duplicateRiskLabel === "Low"
              ? "emerald"
              : suggestions.duplicateRiskLabel === "Medium"
                ? "amber"
                : "red"
          }
        />
        <SuggestionCard label="Curriculum completion" value={`${suggestions.curriculumCompletionPercent}%`} tone="slate" />
      </div>

      <CoverageRecommendations analysis={analysis} />

      {/* Reviewer toolbar */}
      <div className="sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Reviewer Toolbar</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={saBtnPrimarySm} onClick={onApproveSelected} disabled={selectedIds.size === 0 || approving}>
            <Sparkles className="mr-1 h-3 w-3" />
            Approve Selected ({selectedIds.size})
          </button>
          <button type="button" className={saBtnSecondarySm} onClick={onRegenerateSelected} disabled={selectedIds.size === 0 || regenerating}>
            <RefreshCw className={cn("mr-1 h-3 w-3", regenerating && "animate-spin")} />
            Regenerate Selected
          </button>
          <button type="button" className={saBtnSecondarySm} onClick={onExportDrafts}>
            <Download className="mr-1 h-3 w-3" />
            Export Selected
          </button>
          <button type="button" className={saBtnSecondarySm} onClick={onApproveAll} disabled={approving}>
            Save All Ready
          </button>
          <button type="button" className={saBtnSecondarySm} onClick={onDiscardSelected} disabled={selectedIds.size === 0}>
            <Trash2 className="mr-1 h-3 w-3" />
            Discard Selected
          </button>
          <div className="ml-auto hidden text-[10px] text-slate-400 lg:block">
            Space · Preview · Enter · Approve · Delete · Reject · ↑↓ Navigate
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions…"
            className={cn(saInput, "pl-9")}
          />
        </div>
        <select
          value={intentFilter}
          onChange={(e) => setIntentFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All intents</option>
          {intents.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="ready">Ready</option>
          <option value="needs_review">Needs Review</option>
          <option value="rejected">Rejected</option>
          <option value="discarded">Discarded</option>
        </select>
        <select
          value={dupFilter}
          onChange={(e) => setDupFilter(e.target.value as DupFilter)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">All dup risk</option>
          <option value="none">None</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="quality">Highest quality</option>
          <option value="quality_asc">Lowest quality</option>
          <option value="confidence">Confidence</option>
          <option value="duplicate">Duplicate risk</option>
          <option value="coverage">Coverage</option>
          <option value="readability">Readability</option>
          <option value="answer">Answer quality</option>
          <option value="intent">Intent</option>
        </select>
        <div className="flex gap-1">
          <ViewToggle active={view === "table"} onClick={() => setView("table")} label="Table" />
          <ViewToggle active={view === "cards"} onClick={() => setView("cards")} label="Cards" />
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Showing {sortedLessons.length} of {lessons.length} ·{" "}
        {qualityMetrics?.readyCount ?? activeLessons.length} queue-ready · {blockedLessons.length} need improvement ·{" "}
        {rejectedLessons.length} rejected
      </p>

      {view === "table" ? (
        <div className={cn(saSection, "overflow-x-auto p-0")}>
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className={saSectionTitle}>Generation Preview</h3>
            <p className={saSectionSubtitle}>
              Review before saving — formatted scores show earned / maximum points per criterion
            </p>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className={saTableHeadRow}>
                <th className={saTableHeadCell}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === sortedLessons.length && sortedLessons.length > 0}
                    onChange={(e) => (e.target.checked ? onSelectAll() : onClearSelection())}
                  />
                </th>
                <th className={saTableHeadCell}>Question</th>
                <th className={saTableHeadCell}>Intent</th>
                <th className={saTableHeadCell}>Dup Risk</th>
                <th className={saTableHeadCell}>Quality</th>
                <th className={saTableHeadCell}>Confidence</th>
                <th className={saTableHeadCell}>Status</th>
                <th className={saTableHeadCell} />
              </tr>
            </thead>
            <tbody>
              {sortedLessons.map((lesson, idx) => {
                const q = lesson.qualityReport?.overallQuality ?? lesson.scores.overallScore;
                const conf = lesson.qualityReport?.reviewerConfidence ?? lesson.estimatedConfidence;
                const tierKey = lesson.qualityReport?.visualTier ?? "needs_improvement";
                const tier = QUALITY_TIER_STYLES[tierKey];
                return (
                  <tr
                    key={lesson.id}
                    className={cn(
                      saTableRowHover,
                      lesson.reviewStatus === "discarded" && "opacity-40",
                      idx === focusedIndex && "bg-indigo-50/60 ring-1 ring-inset ring-indigo-200"
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lesson.id)}
                        disabled={lesson.reviewStatus === "discarded"}
                        onChange={(e) => onToggleSelect(lesson.id, e.target.checked)}
                      />
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="font-medium text-slate-900">{lesson.question}</p>
                      <p className="mt-0.5 text-[10px] capitalize text-slate-400">{lesson.priority}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-violet-700">{lesson.intentLabel}</td>
                    <td className="px-4 py-3">
                      <DupRiskBadge risk={lesson.duplicateRisk} />
                      <p className="mt-0.5 text-[10px] tabular-nums text-slate-400">
                        {lesson.qualityReport?.duplicateRiskPercent ?? lesson.scores.duplicateRiskPercent}%
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset", tier.className)}>
                        {lesson.qualityReport?.grade ?? lesson.overallGrade} · {q}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-emerald-700">{conf}%</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lesson.qualityStatus ?? lesson.reviewStatus} quality={q} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className={saBtnSecondarySm} onClick={() => onPreview(lesson)}>
                          Preview
                        </button>
                        <button type="button" className={saBtnSecondarySm} onClick={() => onApprove(lesson)}>
                          Queue
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedLessons.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No lessons match your filters.</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sortedLessons.map((lesson) => (
            <GeneratedLessonCard
              key={lesson.id}
              lesson={lesson}
              selected={selectedIds.has(lesson.id)}
              onSelect={(sel) => onToggleSelect(lesson.id, sel)}
              onPreview={() => onPreview(lesson)}
              onEdit={() => onEdit(lesson)}
              onRegenerate={() => onRegenerate(lesson)}
              onApprove={() => onApprove(lesson)}
              onDiscard={() => onDiscard(lesson)}
              onDuplicateReport={() => onDuplicateReport(lesson)}
            />
          ))}
        </div>
      )}

      {blockedLessons.length > 0 ? (
        <div className={cn(saSection, "border-amber-200 bg-amber-50/40")}>
          <h3 className={saSectionTitle}>Needs Human Improvement</h3>
          <p className={saSectionSubtitle}>
            These drafts scored below 90 after automatic improvement. Edit or regenerate before queueing.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {blockedLessons.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-amber-100">
                <span className="font-medium">{l.question}</span>
                <span className="text-amber-800">
                  Q {l.qualityReport?.overallQuality ?? l.scores.overallScore} ·{" "}
                  {l.qualityReport?.reviewerConfidence ?? l.estimatedConfidence}% confidence
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SuggestionCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "indigo" | "violet" | "amber" | "red" | "slate";
}) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50/60",
    indigo: "border-indigo-200 bg-indigo-50/60",
    violet: "border-violet-200 bg-violet-50/60",
    amber: "border-amber-200 bg-amber-50/60",
    red: "border-red-200 bg-red-50/60",
    slate: "border-slate-200 bg-slate-50/60",
  };
  return (
    <div className={cn("rounded-xl border p-4 transition-shadow hover:shadow-sm", tones[tone])}>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ViewToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
