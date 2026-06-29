"use client";

import { BarChart3 } from "lucide-react";
import type { CoverageAnalysis } from "@/lib/ai-author/types";
import { AuthorPanel, ProgressBar } from "@/components/ai-training/author-panel-shared";

export function AICoveragePanel({ coverage }: { coverage: CoverageAnalysis }) {
  return (
    <AuthorPanel
      title="Coverage Analysis"
      icon={<BarChart3 className="h-4 w-4 text-indigo-500" />}
      badge={
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
          {coverage.overall}% overall
        </span>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">Overall Coverage</span>
            <span className="font-bold tabular-nums text-slate-900">{coverage.overall}%</span>
          </div>
          <ProgressBar value={coverage.overall} />
        </div>

        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Coverage by topic
          </p>
          {coverage.byTopic.map((topic) => (
            <div key={topic.topic}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-600">{topic.topic}</span>
                <span className="font-semibold tabular-nums text-slate-800">{topic.percentage}%</span>
              </div>
              <ProgressBar value={topic.percentage} />
              {topic.missing.length > 0 ? (
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Missing: {topic.missing.slice(0, 3).join(", ")}
                  {topic.missing.length > 3 ? ` +${topic.missing.length - 3}` : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {coverage.missingSections.length > 0 ? (
          <div className="rounded-lg bg-amber-50/60 px-3 py-2 ring-1 ring-inset ring-amber-100">
            <p className="text-[10px] font-semibold text-amber-800">Missing sections</p>
            <p className="mt-0.5 text-xs text-amber-700">{coverage.missingSections.join(", ")}</p>
          </div>
        ) : null}
      </div>
    </AuthorPanel>
  );
}
