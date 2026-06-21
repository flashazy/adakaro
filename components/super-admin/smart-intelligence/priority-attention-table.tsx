"use client";

import { useMemo, useState } from "react";
import { saBtnSecondarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import type {
  PriorityAttentionRow,
  PrioritySeverity,
} from "@/lib/super-admin/smart-intelligence-presentation";
import {
  getPriorityAttentionEmptyCopy,
  priorityRowHoverAccent,
  priorityVisualSeverityClass,
} from "@/lib/super-admin/smart-intelligence-presentation";
import {
  priorityIssueToSource,
  type SmartIntelligenceNavigationContext,
} from "@/lib/super-admin/smart-intelligence-navigation";
import { SchoolIntelligenceActionLinks } from "./school-intelligence-action-links";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Filter } from "lucide-react";
import { IntelligenceEmptyState, siCardSurface } from "./intelligence-ui-tokens";

type SortKey = "school" | "issue" | "severity" | "recommendedAction";
type SortDir = "asc" | "desc";
type SeverityFilter = "all" | PrioritySeverity;

function rowNavContext(row: PriorityAttentionRow): SmartIntelligenceNavigationContext {
  return {
    schoolId: row.id,
    schoolName: row.school,
    source: priorityIssueToSource(row.issue),
    riskLevel: row.visualSeverity,
  };
}

function severityOrder(s: PrioritySeverity): number {
  if (s === "critical") return 3;
  if (s === "medium") return 2;
  return 1;
}

export interface PriorityAttentionTableProps {
  rows: PriorityAttentionRow[];
}

export function PriorityAttentionTable({ rows }: PriorityAttentionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const filtered = useMemo(() => {
    let list = rows;
    if (severityFilter !== "all") {
      list = list.filter((r) => r.severity === severityFilter);
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "school":
          cmp = a.school.localeCompare(b.school);
          break;
        case "issue":
          cmp = a.issue.localeCompare(b.issue);
          break;
        case "severity":
          cmp = severityOrder(a.severity) - severityOrder(b.severity);
          break;
        case "recommendedAction":
          cmp = a.recommendedAction.localeCompare(b.recommendedAction);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir, severityFilter]);

  const emptyCopy = getPriorityAttentionEmptyCopy(rows.length > 0);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "school" ? "asc" : "desc");
    }
  }

  function SortHeader({
    label,
    column,
    className,
  }: {
    label: string;
    column: SortKey;
    className?: string;
  }) {
    const active = sortKey === column;
    return (
      <th className={cn("px-4 py-3 font-medium", className)}>
        <button
          type="button"
          onClick={() => toggleSort(column)}
          className="inline-flex items-center gap-1 text-left text-xs uppercase tracking-wide text-slate-500 transition-colors hover:text-indigo-600"
        >
          {label}
          {active ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3 w-3" aria-hidden />
            ) : (
              <ArrowDown className="h-3 w-3" aria-hidden />
            )
          ) : null}
        </button>
      </th>
    );
  }

  return (
    <article
      id="priority-attention"
      className={cn(siCardSurface, "scroll-mt-28 overflow-hidden")}
    >
      <div className="flex flex-col gap-4 border-b border-slate-100/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-950">
            Priority Attention
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Schools needing immediate executive follow-up — max 10 shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" aria-hidden />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
            className={cn(saBtnSecondarySm, "cursor-pointer border-slate-200/60 bg-white pr-8")}
            aria-label="Filter by severity"
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <IntelligenceEmptyState
          title={emptyCopy.title}
          description={
            rows.length === 0
              ? emptyCopy.description
              : "No schools match the selected severity filter. Try a different filter to view other priority items."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/60 text-left">
              <tr>
                <SortHeader label="School" column="school" />
                <SortHeader label="Issue" column="issue" />
                <SortHeader label="Severity" column="severity" />
                <SortHeader label="Recommended Action" column="recommendedAction" />
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "cursor-default transition-all duration-150",
                    priorityRowHoverAccent(row.visualSeverity)
                  )}
                >
                  <td className="px-4 py-3.5 font-medium text-slate-900">
                    {row.school}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{row.issue}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
                        priorityVisualSeverityClass(row.visualSeverity)
                      )}
                    >
                      {row.visualSeverity}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    {row.recommendedAction}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <SchoolIntelligenceActionLinks
                      context={rowNavContext(row)}
                      compact
                      className="!pt-0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
