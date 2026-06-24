"use client";

import { useMemo, useState } from "react";
import { Bot, Search } from "lucide-react";
import {
  SaKpiCard,
  saInput,
  saSection,
  saSectionSubtitle,
  saSectionTitle,
  saTableHeadCell,
  saTableHeadRow,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { CopilotToggle } from "@/components/super-admin/copilot-toggle";
import type { CopilotRolloutData, CopilotOpsStats } from "@/lib/ai/copilot-rollout";
import { cn } from "@/lib/utils";

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
        enabled
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-slate-100 text-slate-600 ring-slate-200"
      )}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

export function CopilotRolloutPanel({
  initial,
  opsStats,
}: {
  initial: CopilotRolloutData;
  opsStats?: CopilotOpsStats | null;
}) {
  const [schools, setSchools] = useState(initial.schools);
  const [query, setQuery] = useState("");

  const enabledCount = useMemo(
    () => schools.filter((s) => s.copilotEnabled).length,
    [schools]
  );
  const disabledCount = schools.length - enabledCount;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => s.name.toLowerCase().includes(q));
  }, [schools, query]);

  function handleChanged(schoolId: string, enabled: boolean) {
    setSchools((prev) =>
      prev.map((s) =>
        s.id === schoolId ? { ...s, copilotEnabled: enabled } : s
      )
    );
  }

  return (
    <section className={saSection}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={cn(saSectionTitle, "flex items-center gap-2")}>
            <Bot className="h-5 w-5 text-indigo-600" />
            Copilot Rollout
          </h2>
          <p className={saSectionSubtitle}>
            Control which schools can see and use Adakaro Copilot. Disabled by
            default for a safe, private rollout.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SaKpiCard label="Total schools" value={schools.length} />
        <SaKpiCard label="Copilot enabled" value={enabledCount} />
        <SaKpiCard label="Copilot disabled" value={disabledCount} />
      </div>

      {opsStats ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SaKpiCard
            label="Unanswered (Copilot)"
            value={opsStats.pendingUnansweredCount}
          />
          <SaKpiCard
            label="Draft knowledge"
            value={opsStats.copilotKnowledgeDrafts}
          />
          <SaKpiCard
            label="Recent failures"
            value={opsStats.recentUnanswered.length}
          />
        </div>
      ) : null}

      {opsStats && opsStats.recentUnanswered.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Recent Copilot questions needing answers
          </p>
          <ul className="mt-2 space-y-1.5">
            {opsStats.recentUnanswered.slice(0, 5).map((q) => (
              <li
                key={q.id}
                className="text-sm text-amber-900"
              >
                {q.question}
                <span className="ml-2 text-xs text-amber-700">
                  ×{q.occurrences}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search schools…"
            className={cn(saInput, "w-full pl-9")}
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className={saTableHeadRow}>
            <tr>
              <th className={saTableHeadCell}>School</th>
              <th className={saTableHeadCell}>Plan</th>
              <th className={saTableHeadCell}>Status</th>
              <th className={cn(saTableHeadCell, "text-right")}>Students</th>
              <th className={saTableHeadCell}>Copilot</th>
              <th className={cn(saTableHeadCell, "text-right")}>Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  No schools match “{query}”.
                </td>
              </tr>
            ) : (
              filtered.map((school) => (
                <tr key={school.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {school.name}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">
                    {school.plan}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">
                    {school.status}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {school.studentCount}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge enabled={school.copilotEnabled} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <CopilotToggle
                        schoolId={school.id}
                        schoolName={school.name}
                        enabled={school.copilotEnabled}
                        onChanged={(enabled) =>
                          handleChanged(school.id, enabled)
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
