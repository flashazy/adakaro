"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ExplainedFact } from "@/lib/ai-author/types";
import { AuthorPanel, ScoreBadge } from "@/components/ai-training/author-panel-shared";
import { cn } from "@/lib/utils";

export function AIFactInspector({ facts }: { facts: ExplainedFact[] }) {
  const [filter, setFilter] = useState<"all" | "used" | "discarded">("all");

  const filtered = useMemo(() => {
    if (filter === "used") return facts.filter((f) => f.used);
    if (filter === "discarded") return facts.filter((f) => !f.used);
    return facts;
  }, [facts, filter]);

  if (facts.length === 0) return null;

  const usedCount = facts.filter((f) => f.used).length;

  return (
    <AuthorPanel
      title="Fact Inspector"
      icon={<Search className="h-4 w-4 text-sky-500" />}
      badge={
        <span className="text-[10px] text-slate-500">
          {usedCount} / {facts.length} used
        </span>
      }
      defaultOpen={false}
    >
      <div className="mb-3 flex gap-1">
        {(["all", "used", "discarded"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={cn(
              "rounded-md px-2 py-1 text-[10px] font-semibold capitalize transition-colors",
              filter === tab
                ? "bg-indigo-100 text-indigo-700"
                : "text-slate-500 hover:bg-slate-100"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {filtered.map((fact) => (
          <li
            key={fact.id}
            className={cn(
              "rounded-lg px-3 py-2 ring-1 ring-inset",
              fact.used ? "bg-emerald-50/40 ring-emerald-100" : "bg-slate-50/60 ring-slate-100"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-slate-800">{fact.text}</p>
              <ScoreBadge score={fact.score} variant={fact.used ? "success" : "muted"} />
            </div>
            <div className="mt-1.5 space-y-0.5 text-[10px] text-slate-500">
              <p>
                <span className="font-semibold text-slate-600">Source:</span> {fact.sourceQuestion}
              </p>
              <p>
                <span className="font-semibold text-slate-600">Status:</span>{" "}
                {fact.used ? (
                  <span className="font-semibold text-emerald-600">Used</span>
                ) : fact.accepted ? (
                  <span className="font-semibold text-amber-600">Accepted, unused</span>
                ) : (
                  <span className="text-slate-400">Rejected</span>
                )}
              </p>
              {fact.rejectionCategory ? (
                <p>
                  <span className="font-semibold text-slate-600">Category:</span>{" "}
                  {fact.rejectionCategory.replace(/_/g, " ")}
                </p>
              ) : null}
              <p>
                <span className="font-semibold text-slate-600">Reason:</span> {fact.reason}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </AuthorPanel>
  );
}
