"use client";

import { useCallback, useState } from "react";
import {
  BookOpen,
  Brain,
  Database,
  Loader2,
  Pencil,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  saBtnPrimary,
  saInput,
  saSectionSubtitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import {
  ActionableRecommendationsList,
  CandidateComparisonBars,
  ConfidenceExplanationCard,
  ConsoleCollapsible,
  CoverageBadge,
  HealthBadge,
  HealthExplanationCard,
  KnowledgeStatsCard,
  MethodBadge,
  PerformanceCard,
  PipelineVisualization,
  QualityScoreCard,
  QuickActionsBar,
  TestResultSkeleton,
  VersionTimelineCard,
} from "@/components/super-admin/ai-training/test-ai-console-panels";
import type { AITestMatchResult } from "@/lib/ai-training/test-match";
import {
  downloadDebugReport,
  printDebugReportPdf,
} from "@/lib/ai-training/test-debug-export";
import type { RecommendationApplyAction } from "@/lib/ai-training/test-observability-console";
import { CONFIDENCE_TIER_STYLES } from "@/lib/ai-training/retrieval-observability";
import { cn } from "@/lib/utils";
import { STARTER_QUESTIONS } from "@/lib/ai-training/types";

export function TestAIDrawer({
  open,
  onClose,
  onCreateEntry,
  onImproveEntry,
  onOpenEntry,
  onApplySuggestion,
  onRecalculateIntent,
}: {
  open: boolean;
  onClose: () => void;
  onCreateEntry: (question: string) => void;
  onImproveEntry: (entryId: string) => void;
  onOpenEntry: (entryId: string) => void;
  onApplySuggestion: (
    action: RecommendationApplyAction,
    value: string | undefined,
    entryId?: string
  ) => void;
  onRecalculateIntent: (entryId: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AITestMatchResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const runTest = useCallback(async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/super-admin/ai-training/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (res.ok) setResult((await res.json()) as AITestMatchResult);
      else showToast("Test failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [question]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied.`);
    } catch {
      showToast("Could not copy to clipboard.");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex justify-end bg-slate-900/40"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-ai-title"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="test-ai-title" className="text-lg font-semibold text-slate-900">
              Test Adakaro AI
            </h2>
            <p className={saSectionSubtitle}>
              Enterprise AI Observability Console — debug without changing retrieval.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            aria-label="Close debugger"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <label htmlFor="test-ai-question" className="block text-sm font-medium text-slate-700">
            Test question
          </label>
          <textarea
            id="test-ai-question"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setResult(null);
            }}
            rows={3}
            placeholder="Can parents receive attendance notifications?"
            className={cn(saInput, "mt-2 w-full")}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STARTER_QUESTIONS.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuestion(example);
                  setResult(null);
                }}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-[11px] font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {example}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={cn(saBtnPrimary, "mt-3 w-full")}
            disabled={loading || !question.trim()}
            onClick={() => void runTest()}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Play className="mr-2 h-4 w-4" aria-hidden />
            )}
            Run Test
          </button>

          {loading ? <TestResultSkeleton /> : null}

          {result && !loading ? (
            <div className="mt-6 space-y-4">
              <QuickActionsBar
                result={result}
                question={question}
                onRunAgain={() => void runTest()}
                onOpenEntry={onOpenEntry}
                onImproveEntry={onImproveEntry}
                onCopyAnswer={() =>
                  void copyText(result.answerPreview ?? "", "Answer")
                }
                onCopyKeywords={() =>
                  void copyText(result.matchedKeywords.join("\n"), "Keywords")
                }
                onCopyPhrases={() =>
                  void copyText(
                    (result.entry?.search_phrases ?? []).join("\n"),
                    "Search phrases"
                  )
                }
                onRecalculateIntent={onRecalculateIntent}
                onExport={(format) => {
                  if (format === "pdf") printDebugReportPdf(question, result);
                  else downloadDebugReport(question, result, format);
                  showToast(`Report exported as ${format.toUpperCase()}.`);
                }}
              />

              <OutcomeSummary result={result} />
              <PerformanceCard result={result} />
              <QualityScoreCard result={result} />
              <CoverageBadge result={result} />
              <ConfidenceExplanationCard result={result} />

              {result.matched && result.entry ? (
                <MatchedEntryDetails
                  result={result}
                  onImproveEntry={onImproveEntry}
                />
              ) : result.needsClarification ? (
                <ClarificationSummary result={result} />
              ) : (
                <NoMatchSummary
                  result={result}
                  onCreateEntry={() => {
                    onCreateEntry(question);
                    onClose();
                  }}
                />
              )}

              <QueryNormalizationCard result={result} />
              <KnowledgeStatsCard result={result} />

              {result.advanced.candidates.length > 0 ? (
                <ConsoleCollapsible title="Candidate Matches" defaultOpen icon={Sparkles}>
                  <CandidateComparisonBars result={result} />
                  <div className="mt-4">
                    <CandidateDetailsList result={result} />
                  </div>
                </ConsoleCollapsible>
              ) : null}

              <ConsoleCollapsible title="Retrieval Pipeline" icon={Search}>
                <PipelineVisualization result={result} />
              </ConsoleCollapsible>

              {result.console.healthExplanation ? (
                <HealthExplanationCard result={result} />
              ) : null}

              {result.console.versionTimeline.length > 0 ? (
                <VersionTimelineCard result={result} />
              ) : null}

              {result.advanced.scoreBreakdownAvailable ? (
                <ConsoleCollapsible title="Ranking Breakdown" icon={Brain}>
                  <ScoreBreakdownList result={result} />
                </ConsoleCollapsible>
              ) : null}

              {result.console.actionableRecommendations.length > 0 ? (
                <ConsoleCollapsible
                  title="Training Recommendations"
                  defaultOpen={!result.matched}
                  icon={Sparkles}
                >
                  <ActionableRecommendationsList
                    result={result}
                    onApply={onApplySuggestion}
                  />
                </ConsoleCollapsible>
              ) : null}
            </div>
          ) : null}
        </div>

        {toast ? (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg"
            role="status"
          >
            {toast}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OutcomeSummary({ result }: { result: AITestMatchResult }) {
  const tier = CONFIDENCE_TIER_STYLES[result.advanced.confidenceDisplay.tier];
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        result.matched
          ? "border-emerald-200 bg-emerald-50"
          : result.needsClarification
            ? "border-indigo-200 bg-indigo-50"
            : "border-amber-200 bg-amber-50"
      )}
    >
      <p className="text-sm font-semibold text-slate-900">
        {result.matched
          ? "Strong match found"
          : result.needsClarification
            ? "Needs clarification"
            : "No strong match found"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <Database className="h-3 w-3" aria-hidden />
          {result.responseSource === "knowledge_base"
            ? "Knowledge Base"
            : result.responseSource}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", tier.badge)}>
          {result.advanced.confidenceDisplay.label}
        </span>
      </div>
    </div>
  );
}

