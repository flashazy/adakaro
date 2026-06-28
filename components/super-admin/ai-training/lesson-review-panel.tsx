"use client";

import { useMemo, useState } from "react";
import {
  CheckSquare,
  Download,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  saBtnPrimary,
  saBtnPrimarySm,
  saBtnSecondary,
  saBtnSecondarySm,
  saSection,
  saSectionSubtitle,
  saSectionTitle,
  saTableHeadCell,
  saTableHeadRow,
  saTableRowHover,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { GeneratedLessonCard, GRADE_STYLES, DUP_STYLES } from "@/components/super-admin/ai-training/generated-lesson-card";
import type {
  CurriculumAnalysis,
  GeneratedLessonDraft,
  GenerationSmartSuggestions,
} from "@/lib/ai-training/lesson-generator";
import type { QualityPipelineMetrics } from "@/lib/ai-training/knowledge-quality-report";
import { QUALITY_TIER_STYLES } from "@/lib/ai-training/knowledge-quality-rules";
import { cn } from "@/lib/utils";

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
  const [sortBy, setSortBy] = useState<
    "quality" | "quality_asc" | "duplicate" | "coverage" | "readability" | "answer"
  >("quality");

  const sortedLessons = useMemo(() => {
    const list = [...lessons];
    list.sort((a, b) => {
      const qa = a.qualityReport?.overallQuality ?? a.scores.overallScore;
      const qb = b.qualityReport?.overallQuality ?? b.scores.overallScore;
      switch (sortBy) {
        case "quality_asc":
          return qa - qb;
        case "duplicate":
          return (b.qualityReport?.duplicateRiskPercent ?? 0) - (a.qualityReport?.duplicateRiskPercent ?? 0);
        case "coverage":
          return (b.qualityReport?.criteria.curriculumCoverage ?? 0) - (a.qualityReport?.criteria.curriculumCoverage ?? 0);
        case "readability":
          return (b.qualityReport?.criteria.humanReadability ?? 0) - (a.qualityReport?.criteria.humanReadability ?? 0);
        case "answer":
          return (b.qualityReport?.criteria.answerQuality ?? 0) - (a.qualityReport?.criteria.answerQuality ?? 0);
        case "quality":
        default:
          return qb - qa;
      }
    });
    return list;
  }, [lessons, sortBy]);

  const activeLessons = useMemo(
    () => lessons.filter((l) => l.reviewStatus !== "discarded"),
    [lessons]
  );

  return (
    <div className="space-y-6">
      {/* Smart suggestions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SuggestionCard
          label="Coverage improved"
          value={`+${suggestions.coverageImprovedPercent}%`}
          tone="emerald"
        />
        <SuggestionCard
          label="Missing intents"
          value={`${suggestions.missingIntentsBefore} → ${suggestions.missingIntentsAfter}`}
          tone="indigo"
        />
        <SuggestionCard
          label="Est. AI accuracy"
          value={`${suggestions.estimatedAccuracyPercent}%`}
          tone="violet"
        />
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
        <SuggestionCard
          label="Curriculum completion"
          value={`${suggestions.curriculumCompletionPercent}%`}
          tone="slate"
        />
      </div>

      {/* Analysis summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <AnalysisCard title="Missing concepts" items={analysis.missingConcepts.slice(0, 6)} />
        <AnalysisCard title="Missing intents" items={analysis.missingIntents.slice(0, 6)} />
        <AnalysisCard title="Weak coverage" items={analysis.weakCoverage.slice(0, 4)} />
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <button type="button" className={saBtnPrimarySm} onClick={onApproveAll} disabled={approving}>
          <Sparkles className="mr-1 h-3 w-3" />
          Save All to Queue ({activeLessons.length})
        </button>
        <button
          type="button"
          className={saBtnSecondarySm}
          onClick={onApproveSelected}
          disabled={selectedIds.size === 0 || approving}
        >
          <CheckSquare className="mr-1 h-3 w-3" />
          Save Selected to Queue ({selectedIds.size})
        </button>
        <button
          type="button"
          className={saBtnSecondarySm}
          onClick={onDiscardSelected}
          disabled={selectedIds.size === 0}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Discard Selected
        </button>
        <button
          type="button"
          className={saBtnSecondarySm}
          onClick={onRegenerateSelected}
          disabled={selectedIds.size === 0 || regenerating}
        >
          <RefreshCw className={cn("mr-1 h-3 w-3", regenerating && "animate-spin")} />
          Regenerate Selected
        </button>
        <button type="button" className={saBtnSecondarySm} onClick={onExportDrafts}>
          <Download className="mr-1 h-3 w-3" />
          Export Drafts
        </button>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold",
              view === "table" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            )}
            onClick={() => setView("table")}
          >
            Table
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold",
              view === "cards" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            )}
            onClick={() => setView("cards")}
          >
            Cards
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {activeLessons.length} queue-ready lesson(s) · {blockedLessons.length} need human
        improvement · {rejectedLessons.length} rejected · Module:{" "}
        <span className="font-medium text-slate-700">{analysis.moduleName}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-slate-500">Sort by</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
        >
          <option value="quality">Highest quality</option>
          <option value="quality_asc">Lowest quality</option>
          <option value="duplicate">Duplicate risk</option>
          <option value="coverage">Coverage</option>
          <option value="readability">Readability</option>
          <option value="answer">Answer quality</option>
        </select>
      </div>

      {view === "table" ? (
        <div className={cn(saSection, "overflow-x-auto p-0")}>
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className={saSectionTitle}>Generation Preview</h3>
            <p className={saSectionSubtitle}>
              Review before saving — use Save to Queue; nothing goes live until published from Approval Queue
            </p>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className={saTableHeadRow}>
                <th className={saTableHeadCell}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === activeLessons.length && activeLessons.length > 0}
                    onChange={(e) => (e.target.checked ? onSelectAll() : onClearSelection())}
                  />
                </th>
                <th className={saTableHeadCell}>Question</th>
                <th className={saTableHeadCell}>Intent</th>
                <th className={saTableHeadCell}>Priority</th>
                <th className={saTableHeadCell}>Duplicate Risk</th>
                <th className={saTableHeadCell}>Coverage</th>
                <th className={saTableHeadCell}>Quality</th>
                <th className={saTableHeadCell}>Status</th>
                <th className={saTableHeadCell} />
              </tr>
            </thead>
            <tbody>
              {sortedLessons.map((lesson) => {
                const q = lesson.qualityReport?.overallQuality ?? lesson.scores.overallScore;
                const tierKey = lesson.qualityReport?.visualTier ?? "needs_improvement";
                const tier = QUALITY_TIER_STYLES[tierKey];
                return (
                <tr
                  key={lesson.id}
                  className={cn(
                    saTableRowHover,
                    lesson.reviewStatus === "discarded" && "opacity-40"
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
                  <td className="max-w-xs px-4 py-3 font-medium text-slate-900">
                    {lesson.question}
                  </td>
                  <td className="px-4 py-3 text-xs text-violet-700">{lesson.intentLabel}</td>
                  <td className="px-4 py-3 capitalize">{lesson.priority}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        DUP_STYLES[lesson.duplicateRisk]
                      )}
                    >
                      {lesson.duplicateRisk}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{lesson.scores.coverageScore}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                        tier.className
                      )}
                    >
                      {lesson.qualityReport?.grade ?? lesson.overallGrade} · {q}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-xs">
                    {lesson.qualityStatus ?? lesson.reviewStatus}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className={saBtnSecondarySm} onClick={() => onPreview(lesson)}>
                        Preview
                      </button>
                      <button type="button" className={saBtnSecondarySm} onClick={() => onApprove(lesson)}>
                        Save to Queue
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {lessons.map((lesson) => (
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
            These drafts scored below 90 after automatic improvement and will not enter the
            Approval Queue.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {blockedLessons.map((l) => (
              <li key={l.id} className="rounded-lg bg-white/80 px-3 py-2 ring-1 ring-amber-100">
                <span className="font-medium">{l.question}</span>
                <span className="ml-2 text-amber-800">
                  Score: {l.qualityReport?.overallQuality ?? l.scores.overallScore}
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
    <div className={cn("rounded-xl border p-4", tones[tone])}>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function AnalysisCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={cn(saSection, "bg-white")}>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-400">None identified</p>
      )}
    </div>
  );
}
