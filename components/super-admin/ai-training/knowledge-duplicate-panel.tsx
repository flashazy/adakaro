"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  DUPLICATE_CLASSIFICATION_LABELS,
  DUPLICATE_CLASSIFICATION_STYLES,
  type DuplicateClassification,
} from "@/lib/ai-training/knowledge-duplicates";
import type { IntentSignature } from "@/lib/ai-training/intent-signature";
import { cn } from "@/lib/utils";

export interface DuplicateCheckEntrySummary {
  id: string;
  question: string;
  category: string;
  intent_key: string | null;
  version_number?: number;
  health_status?: string;
}

export interface DuplicateMatchApiItem {
  entry: DuplicateCheckEntrySummary;
  similarity: number;
  matchReasons: string[];
  isExact: boolean;
  classification: DuplicateClassification;
  classificationLabel: string;
  scores: {
    intentSimilarity: number;
    questionStructure: number;
    semanticSimilarity: number;
    keywordOverlap: number;
    combined: number;
  };
  entryIntentSignature: IntentSignature;
  recommendation: string;
}

export interface DuplicateCheckApiResult {
  normalizedQuestion: string;
  exactMatch: DuplicateMatchApiItem | null;
  nearDuplicateMatch: DuplicateMatchApiItem | null;
  similar: DuplicateMatchApiItem[];
  suggestedIntentKey: string | null;
  suggestedIntentName: string | null;
  suggestedCategory: string | null;
  relatedEntries: DuplicateMatchApiItem[];
  differentIntentEntries: DuplicateMatchApiItem[];
  intentComparison: {
    existingQuestion: string;
    existingIntent: IntentSignature;
    currentQuestion: string;
    currentIntent: IntentSignature;
    status: DuplicateClassification;
    statusLabel: string;
    recommendation: string;
  } | null;
  currentIntentSignature: IntentSignature;
}

interface KnowledgeDuplicatePanelProps {
  question: string;
  category: string;
  excludeId?: string;
  onSelectEntry: (entryId: string) => void;
  onCheckResult?: (result: DuplicateCheckApiResult | null) => void;
}

