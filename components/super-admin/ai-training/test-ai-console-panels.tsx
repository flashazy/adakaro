"use client";

import { useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Check,
  ChevronDown,
  Clock,
  Copy,
  GitBranch,
  Minus,
  Star,
  X as XIcon,
  Zap,
} from "lucide-react";
import { saBtnSecondarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import type { AITestMatchResult } from "@/lib/ai-training/test-match";
import type { RecommendationApplyAction } from "@/lib/ai-training/test-observability-console";
import {
  CONFIDENCE_TIER_STYLES,
  COVERAGE_STATUS_LABELS,
  COVERAGE_STATUS_STYLES,
  HEALTH_STATUS_LABELS,
  RETRIEVAL_METHOD_LABELS,
  type DisplayHealthStatus,
  type RetrievalMethod,
} from "@/lib/ai-training/retrieval-observability";
import { cn } from "@/lib/utils";

const METHOD_STYLES: Record<RetrievalMethod, string> = {
  intent_match: "bg-violet-100 text-violet-800 ring-violet-200",
  semantic_search: "bg-sky-100 text-sky-800 ring-sky-200",
  keyword_match: "bg-amber-100 text-amber-800 ring-amber-200",
  hybrid_retrieval: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  knowledge_graph: "bg-indigo-100 text-indigo-800 ring-indigo-200",
};

const SPEED_STYLES = {
  green: "text-emerald-700 bg-emerald-50 ring-emerald-200",
  blue: "text-sky-700 bg-sky-50 ring-sky-200",
  amber: "text-amber-700 bg-amber-50 ring-amber-200",
  red: "text-red-700 bg-red-50 ring-red-200",
};

const HEALTH_STYLES: Record<DisplayHealthStatus, string> = {
  healthy: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  needs_review: "bg-amber-100 text-amber-800 ring-amber-200",
  archived: "bg-slate-200 text-slate-700 ring-slate-300",
  deprecated: "bg-red-100 text-red-800 ring-red-200",
};

const PIPELINE_ICON = {
  complete: "text-emerald-600",
  skipped: "text-slate-400",
  failed: "text-red-500",
};

export function PerformanceCard({ result }: { result: AITestMatchResult }) {
  const perf = result.console.performance;
  return (
    <ConsoleCard title="Retrieval Performance" icon={Zap}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tabular-nums text-slate-900">
            {perf.totalMs} ms
          </p>
          <p className="text-xs text-slate-500">Total test time</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
            SPEED_STYLES[perf.speedTier]
          )}
        >
          <Zap className="h-3 w-3" aria-hidden />
          {perf.speedLabel}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <TimingStat label="Load entries" value={perf.loadEntriesMs} />
        <TimingStat label="Query processing" value={perf.queryProcessingMs} />
        <TimingStat label="Retrieval" value={perf.retrievalMs} />
        <TimingStat label="Ranking" value={perf.rankingMs} />
        <TimingStat label="Observability" value={perf.observabilityMs} />
        <TimingStat label="Answer preview" value={perf.answerPreviewMs} />
      </dl>
    </ConsoleCard>
  );
}

function TimingStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-800">{value} ms</dd>
    </div>
  );
}

