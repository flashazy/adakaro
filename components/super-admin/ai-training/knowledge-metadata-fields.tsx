"use client";

import { useMemo, useRef, useState, type MutableRefObject } from "react";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { KnowledgeMetadataGenerationResult, MetadataField } from "@/lib/ai-training/knowledge-metadata-generator";
import { metadataFieldsMatchSource } from "@/lib/ai-training/knowledge-metadata-generator";
import { validateMetadataDraft } from "@/lib/ai-training/knowledge-metadata-validator";
import {
  HighlightedTextarea,
  type HighlightedTextareaHandle,
  type TextHighlight,
} from "@/components/super-admin/ai-training/highlighted-textarea";
import { saBtnSecondary, saInput } from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";

export type MetadataFormFields = {
  keywords: string;
  synonyms: string;
  search_phrases: string;
  alternative_wording: string;
  related_terms: string;
};

const FIELD_CONFIG: Array<{ key: MetadataField; label: string; hint: string }> = [
  { key: "keywords", label: "Keywords", hint: "One keyword or phrase per line (max 4 words)" },
  { key: "synonyms", label: "Synonyms", hint: "Short synonym phrases" },
  { key: "search_phrases", label: "Search Phrases", hint: "Lowercase natural search queries, 1–8 words per line" },
  { key: "alternative_wording", label: "Alternative Wording", hint: "Other ways to ask the same question" },
  { key: "related_terms", label: "Related Terms", hint: "Related concepts and modules" },
];

function keywordsToText(items: string[]): string {
  return items.join("\n");
}

interface KnowledgeMetadataFieldsProps {
  category: string;
  question: string;
  answer: string;
  fields: MetadataFormFields;
  onChange: (fields: MetadataFormFields) => void;
  metadataBaseline: { question: string; answer: string } | null;
  onBaselineUpdate: (baseline: { question: string; answer: string }) => void;
  showGeneratedNotice: boolean;
  onGeneratedNotice: (show: boolean) => void;
  fieldHighlights?: Partial<Record<MetadataField, TextHighlight[]>>;
  activeFieldRange?: { field: MetadataField; start: number; end: number } | null;
  fieldRefs?: MutableRefObject<Partial<Record<MetadataField, HighlightedTextareaHandle | null>>>;
  onHighlightAction?: (issueId: string, action: "accept" | "ignore") => void;
}

