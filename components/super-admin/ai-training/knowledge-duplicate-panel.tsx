"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  HeartPulse,
  Info,
  Link2,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  DUPLICATE_CLASSIFICATION_LABELS,
  DUPLICATE_CLASSIFICATION_STYLES,
  DUPLICATE_CONFIDENCE_LABELS,
  type DuplicateClassification,
  type DuplicateConfidenceLevel,
} from "@/lib/ai-training/knowledge-duplicates";
import type { ExtractedKnowledgeEntity } from "@/lib/ai-training/knowledge-entities";
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
    entitySimilarity: number;
    productReference: number;
    topicSimilarity: number;
    categoryMatch: number;
    semanticSimilarity: number;
    keywordOverlap: number;
    searchPhraseOverlap: number;
    questionStructure: number;
    combined: number;
    meaning: number;
  };
  entryIntentSignature: IntentSignature;
  currentEntity: ExtractedKnowledgeEntity | null;
  entryEntity: ExtractedKnowledgeEntity | null;
  explanation: {
    summary: string;
    recommendation: string;
    confidenceLevel: DuplicateConfidenceLevel;
    confidenceLabel: string;
    entityNote: string | null;
  };
  recommendation: string;
}

export interface SuggestedRelatedLessonApi {
  question: string;
  entryId: string | null;
  reason: string;
  inDatabase: boolean;
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
  suggestedRelatedLessons: SuggestedRelatedLessonApi[];
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
  currentEntity: ExtractedKnowledgeEntity | null;
}

export interface LessonDraftForHealth {
  keywords?: string[];
  search_phrases?: string[];
  synonyms?: string[];
  alternative_wording?: string[];
}

interface KnowledgeDuplicatePanelProps {
  question: string;
  category: string;
  excludeId?: string;
  draft?: LessonDraftForHealth;
  onSelectEntry: (entryId: string) => void;
  onCheckResult?: (result: DuplicateCheckApiResult | null) => void;
}

