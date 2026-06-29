"use client";

import { Bug } from "lucide-react";
import { useState } from "react";
import type { PipelineDebugTrace } from "@/lib/ai-author/types";
import { AuthorPanel, ProgressBar, ScoreBadge } from "@/components/ai-training/author-panel-shared";

export function AIKnowledgeAuthorPipelineDebug({ trace }: { trace: PipelineDebugTrace }) {
  const [expandedFactId, setExpandedFactId] = useState<string | null>(null);

  return (
    <AuthorPanel
      title="Pipeline Debug"
      icon={<Bug className="h-4 w-4 text-rose-500" />}
      badge={
        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
          {trace.acceptanceRate}% acceptance
        </span>
      }
      defaultOpen={trace.factsAccepted === 0}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Lessons Read", trace.lessonsRead],
            ["Lessons Selected", trace.lessonsSelected],
            ["Facts Extracted", trace.factsExtracted],
            ["Facts Accepted", trace.factsAccepted],
            ["Facts Rejected", trace.factsRejected],
            ["Facts Used", trace.factsUsed],
            ["Sections Generated", trace.sectionsGenerated],
            ["Draft Length", trace.draftLength],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-lg bg-slate-50 px-2.5 py-2 ring-1 ring-inset ring-slate-100"
            >
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </p>
              <p className="text-sm font-bold tabular-nums text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-600">Acceptance Rate</span>
            <span className="font-semibold">{trace.acceptanceRate}%</span>
          </div>
          <ProgressBar value={trace.acceptanceRate} />
          <p className="mt-1 text-[10px] text-slate-500">
            Avg confidence: {trace.averageConfidence}% · Validation: {trace.validationResult}
          </p>
        </div>

        {trace.composerWarning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {trace.composerWarning}
          </div>
        ) : null}

        {trace.topRejectionReasons.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Top rejection reasons
            </p>
            <div className="flex flex-wrap gap-1.5">
              {trace.topRejectionReasons.map((entry) => (
                <span
                  key={entry.reason}
                  className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700"
                >
                  {entry.label} · {entry.count}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Selected lessons
          </p>
          <ul className="space-y-1.5">
            {trace.lessonTraces
              .filter((lesson) => lesson.selected)
              .map((lesson) => (
                <li
                  key={lesson.entryId}
                  className="rounded-lg px-2.5 py-2 text-xs ring-1 ring-inset ring-slate-100"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{lesson.question}</span>
                    <ScoreBadge score={lesson.score} />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {lesson.selectionReasons.slice(0, 3).join(" · ")}
                  </p>
                </li>
              ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Fact lifecycle ({trace.factTraces.length})
          </p>
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {trace.factTraces.map((fact) => (
              <li
                key={fact.id}
                className="rounded-lg px-3 py-2 ring-1 ring-inset ring-slate-100"
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() =>
                    setExpandedFactId((current) => (current === fact.id ? null : fact.id))
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-800">{fact.rawText}</p>
                    <ScoreBadge
                      score={fact.scores.final}
                      variant={fact.accepted ? "success" : "muted"}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {fact.sourceQuestion} ·{" "}
                    {fact.accepted ? (fact.used ? "Used" : "Accepted") : "Rejected"}
                  </p>
                </button>

                {expandedFactId === fact.id ? (
                  <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 font-mono text-[10px] text-slate-600">
                    <p>Entity: {fact.detectedEntity ?? "—"}</p>
                    <p>Intent: {fact.detectedIntent}</p>
                    <p>Section: {fact.sectionHint ?? "—"}</p>
                    <p>Semantic .......... {fact.scores.semantic}</p>
                    <p>Entity .......... {fact.scores.entity}</p>
                    <p>Intent .......... {fact.scores.intent}</p>
                    <p>Evidence .......... {fact.scores.evidence}</p>
                    <p>Published .......... {fact.scores.published}</p>
                    <p>Provenance .......... {fact.scores.lessonProvenance}</p>
                    <p>Penalty .......... {fact.scores.penalties}</p>
                    <p className="font-semibold text-slate-800">
                      Final .......... {fact.scores.final}
                    </p>
                    <p className="font-sans text-slate-700">{fact.rejectionReason}</p>
                    {!fact.accepted ? (
                      <p className="font-sans text-rose-700">
                        Threshold: {fact.threshold} · Actual: {fact.scores.final}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AuthorPanel>
  );
}
