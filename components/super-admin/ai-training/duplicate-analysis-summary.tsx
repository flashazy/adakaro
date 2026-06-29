"use client";

import { getCategoryGroupLabel } from "@/lib/ai-training/knowledge-categories";
import { CURRICULUM_MODULES, resolveEntryModuleId } from "@/lib/ai-training/knowledge-curriculum";
import type { DuplicateMatchApiItem } from "./knowledge-duplicate-panel";
import { cn } from "@/lib/utils";

interface DuplicateAnalysisSummaryProps {
  currentQuestion: string;
  currentCategory?: string;
  currentIntent?: { label: string; category: string };
  currentEntity?: { label: string } | null;
  match?: DuplicateMatchApiItem | null;
  recommendationLabel: string;
  recommendationTone?: "danger" | "warning" | "info" | "success";
}

export function DuplicateAnalysisSummary({
  currentQuestion,
  currentCategory,
  currentIntent,
  currentEntity,
  match,
  recommendationLabel,
  recommendationTone = "info",
}: DuplicateAnalysisSummaryProps) {
  const toneStyles = {
    danger: "border-red-200 bg-red-50 text-red-900",
    warning: "border-orange-200 bg-orange-50 text-orange-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };

  const moduleName = currentCategory
    ? CURRICULUM_MODULES.find(
        (m) =>
          m.id ===
          resolveEntryModuleId({ category: currentCategory, curriculum_module: null })
      )?.name
    : null;

  return (
    <div className="space-y-3">
      <div className={cn("rounded-xl border px-3.5 py-3", toneStyles[recommendationTone])}>
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
          Recommendation
        </p>
        <p className="mt-0.5 text-sm font-semibold">{recommendationLabel}</p>
        {match ? (
          <p className="mt-1 text-xs opacity-80">{match.similarity}% overall similarity</p>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <AnalysisColumn
          title="Current Question"
          question={currentQuestion}
          intent={currentIntent?.label}
          entity={currentEntity?.label}
          category={currentCategory}
          module={moduleName ?? undefined}
        />
        {match ? (
          <AnalysisColumn
            title="Existing Question"
            question={match.entry.question}
            intent={match.entryIntentSignature.label}
            entity={match.entryEntity?.label}
            category={match.entry.category}
            module={
              CURRICULUM_MODULES.find(
                (m) =>
                  m.id ===
                  resolveEntryModuleId({
                    category: match.entry.category,
                    curriculum_module: null,
                  })
              )?.name
            }
          />
        ) : null}
      </div>

      {match ? (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <ScorePill label="Intent" value={match.scores.intentSimilarity} />
          <ScorePill label="Entity" value={match.scores.entitySimilarity} />
          <ScorePill label="Keywords" value={match.scores.keywordOverlap} />
          <ScorePill label="Meaning" value={match.scores.meaning ?? match.scores.semanticSimilarity} />
        </div>
      ) : null}

      {currentCategory ? (
        <p className="text-[10px] text-slate-500">
          Category group: {getCategoryGroupLabel(currentCategory)}
          {moduleName ? ` · Module: ${moduleName}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function AnalysisColumn({
  title,
  question,
  intent,
  entity,
  category,
  module,
}: {
  title: string;
  question: string;
  intent?: string;
  entity?: string;
  category?: string;
  module?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-xs font-medium text-slate-900">{question}</p>
      <dl className="mt-2 space-y-0.5 text-[10px] text-slate-600">
        {intent ? (
          <div className="flex gap-1">
            <dt className="font-semibold text-slate-500">Intent:</dt>
            <dd>{intent}</dd>
          </div>
        ) : null}
        {entity ? (
          <div className="flex gap-1">
            <dt className="font-semibold text-slate-500">Entity:</dt>
            <dd>{entity}</dd>
          </div>
        ) : null}
        {category ? (
          <div className="flex gap-1">
            <dt className="font-semibold text-slate-500">Category:</dt>
            <dd>{category}</dd>
          </div>
        ) : null}
        {module ? (
          <div className="flex gap-1">
            <dt className="font-semibold text-slate-500">Module:</dt>
            <dd>{module}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5 ring-1 ring-slate-100">
      <p className="text-[9px] font-semibold uppercase text-slate-400">{label}</p>
      <p className="text-xs font-bold tabular-nums text-slate-700">{value}%</p>
    </div>
  );
}
