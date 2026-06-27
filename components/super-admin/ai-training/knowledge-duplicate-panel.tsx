"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DuplicateCheckEntrySummary {
  id: string;
  question: string;
  category: string;
  intent_key: string | null;
  version_number?: number;
  health_status?: string;
}

export interface DuplicateCheckApiResult {
  normalizedQuestion: string;
  exactMatch: {
    entry: DuplicateCheckEntrySummary;
    similarity: number;
    matchReasons: string[];
    isExact: boolean;
  } | null;
  similar: Array<{
    entry: DuplicateCheckEntrySummary;
    similarity: number;
    matchReasons: string[];
    isExact: boolean;
  }>;
  suggestedIntentKey: string | null;
  suggestedIntentName: string | null;
  suggestedCategory: string | null;
  relatedEntries: Array<{
    entry: DuplicateCheckEntrySummary;
    similarity: number;
    matchReasons: string[];
    isExact: boolean;
  }>;
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

  const hasSimilar = (result?.similar.length ?? 0) > 0;
  const hasSuggestions =
    result?.suggestedIntentKey ||
    result?.suggestedCategory ||
    (result?.relatedEntries.length ?? 0) > 0;

  if (!loading && !hasSimilar && !hasSuggestions) return null;

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-amber-800">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking for similar entries…
        </div>
      ) : null}

      {!loading && hasSimilar ? (
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Similar knowledge entries found
          </div>
          <ul className="mt-2 space-y-1.5">
            {result!.similar.map((item) => (
              <li key={item.entry.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                    "hover:bg-amber-100/80 focus:bg-amber-100/80 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  )}
                  onClick={() => onSelectEntry(item.entry.id)}
                >
                  <span className="font-medium text-slate-900">{item.entry.question}</span>
                  <span className="ml-2 text-xs font-semibold text-amber-800">
                    {item.similarity}% similar
                  </span>
                  {item.isExact ? (
                    <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                      Exact
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!loading && hasSuggestions ? (
        <div className="border-t border-amber-200/80 pt-3">
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