function MatchedEntryDetails({
  result,
  onImproveEntry,
}: {
  result: AITestMatchResult;
  onImproveEntry: (id: string) => void;
}) {
  const intentLabel =
    result.matchedIntent ?? result.matchedCategory ?? "General";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Matched Intent
        </p>
        <p className="mt-1 text-base font-semibold text-slate-900">{intentLabel}</p>
        {result.matchedIntentKey ? (
          <p className="font-mono text-xs text-violet-700">{result.matchedIntentKey}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {result.retrievalMethod ? (
            <MethodBadge method={result.retrievalMethod} />
          ) : null}
          {result.healthStatus ? (
            <HealthBadge status={result.healthStatus} />
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Knowledge Entry Used
            </p>
            <p className="mt-1 font-medium text-slate-900">
              {result.matchedQuestion ?? result.entry?.question}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Version {result.knowledgeVersion ?? 1} ·{" "}
              {result.isPrimaryEntry ? "Primary Active" : "Non-primary"}
            </p>
          </div>
          {result.matchedEntryId ? (
            <button
              type="button"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              onClick={() => onImproveEntry(result.matchedEntryId!)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Improve Entry
            </button>
          ) : null}
        </div>
        {result.answerPreview ? (
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {result.answerPreview}
          </p>
        ) : null}
        <p className="mt-2 text-xs font-semibold text-emerald-700">
          Knowledge Base — NOT LLM Generated
        </p>
      </div>
    </div>
  );
}

function QueryNormalizationCard({ result }: { result: AITestMatchResult }) {
  const norm = result.advanced.queryNormalization;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-slate-400" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Query Normalization
        </p>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Original</dt>
          <dd>{norm.originalQuestion}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Normalized</dt>
          <dd className="font-mono text-xs text-indigo-800">{norm.normalizedQuestion}</dd>
        </div>
      </dl>
    </div>
  );
}

function CandidateDetailsList({ result }: { result: AITestMatchResult }) {
  return (
    <ul className="space-y-2">
      {result.advanced.candidates.map((c) => (
        <li
          key={c.entryId}
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            c.isWinner ? "border-emerald-200 bg-emerald-50/50" : "border-slate-100"
          )}
        >
          <span className="font-semibold">#{c.rank}</span> {c.question} — {c.scorePercent}%
          {c.rejectedReason ? (
            <span className="ml-1 text-amber-800">({c.rejectedReason})</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ScoreBreakdownList({ result }: { result: AITestMatchResult }) {
  return (
    <ul className="space-y-2">
      {result.advanced.scoreBreakdown.map((item) => (
        <li key={item.label}>
          <div className="flex justify-between text-sm">
            <span>{item.label}</span>
            <span className="font-semibold tabular-nums">{item.percent}%</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-400 transition-all duration-500"
              style={{ width: `${item.percent}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ClarificationSummary({ result }: { result: AITestMatchResult }) {
  return (
    <div className="rounded-xl bg-indigo-50/80 p-4 text-sm text-indigo-900">
      {result.clarificationMessage ?? "Multiple intents matched — clarification needed."}
    </div>
  );
}

function NoMatchSummary({
  result,
  onCreateEntry,
}: {
  result: AITestMatchResult;
  onCreateEntry: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
      <p className="text-sm font-semibold text-amber-900">No intent matched</p>
      {result.noMatchReason ? (
        <p className="mt-1 text-sm text-slate-600">{result.noMatchReason}</p>
      ) : null}
      <button type="button" className={cn(saBtnPrimary, "mt-3")} onClick={onCreateEntry}>
        Create Knowledge Entry
      </button>
    </div>
  );
}