export function KnowledgeDuplicatePanel({
  question,
  category,
  excludeId,
  draft,
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

  const metadataHealth = useMemo(() => buildMetadataHealth(draft), [draft]);

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
  const relatedSuggestions = result?.suggestedRelatedLessons ?? [];
  const hasSuggestions =
    result?.suggestedIntentKey ||
    result?.suggestedCategory ||
    relatedSuggestions.length > 0 ||
    (result?.relatedEntries.length ?? 0) > 0;

  if (
    !loading &&
    warnings.length === 0 &&
    relationshipCards.length === 0 &&
    !hasIntentComparison &&
    !hasSuggestions &&
    metadataHealth.length === 0
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
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing intent, entities, and semantic meaning…
        </div>
      ) : null}

      {!loading && metadataHealth.length > 0 ? (
        <KnowledgeHealthStrip items={metadataHealth} />
      ) : null}

      {!loading && comparison && comparisonStyles ? (
        <div
          className={cn(
            "rounded-xl border p-3.5 shadow-sm",
            comparisonStyles.border,
            comparisonStyles.bg
          )}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GitBranch className={cn("h-4 w-4 shrink-0", comparisonStyles.text)} />
            <span className={comparisonStyles.text}>Intent & Entity Analysis</span>
          </div>

          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
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

          <dl className="mt-2.5 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Status
              </dt>
              <dd className="mt-0.5">
                <ClassificationBadge classification={comparison.status} />
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Recommendation
              </dt>
              <dd className={cn("mt-0.5 text-xs font-medium leading-relaxed", comparisonStyles.text)}>
                {comparison.recommendation}
              </dd>
            </div>
          </dl>
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

      {!loading && relatedSuggestions.length > 0 ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            <Link2 className="h-3.5 w-3.5" />
            Suggested Related Lessons
          </div>
          <ul className="mt-2 space-y-1.5">
            {relatedSuggestions.map((lesson) => (
              <li key={lesson.question} className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                    lesson.inDatabase ? "bg-emerald-500" : "bg-amber-400"
                  )}
                />
                {lesson.entryId ? (
                  <button
                    type="button"
                    className="text-left text-xs text-indigo-800 hover:underline"
                    onClick={() => onSelectEntry(lesson.entryId!)}
                  >
                    {lesson.question}
                  </button>
                ) : (
                  <span className="text-xs text-slate-700">{lesson.question}</span>
                )}
                {!lesson.inDatabase ? (
                  <span className="ml-auto shrink-0 text-[10px] text-amber-700">Not yet created</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!loading && hasSuggestions && relatedSuggestions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
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
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-500">Related entries</p>
              <ul className="mt-1 space-y-1">
                {result!.relatedEntries.map((item) => (
                  <li key={item.entry.id}>
                    <button
                      type="button"
                      className="text-xs text-indigo-700 hover:underline"
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

function buildMetadataHealth(draft?: LessonDraftForHealth) {
  if (!draft) return [];
  const items: Array<{ id: string; label: string; ok: boolean; detail: string }> = [];

  items.push({
    id: "keywords",
    label: "Keywords",
    ok: (draft.keywords?.length ?? 0) >= 3,
    detail: (draft.keywords?.length ?? 0) >= 3 ? "Ready" : "Add at least 3 keywords",
  });
  items.push({
    id: "search_phrases",
    label: "Search Phrases",
    ok: (draft.search_phrases?.length ?? 0) >= 1,
    detail: (draft.search_phrases?.length ?? 0) >= 1 ? "Ready" : "Missing search phrases",
  });
  items.push({
    id: "synonyms",
    label: "Synonyms",
    ok: (draft.synonyms?.length ?? 0) >= 1,
    detail: (draft.synonyms?.length ?? 0) >= 1 ? "Ready" : "Missing synonyms",
  });
  items.push({
    id: "alternative_wording",
    label: "Alternative Wording",
    ok: (draft.alternative_wording?.length ?? 0) >= 1,
    detail: (draft.alternative_wording?.length ?? 0) >= 1 ? "Ready" : "Missing alternative wording",
  });

  return items;
}

function KnowledgeHealthStrip({
  items,
}: {
  items: Array<{ id: string; label: string; ok: boolean; detail: string }>;
}) {
  const missing = items.filter((i) => !i.ok);
  if (missing.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3.5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
        <HeartPulse className="h-3.5 w-3.5" />
        Knowledge Health
      </div>
      <ul className="mt-2 space-y-1">
        {missing.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-xs text-amber-900">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span className="font-medium">{item.label}:</span>
            <span className="text-amber-800">{item.detail}</span>
          </li>
        ))}
      </ul>
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
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-xs font-medium text-slate-900">{question}</p>
      <p className="mt-0.5 text-[10px] text-slate-600">
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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
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
  const confidence = item.explanation?.confidenceLabel ?? DUPLICATE_CONFIDENCE_LABELS.related_topic;

  return (
    <div className={cn("rounded-xl border p-3.5 shadow-sm", styles.border, styles.bg)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <ClassificationBadge classification={item.classification} />
        <span className={cn("text-xs font-bold tabular-nums", styles.text)}>
          {item.scores.combined}% · {confidence}
        </span>
      </div>
      <button
        type="button"
        className="mt-1.5 w-full rounded-lg px-1 py-1 text-left text-xs font-medium text-slate-900 hover:bg-white/60"
        onClick={() => onSelectEntry(item.entry.id)}
      >
        {item.entry.question}
      </button>
      <ScoreBreakdown scores={item.scores} />
      <p className={cn("mt-2 text-[11px] leading-relaxed", styles.text)}>
        {item.explanation?.summary ?? item.recommendation}
      </p>
      <p className={cn("mt-1 text-[11px] font-medium", styles.text)}>
        {item.explanation?.recommendation ?? item.recommendation}
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
    <div className={cn("rounded-xl border p-3.5 shadow-sm", styles.border, styles.bg)}>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
        <span className="text-xs font-semibold text-emerald-900">Related — Different Intent</span>
        <ClassificationBadge classification="different_intent" />
      </div>
      <ScoreBreakdown scores={item.scores} />
      <p className="mt-1.5 text-xs leading-relaxed text-emerald-800">
        {item.explanation?.recommendation ??
          "This question is related but represents a different user intent. Save as a new lesson."}
      </p>
      <button
        type="button"
        className="mt-1.5 text-xs font-medium text-emerald-900 underline-offset-2 hover:underline"
        onClick={() => onSelectEntry(item.entry.id)}
      >
        {item.entry.question}
      </button>
    </div>
  );
}

function ScoreBreakdown({ scores }: { scores: DuplicateMatchApiItem["scores"] }) {
  const rows = [
    { label: "Intent", value: scores.intentSimilarity },
    { label: "Entity", value: scores.entitySimilarity },
    { label: "Keywords", value: scores.keywordOverlap },
    { label: "Meaning", value: scores.meaning ?? scores.semanticSimilarity },
  ];

  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="rounded-md bg-white/60 px-2 py-1.5">
          <p className="text-[9px] font-semibold uppercase text-slate-400">{row.label}</p>
          <p className="text-xs font-bold tabular-nums text-slate-700">{row.value}%</p>
        </div>
      ))}
    </div>
  );
}