export function KnowledgeDuplicatePanel({
  question,
  category,
  excludeId,
  onSelectEntry,
  onCheckResult,
}: KnowledgeDuplicatePanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DuplicateCheckApiResult | null>(null);
  const onCheckResultRef = useRef(onCheckResult);
  onCheckResultRef.current = onCheckResult;

  useEffect(() => {
    const trimmed = question.trim();
    if (trimmed.length < 3) {
      setResult(null);
      onCheckResultRef.current?.(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: trimmed, category });
        if (excludeId) params.set("excludeId", excludeId);
        const res = await fetch(
          `/api/super-admin/ai-training/knowledge/duplicates?${params}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as DuplicateCheckApiResult;
        setResult(data);
        onCheckResultRef.current?.(data);
      } catch {
        if (!controller.signal.aborted) {
          setResult(null);
          onCheckResultRef.current?.(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [question, category, excludeId]);

  const trimmed = question.trim();
  if (trimmed.length < 3) return null;

  const warnings = (result?.similar ?? []).filter(
    (item) =>
      item.classification === "exact_duplicate" ||
      item.classification === "near_duplicate" ||
      item.classification === "related_topic"
  );
  const relationshipCards = result?.differentIntentEntries ?? [];
  const hasIntentComparison = Boolean(result?.intentComparison);
  const hasSuggestions =
    result?.suggestedIntentKey ||
    result?.suggestedCategory ||
    (result?.relatedEntries.length ?? 0) > 0;

  if (
    !loading &&
    warnings.length === 0 &&
    relationshipCards.length === 0 &&
    !hasIntentComparison &&
    !hasSuggestions
  ) {
    return null;
  }

  const comparison = result?.intentComparison;
  const comparisonStyles = comparison
    ? DUPLICATE_CLASSIFICATION_STYLES[comparison.status]
    : null;

  return (
    <div className="mt-2 space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking for similar entries…
        </div>
      ) : null}

      {!loading && comparison && comparisonStyles ? (
        <div
          className={cn(
            "rounded-xl border p-4 shadow-sm",
            comparisonStyles.border,
            comparisonStyles.bg
          )}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GitBranch className={cn("h-4 w-4 shrink-0", comparisonStyles.text)} />
            <span className={comparisonStyles.text}>Intent Comparison</span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <IntentColumn
              title="Existing Entry"
              question={comparison.existingQuestion}
              intent={comparison.existingIntent}
            />
            <IntentColumn
              title="Current Entry"
              question={comparison.currentQuestion}
              intent={comparison.currentIntent}
            />
          </div>

          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </dt>
              <dd className="mt-1">
                <ClassificationBadge classification={comparison.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recommendation
              </dt>
              <dd className={cn("mt-1 font-medium", comparisonStyles.text)}>
                {comparison.recommendation}
              </dd>
            </div>
          </dl>

          {comparison.status === "different_intent" ? (
            <p className="mt-3 text-sm leading-relaxed text-emerald-800">
              This question is related to an existing topic but represents a different
              user intent. Creating a separate knowledge entry is recommended.
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && warnings.length > 0 ? (
        <div className="space-y-2">
          {warnings.map((item) => (
            <DuplicateMatchCard
              key={item.entry.id}
              item={item}
              onSelectEntry={onSelectEntry}
            />
          ))}
        </div>
      ) : null}

      {!loading && relationshipCards.length > 0 ? (
        <div className="space-y-2">
          {relationshipCards.map((item) => (
            <RelationshipCard
              key={item.entry.id}
              item={item}
              onSelectEntry={onSelectEntry}
            />
          ))}
        </div>
      ) : null}

      {!loading && hasSuggestions ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Sparkles className="h-3.5 w-3.5" />
            Suggestions
          </div>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            {result?.suggestedIntentKey ? (
              <div>
                <dt className="text-xs text-slate-500">Suggested intent</dt>
                <dd className="font-mono text-xs font-medium text-violet-800">
                  {result.suggestedIntentKey}
                  {result.suggestedIntentName ? (
                    <span className="ml-1 font-sans text-slate-600">
                      ({result.suggestedIntentName})
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {result?.suggestedCategory ? (
              <div>
                <dt className="text-xs text-slate-500">Suggested category</dt>
                <dd className="font-medium text-slate-800">{result.suggestedCategory}</dd>
              </div>
            ) : null}
          </dl>
          {(result?.relatedEntries.length ?? 0) > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-500">Related entries</p>
              <ul className="mt-1 space-y-1">
                {result!.relatedEntries.map((item) => (
                  <li key={item.entry.id}>
                    <button
                      type="button"
                      className="text-sm text-indigo-700 hover:underline"
                      onClick={() => onSelectEntry(item.entry.id)}
                    >
                      {item.entry.question}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function IntentColumn({
  title,
  question,
  intent,
}: {
  title: string;
  question: string;
  intent: IntentSignature;
}) {
  return (
    <div className="rounded-lg bg-white/70 px-3 py-2 ring-1 ring-inset ring-black/5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900">{question}</p>
      <p className="mt-1 text-xs text-slate-600">
        Intent: <span className="font-semibold">{intent.label}</span>
      </p>
    </div>
  );
}

function ClassificationBadge({
  classification,
}: {
  classification: DuplicateClassification;
}) {
  const styles = DUPLICATE_CLASSIFICATION_STYLES[classification];
  const Icon =
    classification === "different_intent"
      ? CheckCircle2
      : classification === "exact_duplicate"
        ? AlertTriangle
        : Info;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        styles.badge
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {DUPLICATE_CLASSIFICATION_LABELS[classification]}
    </span>
  );
}

function DuplicateMatchCard({
  item,
  onSelectEntry,
}: {
  item: DuplicateMatchApiItem;
  onSelectEntry: (id: string) => void;
}) {
  const styles = DUPLICATE_CLASSIFICATION_STYLES[item.classification];

  return (
    <div className={cn("rounded-xl border p-4 shadow-sm", styles.border, styles.bg)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <ClassificationBadge classification={item.classification} />
        <span className={cn("text-sm font-bold tabular-nums", styles.text)}>
          {item.similarity}% similar
        </span>
      </div>
      <button
        type="button"
        className="mt-2 w-full rounded-lg px-1 py-1 text-left text-sm font-medium text-slate-900 hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        onClick={() => onSelectEntry(item.entry.id)}
      >
        {item.entry.question}
      </button>
      <ScoreBreakdown scores={item.scores} />
      <p className={cn("mt-2 text-xs leading-relaxed", styles.text)}>
        {item.recommendation}
      </p>
    </div>
  );
}

function RelationshipCard({
  item,
  onSelectEntry,
}: {
  item: DuplicateMatchApiItem;
  onSelectEntry: (id: string) => void;
}) {
  const styles = DUPLICATE_CLASSIFICATION_STYLES.different_intent;

  return (
    <div className={cn("rounded-xl border p-4 shadow-sm", styles.border, styles.bg)}>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
        <span className="text-sm font-semibold text-emerald-900">Related Entry</span>
        <ClassificationBadge classification="different_intent" />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-emerald-800">
        This question is related to an existing topic but represents a different user
        intent. Creating a separate knowledge entry is recommended.
      </p>
      <button
        type="button"
        className="mt-2 text-sm font-medium text-emerald-900 underline-offset-2 hover:underline"
        onClick={() => onSelectEntry(item.entry.id)}
      >
        {item.entry.question}
      </button>
    </div>
  );
}

function ScoreBreakdown({
  scores,
}: {
  scores: DuplicateMatchApiItem["scores"];
}) {
  const rows = [
    { label: "Intent", value: scores.intentSimilarity },
    { label: "Structure", value: scores.questionStructure },
    { label: "Semantic", value: scores.semanticSimilarity },
    { label: "Keywords", value: scores.keywordOverlap },
  ];

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="rounded-md bg-white/60 px-2 py-1.5">
          <p className="text-[10px] font-semibold uppercase text-slate-400">
            {row.label}
          </p>
          <p className="text-xs font-bold tabular-nums text-slate-700">{row.value}%</p>
        </div>
      ))}
    </div>
  );
}
