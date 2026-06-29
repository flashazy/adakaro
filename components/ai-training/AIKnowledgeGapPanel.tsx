"use client";

import { AlertCircle } from "lucide-react";
import type { KnowledgeGapItem, SuggestedLesson } from "@/lib/ai-author/types";
import { AuthorPanel, ScoreBadge } from "@/components/ai-training/author-panel-shared";

export function AIKnowledgeGapPanel({
  gaps,
  suggestedLessons,
}: {
  gaps: KnowledgeGapItem[];
  suggestedLessons: SuggestedLesson[];
}) {
  const missing = gaps.filter((g) => !g.covered);

  if (gaps.length === 0) return null;

  return (
    <AuthorPanel
      title="Knowledge Gaps"
      icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
      badge={
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-100">
          {missing.length} missing
        </span>
      }
      defaultOpen={missing.length > 0}
    >
      <div className="space-y-4">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {gaps.map((gap) => (
            <div
              key={gap.topic}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ring-1 ring-inset ring-slate-100"
            >
              <span
                className={
                  gap.covered
                    ? "text-emerald-600"
                    : "text-slate-300"
                }
              >
                {gap.covered ? "✔" : "□"}
              </span>
              <span className={gap.covered ? "text-slate-600" : "font-medium text-slate-800"}>
                {gap.topic}
              </span>
              <span className="ml-auto text-[10px] text-slate-400">{gap.category}</span>
            </div>
          ))}
        </div>

        {suggestedLessons.length > 0 ? (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Suggested lessons to create
            </p>
            <ul className="space-y-2">
              {suggestedLessons.slice(0, 5).map((lesson) => (
                <li
                  key={lesson.question}
                  className="rounded-lg bg-slate-50/80 px-3 py-2 ring-1 ring-inset ring-slate-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-slate-800">{lesson.question}</p>
                    {lesson.status === "in_progress" ? (
                      <span className="shrink-0 text-[10px] font-semibold text-emerald-600">✔ In progress</span>
                    ) : (
                      <ScoreBadge score={lesson.importance} />
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-slate-500">
                    <span>Coverage +{lesson.coverageIncrease}%</span>
                    <span>·</span>
                    <span>Demand {lesson.searchDemand}</span>
                    <span>·</span>
                    <span className="capitalize">{lesson.priority}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">{lesson.businessImpact}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </AuthorPanel>
  );
}