export function KnowledgeStatsCard({ result }: { result: AITestMatchResult }) {
  const stats = result.console.kbStatistics;
  return (
    <ConsoleCard title="Knowledge Base Statistics" icon={BarChart3}>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <StatItem label="Entries scanned" value={stats.entriesScanned} />
        <StatItem label="Candidate matches" value={stats.candidateMatches} />
        <StatItem label="Winner" value={stats.winners} />
        <StatItem label="Rejected" value={stats.rejected} />
        <StatItem label="Active entries" value={stats.activeEntries} />
        <StatItem label="Archived versions" value={stats.archivedVersions} />
        <StatItem label="Duplicate entries" value={stats.duplicateEntries} />
        <StatItem label="Healthy" value={stats.healthyEntries} />
        <StatItem label="Needs review" value={stats.needsReviewEntries} />
      </dl>
    </ConsoleCard>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="text-lg font-bold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

export function ConfidenceExplanationCard({ result }: { result: AITestMatchResult }) {
  const { confidenceDisplay } = result.advanced;
  const reasons = result.console.confidenceReasons;
  const tierStyle = CONFIDENCE_TIER_STYLES[confidenceDisplay.tier];

  return (
    <ConsoleCard title="Confidence Explanation" icon={Activity}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xl font-bold tabular-nums">{confidenceDisplay.percent}%</span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
            tierStyle.badge
          )}
        >
          {confidenceDisplay.label}
        </span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={confidenceDisplay.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", tierStyle.bar)}
          style={{ width: `${confidenceDisplay.percent}%` }}
        />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Reason
      </p>
      <ul className="mt-2 space-y-1.5">
        {reasons.map((reason) => (
          <li
            key={reason.label}
            className={cn(
              "flex items-center gap-2 text-sm",
              reason.met ? "text-emerald-800" : "text-slate-400"
            )}
          >
            {reason.met ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <XIcon className="h-4 w-4 shrink-0" aria-hidden />
            )}
            {reason.label}
          </li>
        ))}
      </ul>
    </ConsoleCard>
  );
}

