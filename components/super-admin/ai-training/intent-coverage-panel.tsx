"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2 } from "lucide-react";
import {
  saSectionSubtitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";
import type { IntentCoverageSummary } from "@/lib/ai-training/types";

export function IntentCoveragePanel() {
  const [coverage, setCoverage] = useState<IntentCoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/ai-training/intent-coverage");
      if (res.ok) setCoverage((await res.json()) as IntentCoverageSummary);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
          <Brain className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Intent coverage</h3>
          <p className={cn(saSectionSubtitle, "mt-0.5")}>
            Track which Adakaro intents have trained knowledge entries.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading intent coverage…
        </div>
      ) : coverage ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Total intents" value={String(coverage.totalIntents)} />
            <Tile
              label="Covered"
              value={String(coverage.coveredIntents)}
              tone="ok"
            />
            <Tile
              label="Missing"
              value={String(coverage.missingIntents)}
              tone={coverage.missingIntents > 0 ? "warn" : "ok"}
            />
            <Tile
              label="Weak"
              value={String(coverage.weakIntents)}
              tone={coverage.weakIntents > 0 ? "warn" : "neutral"}
            />
          </div>

          {coverage.categoriesNeedingTraining.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Categories needing more training
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {coverage.categoriesNeedingTraining.slice(0, 6).map((cat) => (
                  <li key={cat.group}>
                    {cat.group} — {cat.missingCount} missing intent
                    {cat.missingCount === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Intent</th>
                  <th className="px-3 py-2 font-semibold">Group</th>
                  <th className="px-3 py-2 font-semibold">Entries</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {coverage.intents.map((intent) => (
                  <tr key={intent.key} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {intent.name}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{intent.group}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">
                      {intent.entryCount}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={intent.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Tile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        tone === "ok" && "border-emerald-100 bg-emerald-50/50",
        tone === "warn" && "border-amber-100 bg-amber-50/50",
        tone === "neutral" && "border-slate-100 bg-slate-50/80"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "covered" | "missing" | "weak";
}) {
  const styles = {
    covered: "bg-emerald-50 text-emerald-700",
    missing: "bg-rose-50 text-rose-700",
    weak: "bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
        styles[status]
      )}
    >
      {status}
    </span>
  );
}
