"use client";

import { Brain, GitBranch, ShieldCheck } from "lucide-react";
import type { ReasoningReport } from "@/lib/ai-author/types";
import { AuthorPanel, ProgressBar, ScoreBadge } from "@/components/ai-training/author-panel-shared";

export function AIReasoningPanel({ reasoning }: { reasoning: ReasoningReport }) {
  const { knowledgeHealth, sectionConfidence, factConfidenceReasons, knowledgeGraph, validationNotes } =
    reasoning;

  return (
    <div className="space-y-3">
      <AuthorPanel
        title="Knowledge Health"
        icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}
        badge={<ScoreBadge score={knowledgeHealth.overall} variant="success" />}
      >
        <div className="space-y-3">
          <ProgressBar value={knowledgeHealth.overall} />
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <span>
              <span className="font-semibold text-slate-800">{knowledgeHealth.gapCount}</span> knowledge
              gaps
            </span>
            <span>
              <span className="font-semibold text-slate-800">
                {knowledgeHealth.recommendedLessons.length}
              </span>{" "}
              recommended lessons
            </span>
          </div>
        </div>
      </AuthorPanel>

      <AuthorPanel
        title="Confidence Breakdown"
        icon={<Brain className="h-4 w-4 text-indigo-500" />}
        defaultOpen={false}
      >
        <div className="space-y-3">
          {factConfidenceReasons.length > 0 ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-inset ring-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reason</p>
              <ul className="mt-1 space-y-0.5">
                {factConfidenceReasons.map((reason) => (
                  <li key={reason} className="text-xs text-slate-600">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-2">
            {sectionConfidence.map((section) => (
              <div key={section.section}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-600">{section.section}</span>
                  <span className="font-semibold tabular-nums">{section.confidence}%</span>
                </div>
                <ProgressBar value={section.confidence} />
              </div>
            ))}
          </div>
        </div>
      </AuthorPanel>

      {knowledgeGraph.length > 0 ? (
        <AuthorPanel
          title="Knowledge Graph"
          icon={<GitBranch className="h-4 w-4 text-violet-500" />}
          defaultOpen={false}
        >
          <ul className="space-y-1.5">
            {knowledgeGraph.map((node, i) => (
              <li
                key={`${node.type}-${node.question}-${i}`}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ring-1 ring-inset ring-slate-100"
              >
                <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-600">
                  {node.type}
                </span>
                <span className="text-slate-700">{node.question}</span>
              </li>
            ))}
          </ul>
        </AuthorPanel>
      ) : null}

      {validationNotes.length > 0 ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-800">
          {validationNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