export function CandidateComparisonBars({ result }: { result: AITestMatchResult }) {
  const candidates = result.advanced.candidates;
  if (candidates.length === 0) return null;
  const maxScore = Math.max(...candidates.map((c) => c.scorePercent), 1);

  return (
    <ul className="space-y-2" aria-label="Candidate score comparison">
      {candidates.map((candidate) => (
        <li
          key={candidate.entryId}
          className={cn(
            "rounded-xl px-3 py-2.5",
            candidate.isWinner
              ? "bg-emerald-50 ring-1 ring-emerald-200"
              : "bg-slate-50"
          )}
        >
          <div className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-slate-700">
              {candidate.scorePercent}
            </span>
            <div className="min-w-0 flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    candidate.isWinner ? "bg-emerald-500" : "bg-indigo-400"
                  )}
                  style={{
                    width: `${Math.round((candidate.scorePercent / maxScore) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 truncate text-xs font-medium text-slate-700">
                {candidate.isWinner ? "🏆 " : ""}
                {candidate.question}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PipelineVisualization({ result }: { result: AITestMatchResult }) {
  const stages = result.console.pipeline;
  return (
    <ol className="space-y-0" aria-label="Retrieval pipeline">
      {stages.map((stage, index) => (
        <li key={stage.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-inset",
                stage.status === "complete"
                  ? "bg-emerald-50 ring-emerald-200"
                  : stage.status === "failed"
                    ? "bg-red-50 ring-red-200"
                    : "bg-slate-50 ring-slate-200"
              )}
              aria-hidden
            >
              {stage.status === "complete" ? (
                <Check className={cn("h-3.5 w-3.5", PIPELINE_ICON.complete)} />
              ) : stage.status === "failed" ? (
                <XIcon className={cn("h-3.5 w-3.5", PIPELINE_ICON.failed)} />
              ) : (
                <Minus className={cn("h-3.5 w-3.5", PIPELINE_ICON.skipped)} />
              )}
            </span>
            {index < stages.length - 1 ? (
              <span className="my-0.5 h-4 w-px bg-slate-200" aria-hidden />
            ) : null}
          </div>
          <div className="pb-3 pt-0.5">
            <p className="text-sm font-medium text-slate-800">{stage.label}</p>
            {stage.detail ? (
              <p className="text-xs text-slate-500">{stage.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HealthExplanationCard({ result }: { result: AITestMatchResult }) {
  const health = result.console.healthExplanation;
  if (!health) return null;

  return (
    <ConsoleCard title="Health Explanation">
      <HealthBadge status={health.status} />
      {health.issues.length > 0 ? (
        <>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Reason
          </p>
          <ul className="mt-1 space-y-1 text-sm text-amber-900">
            {health.issues.map((issue) => (
              <li key={issue}>• {issue}</li>
            ))}
          </ul>
        </>
      ) : null}
      {health.daysSinceUpdate != null ? (
        <p className="mt-2 text-xs text-slate-500">
          Last updated {health.daysSinceUpdate} day
          {health.daysSinceUpdate === 1 ? "" : "s"} ago
        </p>
      ) : null}
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Improvement checklist
      </p>
      <ul className="mt-2 space-y-1">
        {health.checklist.map((item) => (
          <li
            key={item.label}
            className={cn(
              "flex items-center gap-2 text-sm",
              item.done ? "text-emerald-700" : "text-slate-600"
            )}
          >
            {item.done ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <span className="h-3.5 w-3.5 rounded-full border border-slate-300" aria-hidden />
            )}
            {item.label}
          </li>
        ))}
      </ul>
    </ConsoleCard>
  );
}

export function ActionableRecommendationsList({
  result,
  onApply,
}: {
  result: AITestMatchResult;
  onApply: (action: RecommendationApplyAction, value: string | undefined, entryId?: string) => void;
}) {
  return (
    <ul className="space-y-3">
      {result.console.actionableRecommendations.map((item) => (
        <li
          key={item.id}
          className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3"
        >
          <p className="text-sm font-medium text-slate-800">{item.message}</p>
          {item.suggestedValue ? (
            <p className="mt-1 rounded-lg bg-white/80 px-2 py-1 font-mono text-xs text-indigo-900">
              {item.suggestedValue}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {item.confidencePercent != null ? (
              <span className="text-[11px] font-semibold text-slate-500">
                Confidence {item.confidencePercent}%
              </span>
            ) : null}
            {item.applyAction ? (
              <button
                type="button"
                className={saBtnSecondarySm}
                onClick={() =>
                  onApply(item.applyAction!, item.suggestedValue, item.targetEntryId)
                }
              >
                Apply
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function VersionTimelineCard({ result }: { result: AITestMatchResult }) {
  const timeline = result.console.versionTimeline;
  if (timeline.length <= 1) {
    return (
      <ConsoleCard title="Version History" icon={GitBranch}>
        <p className="text-sm text-slate-500">
          Version {result.knowledgeVersion ?? 1} — no prior snapshots yet.
        </p>
      </ConsoleCard>
    );
  }

  return (
    <ConsoleCard title="Version History" icon={GitBranch}>
      <ol className="space-y-0">
        {timeline.map((node, index) => (
          <li key={node.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  node.isCurrent ? "bg-emerald-500" : "bg-slate-300"
                )}
              />
              {index < timeline.length - 1 ? (
                <span className="h-full min-h-[1.5rem] w-px bg-slate-200" />
              ) : null}
            </div>
            <div className="pb-4">
              <p className="text-sm font-semibold text-slate-800">{node.label}</p>
              <p className="text-xs text-slate-600">{node.question}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {new Date(node.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                · {node.changeSummary}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </ConsoleCard>
  );
}

export function QualityScoreCard({ result }: { result: AITestMatchResult }) {
  const quality = result.console.qualityScore;
  return (
    <ConsoleCard title="Knowledge Quality" icon={Star}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tabular-nums text-slate-900">
            {quality.scorePercent}%
          </p>
          <p className="text-lg font-bold text-indigo-700">Grade {quality.grade}</p>
        </div>
        <div className="flex gap-0.5" aria-label={`${quality.stars} of 5 stars`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "h-4 w-4",
                i < quality.stars
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-200"
              )}
            />
          ))}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Intent coverage" value={`${quality.metrics.coveragePercent}%`} />
        <Metric label="Avg confidence" value={`${quality.metrics.averageConfidencePercent}%`} />
        <Metric label="Avg retrieval" value={`${quality.metrics.averageRetrievalMs} ms`} />
        <Metric label="Healthy entries" value={String(quality.metrics.healthyEntries)} />
        <Metric label="Needs review" value={String(quality.metrics.needsReviewEntries)} />
        <Metric label="Duplicate risk" value={String(quality.metrics.duplicateRiskEntries)} />
        <Metric label="Missing intents" value={String(quality.metrics.missingIntentEntries)} />
        <Metric label="Avg keywords" value={String(quality.metrics.averageKeywords)} />
        <Metric label="Avg search phrases" value={String(quality.metrics.averageSearchPhrases)} />
        <Metric label="Avg synonyms" value={String(quality.metrics.averageSynonyms)} />
        <Metric label="Version coverage" value={`${quality.metrics.versionCoveragePercent}%`} />
      </dl>
    </ConsoleCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

export function QuickActionsBar({
  result,
  question,
  onRunAgain,
  onOpenEntry,
  onImproveEntry,
  onCopyAnswer,
  onCopyKeywords,
  onCopyPhrases,
  onRecalculateIntent,
  onExport,
}: {
  result: AITestMatchResult;
  question: string;
  onRunAgain: () => void;
  onOpenEntry: (id: string) => void;
  onImproveEntry: (id: string) => void;
  onCopyAnswer: () => void;
  onCopyKeywords: () => void;
  onCopyPhrases: () => void;
  onRecalculateIntent: (id: string) => void;
  onExport: (format: "json" | "markdown" | "pdf") => void;
}) {
  const entryId = result.matchedEntryId;

  return (
    <div
      className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2"
      role="toolbar"
      aria-label="Quick actions"
    >
      {entryId ? (
        <>
          <QuickBtn label="Open Entry" onClick={() => onOpenEntry(entryId)} />
          <QuickBtn label="Improve Entry" onClick={() => onImproveEntry(entryId)} />
          <QuickBtn label="Recalculate Intent" onClick={() => onRecalculateIntent(entryId)} />
        </>
      ) : null}
      {result.answerPreview ? (
        <QuickBtn label="Copy Answer" onClick={onCopyAnswer} icon={Copy} />
      ) : null}
      {result.matchedKeywords.length > 0 ? (
        <QuickBtn label="Copy Keywords" onClick={onCopyKeywords} icon={Copy} />
      ) : null}
      {result.entry?.search_phrases.length ? (
        <QuickBtn label="Copy Phrases" onClick={onCopyPhrases} icon={Copy} />
      ) : null}
      <QuickBtn label="Run Again" onClick={onRunAgain} icon={Clock} />
      <QuickBtn label="Export JSON" onClick={() => onExport("json")} />
      <QuickBtn label="Export MD" onClick={() => onExport("markdown")} />
      <QuickBtn label="Export PDF" onClick={() => onExport("pdf")} />
    </div>
  );
}

function QuickBtn({
  label,
  onClick,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  icon?: typeof Copy;
}) {
  return (
    <button
      type="button"
      className={saBtnSecondarySm}
      onClick={onClick}
      aria-label={label}
    >
      {Icon ? <Icon className="mr-1 h-3 w-3" aria-hidden /> : null}
      {label}
    </button>
  );
}

export function ConsoleCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof Activity;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-slate-400" aria-hidden /> : null}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </h3>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function ConsoleCollapsible({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: typeof Activity;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {Icon ? <Icon className="h-4 w-4 text-slate-400" /> : null}
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-100 px-4 pb-4 pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function CoverageBadge({ result }: { result: AITestMatchResult }) {
  const { coverageStatus, coverageMessage } = result.advanced;
  return (
    <ConsoleCard title="Knowledge Coverage">
      <span
        className={cn(
          "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
          COVERAGE_STATUS_STYLES[coverageStatus]
        )}
      >
        {COVERAGE_STATUS_LABELS[coverageStatus]}
      </span>
      <p className="mt-2 text-sm text-slate-700">{coverageMessage}</p>
    </ConsoleCard>
  );
}

export function HealthBadge({ status }: { status: DisplayHealthStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        HEALTH_STYLES[status]
      )}
    >
      {HEALTH_STATUS_LABELS[status]}
    </span>
  );
}

export function MethodBadge({ method }: { method: RetrievalMethod }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        METHOD_STYLES[method]
      )}
    >
      {RETRIEVAL_METHOD_LABELS[method]}
    </span>
  );
}

export function TestResultSkeleton() {
  return (
    <div className="mt-6 space-y-4 animate-pulse" aria-busy="true" aria-label="Loading results">
      <div className="h-28 rounded-xl bg-slate-100" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-32 rounded-xl bg-slate-100" />
        <div className="h-32 rounded-xl bg-slate-100" />
      </div>
      <div className="h-48 rounded-xl bg-slate-100" />
    </div>
  );
}
