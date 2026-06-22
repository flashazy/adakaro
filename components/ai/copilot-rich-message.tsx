"use client";

import { cn } from "@/lib/utils";
import type { AISuggestion } from "@/lib/ai/types";
import type {
  CopilotBlock,
  CopilotMessageMeta,
} from "@/lib/ai/copilot/types";

const insightIcons = {
  alert: "⚠️",
  trend: "📈",
  academic: "📚",
  info: "ℹ️",
} as const;

function MetricCards({ block }: { block: Extract<CopilotBlock, { type: "metrics" }> }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {block.items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "rounded-xl border px-3 py-2.5",
            item.highlight
              ? "border-indigo-200 bg-indigo-50/80 dark:border-indigo-900/50 dark:bg-indigo-950/30"
              : "border-slate-200 bg-slate-50/80 dark:border-zinc-700 dark:bg-zinc-900/60"
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {item.label}
          </p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function DataTable({ block }: { block: Extract<CopilotBlock, { type: "table" }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-700">
      {block.title ? (
        <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          {block.title}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              {block.headers.map((h) => (
                <th key={h} className="px-3 py-2 font-semibold text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-slate-50 last:border-0 dark:border-zinc-900"
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-slate-700 dark:text-zinc-300">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InsightCard({ block }: { block: Extract<CopilotBlock, { type: "insight" }> }) {
  return (
    <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/60 px-3.5 py-3 dark:border-amber-900/40 dark:from-amber-950/30 dark:to-orange-950/20">
      <p className="text-sm font-semibold text-slate-900 dark:text-amber-100">
        <span aria-hidden>{insightIcons[block.icon]} </span>
        {block.title}
      </p>
      <p className="mt-1 text-sm text-slate-700 dark:text-amber-100/90">{block.body}</p>
      {block.recommendation ? (
        <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-200">
          Recommendation: {block.recommendation}
        </p>
      ) : null}
    </div>
  );
}

function RecommendationList({
  block,
}: {
  block: Extract<CopilotBlock, { type: "recommendations" }>;
}) {
  return (
    <ul className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/60">
      {block.items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-slate-700 dark:text-zinc-300">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function CopilotRichBlocks({ meta }: { meta: CopilotMessageMeta }) {
  if (!meta.blocks.length) return null;

  return (
    <div className="mt-3 space-y-3">
      {meta.blocks.map((block, i) => {
        switch (block.type) {
          case "metrics":
            return <MetricCards key={i} block={block} />;
          case "table":
            return <DataTable key={i} block={block} />;
          case "insight":
            return <InsightCard key={i} block={block} />;
          case "recommendations":
            return <RecommendationList key={i} block={block} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

export function CopilotActionChips({
  actions,
  onSelect,
  disabled = false,
}: {
  actions: AISuggestion[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  if (actions.length === 0) return null;

  return (
    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-zinc-800">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Suggested actions
      </p>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(action.prompt)}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition-all duration-200 hover:-translate-y-px hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
