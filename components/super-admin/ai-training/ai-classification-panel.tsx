"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { saBtnSecondarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import { getIntentDefinition } from "@/lib/ai-training/intent-registry";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

interface AIClassificationPanelProps {
  entry: Pick<
    AIKnowledgeEntry,
    | "intent_key"
    | "intent_name"
    | "intent_group"
    | "related_intents"
    | "intent_confidence"
    | "intent_recalculated_at"
  >;
  recalculating?: boolean;
  onRecalculate: () => void;
}

function formatConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

function relatedIntentLabel(key: string): string {
  const def = getIntentDefinition(key);
  return def?.name ?? key;
}

export function AIClassificationPanel({
  entry,
  recalculating = false,
  onRecalculate,
}: AIClassificationPanelProps) {
  const related = entry.related_intents ?? [];

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">AI Classification</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Automatically inferred from the question and category. Read-only.
          </p>
        </div>
        <button
          type="button"
          className={saBtnSecondarySm}
          disabled={recalculating}
          onClick={onRecalculate}
        >
          {recalculating ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Recalculate Intent
        </button>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Intent Key" value={entry.intent_key ?? "—"} mono />
        <Field label="Intent Name" value={entry.intent_name ?? "—"} />
        <Field label="Intent Group" value={entry.intent_group ?? "—"} />
        <Field label="Confidence" value={formatConfidence(entry.intent_confidence)} />
      </dl>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Related Intents
        </p>
        {related.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">None linked.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {related.map((key) => (
              <li key={key} className="text-sm text-slate-700">
                • {relatedIntentLabel(key)}{" "}
                <span className="font-mono text-xs text-slate-400">({key})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {entry.intent_recalculated_at ? (
        <p className="mt-3 text-xs text-slate-400">
          Last recalculated: {new Date(entry.intent_recalculated_at).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "mt-0.5 font-mono text-sm text-slate-800"
            : "mt-0.5 text-sm font-medium text-slate-800"
        }
      >
        {value}
      </dd>
    </div>
  );
}
