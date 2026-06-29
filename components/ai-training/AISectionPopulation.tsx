"use client";

import { Layers } from "lucide-react";
import type { SectionPopulation } from "@/lib/ai-author/types";
import { AuthorPanel } from "@/components/ai-training/author-panel-shared";

export function AISectionPopulation({ sections }: { sections: SectionPopulation[] }) {
  if (sections.length === 0) return null;

  const maxLabel = Math.max(...sections.map((s) => s.section.length), 8);

  return (
    <AuthorPanel
      title="Section Population"
      icon={<Layers className="h-4 w-4 text-teal-500" />}
      defaultOpen={false}
    >
      <ul className="space-y-1.5 font-mono text-xs">
        {sections.map((entry) => (
          <li key={entry.section} className="flex items-center gap-2 text-slate-700">
            <span className="shrink-0 text-slate-600" style={{ minWidth: `${maxLabel}ch` }}>
              {entry.section}
            </span>
            <span className="text-slate-300">
              {".".repeat(Math.max(2, 24 - entry.section.length))}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">
              {entry.factCount} {entry.factCount === 1 ? "fact" : "facts"}
            </span>
          </li>
        ))}
      </ul>
    </AuthorPanel>
  );
}
