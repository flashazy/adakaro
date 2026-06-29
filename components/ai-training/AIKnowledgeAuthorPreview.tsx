"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import type { DraftGenerationResult } from "@/lib/ai-author/types";
import { AICoveragePanel } from "@/components/ai-training/AICoveragePanel";
import { AIFactInspector } from "@/components/ai-training/AIFactInspector";
import { AIKnowledgeGapPanel } from "@/components/ai-training/AIKnowledgeGapPanel";
import { AILessonRanking } from "@/components/ai-training/AILessonRanking";
import { AIReasoningPanel } from "@/components/ai-training/AIReasoningPanel";
import { AIKnowledgeAuthorPipelineDebug } from "@/components/ai-training/AIKnowledgeAuthorPipelineDebug";
import { AISectionPopulation } from "@/components/ai-training/AISectionPopulation";
import { ProgressBar, StatCard } from "@/components/ai-training/author-panel-shared";
import { cn } from "@/lib/utils";

export function AIKnowledgeAuthorPreview({
  result,
  className,
}: {
  result: DraftGenerationResult;
  className?: string;
}) {
  const d = result.diagnostics;
  const r = result.reasoning;

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 via-white to-indigo-50/30 p-4 shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <p className="font-semibold text-emerald-900">Enterprise Draft Ready</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
          {d.confidence.overall}% overall · {result.templateFamily}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="Facts Extracted" value={d.factsExtracted} />
        <StatCard label="Facts Accepted" value={d.factsAccepted} />
        <StatCard label="Facts Rejected" value={d.factsRejected} />
        <StatCard label="Facts Used" value={d.factsUsed} />
        <StatCard label="Lessons Read" value={d.lessonsRead} />
        <StatCard label="Lessons Selected" value={d.lessonsSelected} />
        <StatCard label="Duplicates Removed" value={d.duplicatesRemoved} />
        <StatCard label="Fact Confidence" value={`${d.confidence.facts}%`} />
      </div>

      {d.rejectionSummary.length > 0 ? (
        <div className="rounded-lg bg-white/80 px-3 py-2.5 ring-1 ring-inset ring-slate-100">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Rejection reasons
          </p>
          <div className="flex flex-wrap gap-2">
            {d.rejectionSummary.map((entry) => (
              <span
                key={entry.reason}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
              >
                {entry.label} · {entry.count}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg bg-white/80 px-3 py-2.5 ring-1 ring-inset ring-slate-100">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">Overall Coverage</span>
          <span className="font-bold tabular-nums text-slate-900">{r.coverage.overall}%</span>
        </div>
        <ProgressBar value={r.coverage.overall} />
        <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-slate-500">
          <span>Intent {d.confidence.intent}%</span>
          <span>·</span>
          <span>Facts {d.confidence.facts}%</span>
          <span>·</span>
          <span>{result.sections.length} sections</span>
          {d.validation.rebuildReason ? (
            <>
              <span>·</span>
              <span className="font-medium text-blue-600">{d.validation.rebuildReason}</span>
            </>
          ) : null}
        </div>
      </div>

      {d.conflicts.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
          {d.conflicts.map((conflict) => (
            <div key={conflict.id} className="text-amber-900">
              <p className="flex items-center gap-1 text-xs font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                {conflict.message}
              </p>
              <p className="mt-1 text-[10px]">A: {conflict.factA}</p>
              <p className="text-[10px]">B: {conflict.factB}</p>
            </div>
          ))}
        </div>
      ) : null}

      <AISectionPopulation sections={d.sectionPopulation} />

      <AIKnowledgeAuthorPipelineDebug trace={result.pipelineTrace} />

      <AILessonRanking
        rankings={r.lessonRankings}
        lessonsRead={d.lessonsRead}
        lessonsSelected={d.lessonsSelected}
        lessonsDiscarded={d.lessonsDiscarded}
      />

      <AICoveragePanel coverage={r.coverage} />

      <AIKnowledgeGapPanel gaps={r.knowledgeGaps} suggestedLessons={r.suggestedLessons} />

      <AIFactInspector facts={r.facts} />

      <AIReasoningPanel reasoning={r} />
    </div>
  );
}