export function KnowledgeMetadataFields({
  category,
  question,
  answer,
  fields,
  onChange,
  metadataBaseline,
  onBaselineUpdate,
  showGeneratedNotice,
  onGeneratedNotice,
  fieldHighlights,
  activeFieldRange,
  fieldRefs,
  onHighlightAction,
}: KnowledgeMetadataFieldsProps) {
  const [generating, setGenerating] = useState(false);
  const [generatingField, setGeneratingField] = useState<MetadataField | null>(null);
  const [focusedField, setFocusedField] = useState<MetadataField>("keywords");
  const [error, setError] = useState<string | null>(null);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const metadataOutdated = useMemo(
    () => !metadataFieldsMatchSource(metadataBaseline, question, answer),
    [metadataBaseline, question, answer]
  );

  const fieldErrors = useMemo(() => {
    const validation = validateMetadataDraft(
      {
        keywords: textToKeywords(fields.keywords),
        synonyms: textToKeywords(fields.synonyms),
        search_phrases: textToKeywords(fields.search_phrases),
        alternative_wording: textToKeywords(fields.alternative_wording),
        related_terms: textToKeywords(fields.related_terms),
      },
      question
    );
    return validation.fieldErrors;
  }, [fields, question]);

  const applyResult = (result: KnowledgeMetadataGenerationResult, onlyField?: MetadataField) => {
    if (onlyField) {
      onChange({
        ...fields,
        [onlyField]: keywordsToText(result[onlyField]),
      });
    } else {
      onChange({
        keywords: keywordsToText(result.keywords),
        synonyms: keywordsToText(result.synonyms),
        search_phrases: keywordsToText(result.search_phrases),
        alternative_wording: keywordsToText(result.alternative_wording),
        related_terms: keywordsToText(result.related_terms),
      });
    }
    onBaselineUpdate({ question: question.trim(), answer: answer.trim() });
    onGeneratedNotice(true);
  };

  const runGenerate = async (field?: MetadataField) => {
    if (!question.trim()) {
      setError("Add a question before generating metadata.");
      return;
    }
    if (!answer.trim()) {
      setError("Add an answer before generating metadata.");
      return;
    }

    setError(null);
    if (field) setGeneratingField(field);
    else setGenerating(true);

    try {
      const res = await fetch("/api/super-admin/ai-training/knowledge/generate-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim(),
          category,
          field,
        }),
      });
      if (!res.ok) throw new Error("Metadata generation failed");
      const result = (await res.json()) as KnowledgeMetadataGenerationResult;
      applyResult(result, field);
      setLastConfidence(96);
      setShowSuccess(true);
      window.setTimeout(() => setShowSuccess(false), 2500);
    } catch {
      setError("Could not generate metadata. Try again.");
    } finally {
      setGenerating(false);
      setGeneratingField(null);
    }
  };

  const busy = generating || generatingField !== null;

  return (
    <div className="space-y-3">
      {metadataOutdated ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span>⚠ Metadata may be outdated.</span>
          </div>
          <button
            type="button"
            className={cn(saBtnSecondary, "text-xs")}
            disabled={busy}
            onClick={() => void runGenerate()}
          >
            Regenerate Metadata
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={saBtnSecondary}
          disabled={busy || !question.trim() || !answer.trim()}
          onClick={() => void runGenerate()}
        >
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
          )}
          Generate AI Metadata
        </button>
        <button
          type="button"
          className={saBtnSecondary}
          disabled={busy || !question.trim() || !answer.trim()}
          onClick={() => void runGenerate(focusedField)}
        >
          {generatingField ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          )}
          Regenerate Selected Field
        </button>
        {showGeneratedNotice && !metadataOutdated ? (
          <span className="text-xs font-medium text-emerald-700 animate-in fade-in">
            {showSuccess && lastConfidence !== null
              ? `Generated · ${lastConfidence}% confidence`
              : "Generated from Question + Answer"}
          </span>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELD_CONFIG.map(({ key, label, hint }) => (
          <label key={key} className="block text-sm">
            <span className="font-medium text-slate-700">{label}</span>
            <span className="mt-0.5 block text-[10px] text-slate-400">{hint}</span>
            {(fieldHighlights?.[key]?.length ?? 0) > 0 || onHighlightAction ? (
              <HighlightedTextarea
                ref={(handle) => {
                  if (fieldRefs) fieldRefs.current[key] = handle;
                }}
                value={fields[key]}
                onChange={(value) => {
                  onGeneratedNotice(false);
                  onChange({ ...fields, [key]: value });
                }}
                rows={3}
                placeholder="One per line"
                highlights={fieldHighlights?.[key] ?? []}
                activeRange={
                  activeFieldRange?.field === key
                    ? { start: activeFieldRange.start, end: activeFieldRange.end }
                    : null
                }
                onHighlightAction={onHighlightAction}
                className={cn(
                  "mt-1 text-xs",
                  focusedField === key && "ring-2 ring-violet-200",
                  (fieldErrors[key]?.length ?? 0) > 0 && "border-red-300 ring-red-100"
                )}
              />
            ) : (
              <textarea
                value={fields[key]}
                onFocus={() => setFocusedField(key)}
                onChange={(e) => {
                  onGeneratedNotice(false);
                  onChange({ ...fields, [key]: e.target.value });
                }}
                rows={3}
                placeholder="One per line"
                className={cn(
                  saInput,
                  "mt-1 w-full font-mono text-xs",
                  focusedField === key && "ring-2 ring-violet-200",
                  (fieldErrors[key]?.length ?? 0) > 0 && "border-red-300 ring-red-100"
                )}
              />
            )}
            {(fieldErrors[key]?.length ?? 0) > 0 ? (
              <ul className="mt-1 space-y-1 text-[10px] text-red-600 whitespace-pre-wrap">
                {fieldErrors[key]!.slice(0, 3).map((msg) => (
                  <li key={msg}>{msg.startsWith("•") ? msg : `• ${msg}`}</li>
                ))}
              </ul>
            ) : null}
          </label>
        ))}
      </div>
    </div>
  );
}

export { keywordsToText };

export function textToKeywords(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
