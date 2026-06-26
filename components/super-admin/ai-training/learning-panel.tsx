"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsDown,
} from "lucide-react";
import {
  SaKpiCard,
  saBtnPrimarySm,
  saBtnSecondary,
  saBtnSecondarySm,
  saInput,
  saSection,
  saSectionSubtitle,
  saSectionTitle,
  saTableHeadCell,
  saTableHeadRow,
  saTableRowHover,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { formatDateTime, TableSkeleton } from "@/components/super-admin/ai-training/shared";
import type {
  LearningEventRow,
  LearningMetricsSummary,
  LearningSuggestionRow,
} from "@/lib/ai-training/learning-types";
import { cn } from "@/lib/utils";

const SUGGESTION_LABELS: Record<string, string> = {
  search_phrase: "Search phrase",
  alternative_wording: "Alternative wording",
  synonym: "Synonym",
  keyword: "Keyword",
  related_intent: "Related intent",
  new_entry: "New entry",
  intent_trigger: "Intent trigger",
  intent_negative: "Negative phrase",
};

function formatSuggestionType(type: string): string {
  return SUGGESTION_LABELS[type] ?? type.replace(/_/g, " ");
}

export function LearningPanel() {
  const [metrics, setMetrics] = useState<LearningMetricsSummary | null>(null);
  const [suggestions, setSuggestions] = useState<LearningSuggestionRow[]>([]);
  const [approved, setApproved] = useState<LearningSuggestionRow[]>([]);
  const [unansweredEvents, setUnansweredEvents] = useState<LearningEventRow[]>([]);
  const [lowConfidenceEvents, setLowConfidenceEvents] = useState<LearningEventRow[]>([]);
  const [clarificationEvents, setClarificationEvents] = useState<LearningEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [editTexts, setEditTexts] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsRes, suggestionsRes, approvedRes, unansweredRes, lowRes, clarRes] =
        await Promise.all([
          fetch("/api/super-admin/ai-training/learning/metrics"),
          fetch("/api/super-admin/ai-training/learning/suggestions?status=pending"),
          fetch("/api/super-admin/ai-training/learning/suggestions?status=approved"),
          fetch("/api/super-admin/ai-training/learning/events?section=unanswered"),
          fetch("/api/super-admin/ai-training/learning/events?section=low_confidence"),
          fetch("/api/super-admin/ai-training/learning/events?section=clarification"),
        ]);

      if (metricsRes.ok) {
        setMetrics((await metricsRes.json()) as LearningMetricsSummary);
      }
      if (suggestionsRes.ok) {
        const data = (await suggestionsRes.json()) as {
          suggestions: LearningSuggestionRow[];
        };
        setSuggestions(data.suggestions);
      }
      if (approvedRes.ok) {
        const data = (await approvedRes.json()) as {
          suggestions: LearningSuggestionRow[];
        };
        setApproved(data.suggestions.slice(0, 20));
      }
      if (unansweredRes.ok) {
        const data = (await unansweredRes.json()) as { events: LearningEventRow[] };
        setUnansweredEvents(data.events.slice(0, 15));
      }
      if (lowRes.ok) {
        const data = (await lowRes.json()) as { events: LearningEventRow[] };
        setLowConfidenceEvents(data.events.slice(0, 15));
      }
      if (clarRes.ok) {
        const data = (await clarRes.json()) as { events: LearningEventRow[] };
        setClarificationEvents(data.events.slice(0, 15));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const runAnalyzer = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/super-admin/ai-training/learning/suggestions", {
        method: "POST",
      });
      if (!res.ok) {
        showToast("Analysis failed.");
        return;
      }
      const data = (await res.json()) as { inserted: number; generated: number };
      showToast(`Generated ${data.generated} suggestions (${data.inserted} new).`);
      void loadAll();
    } finally {
      setAnalyzing(false);
    }
  };

  const reviewSuggestion = async (
    id: string,
    action: "approve" | "reject",
    suggestedText?: string
  ) => {
    const res = await fetch(
      `/api/super-admin/ai-training/learning/suggestions/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          suggested_text: suggestedText,
        }),
      }
    );

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error ?? "Action failed.");
      return;
    }

    showToast(action === "approve" ? "Suggestion applied." : "Suggestion rejected.");
    void loadAll();
  };

  if (loading && !metrics) {
    return (
      <div className="mt-8 space-y-4">
        <TableSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">AI Learning</h2>
          <p className="mt-1 text-sm text-slate-500">
            Zero-cost self-learning from real Public AI questions. Suggestions require
            approval before they affect live answers.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={saBtnSecondary} onClick={() => void loadAll()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            className={saBtnSecondary}
            disabled={analyzing}
            onClick={() => void runAnalyzer()}
          >
            {analyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Run analyzer
          </button>
        </div>
      </div>

      {metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SaKpiCard
            label="Questions captured"
            value={metrics.totalQuestionsCaptured}
          />
          <SaKpiCard label="Answered rate" value={`${metrics.answeredRate}%`} />
          <SaKpiCard
            label="Clarification rate"
            value={`${metrics.clarificationRate}%`}
          />
          <SaKpiCard
            label="Unanswered rate"
            value={`${metrics.unansweredRate}%`}
          />
          <SaKpiCard
            label="Low confidence"
            value={`${metrics.lowConfidenceRate}%`}
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <SaKpiCard
          label="Pending suggestions"
          value={metrics?.suggestionsPending ?? 0}
        />
        <SaKpiCard
          label="Approved suggestions"
          value={metrics?.suggestionsApproved ?? 0}
        />
        <SaKpiCard
          label="Approved (30 days)"
          value={metrics?.recentApprovedCount ?? 0}
        />
      </div>

      <div className={saSection}>
        <h3 className={saSectionTitle}>Suggested improvements</h3>
        <p className={saSectionSubtitle}>
          Review draft phrases, keywords, and intent fixes before they go live.
        </p>
        {suggestions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            No pending suggestions. Run the analyzer after Public AI collects more
            questions.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className={saTableHeadRow}>
                  <th className={saTableHeadCell}>Type</th>
                  <th className={saTableHeadCell}>Suggestion</th>
                  <th className={saTableHeadCell}>Target</th>
                  <th className={saTableHeadCell}>Count</th>
                  <th className={saTableHeadCell}>Reason</th>
                  <th className={saTableHeadCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((row) => (
                  <tr key={row.id} className={saTableRowHover}>
                    <td className="px-4 py-3 capitalize text-slate-600">
                      {formatSuggestionType(row.suggestion_type)}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <input
                        value={editTexts[row.id] ?? row.suggested_text}
                        onChange={(e) =>
                          setEditTexts((prev) => ({
                            ...prev,
                            [row.id]: e.target.value,
                          }))
                        }
                        className={cn(saInput, "w-full text-xs")}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {row.target_intent_key ?? row.target_entry_id?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.occurrence_count}</td>
                    <td className="max-w-sm px-4 py-3 text-xs text-slate-500">
                      {row.reason}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={saBtnPrimarySm}
                          onClick={() =>
                            void reviewSuggestion(
                              row.id,
                              "approve",
                              editTexts[row.id] ?? row.suggested_text
                            )
                          }
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          className={saBtnSecondarySm}
                          onClick={() => void reviewSuggestion(row.id, "reject")}
                        >
                          <ThumbsDown className="mr-1 h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <EventList
          title="Repeated unanswered questions"
          subtitle="Questions Public AI could not answer."
          events={unansweredEvents}
          emptyMessage="No unanswered learning events yet."
        />
        <EventList
          title="Low confidence matches"
          subtitle="Questions matched with weak confidence."
          events={lowConfidenceEvents}
          emptyMessage="No low-confidence events yet."
        />
        <EventList
          title="Clarification hotspots"
          subtitle="Questions that triggered clarification prompts."
          events={clarificationEvents}
          emptyMessage="No clarification events yet."
        />
        <div className={saSection}>
          <h3 className={saSectionTitle}>Recently approved improvements</h3>
          <p className={saSectionSubtitle}>
            Changes that now affect Public AI retrieval.
          </p>
          {approved.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No approved suggestions yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {approved.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-emerald-700">
                        {formatSuggestionType(row.suggestion_type)}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-slate-800">
                        {row.suggested_text}
                      </p>
                      {row.target_intent_key ? (
                        <p className="text-xs text-slate-500">
                          Intent: {row.target_intent_key}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDateTime(row.applied_at ?? row.reviewed_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {metrics && metrics.topRepeatedQuestions.length > 0 ? (
        <div className={saSection}>
          <h3 className={saSectionTitle}>Top repeated questions</h3>
          <ul className="mt-4 space-y-2">
            {metrics.topRepeatedQuestions.map((item) => (
              <li
                key={item.question}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">{item.question}</span>
                <span className="tabular-nums text-indigo-600">{item.count}×</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[210] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function EventList({
  title,
  subtitle,
  events,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  events: LearningEventRow[];
  emptyMessage: string;
}) {
  return (
    <div className={saSection}>
      <h3 className={saSectionTitle}>{title}</h3>
      <p className={saSectionSubtitle}>{subtitle}</p>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-slate-100 px-3 py-2.5"
            >
              <p className="text-sm font-medium text-slate-800">
                {event.original_question}
              </p>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="capitalize">{event.answer_status}</span>
                {event.matched_intent_key ? (
                  <span>· {event.matched_intent_key}</span>
                ) : null}
                {event.final_score !== null ? (
                  <span>· score {event.final_score.toFixed(2)}</span>
                ) : null}
                <span>· {formatDateTime(event.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
