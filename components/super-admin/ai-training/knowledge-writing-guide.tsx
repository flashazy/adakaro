"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  X,
} from "lucide-react";
import {
  saBtnSecondary,
  saBtnSecondarySm,
  saSectionSubtitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import {
  buildKnowledgeWritingStandardMarkdown,
  buildRecommendedAnswerTemplate,
  KNOWLEDGE_WRITING_STANDARD_META,
  KNOWLEDGE_WRITING_STANDARD_SECTIONS,
  KNOWLEDGE_WRITING_STANDARD_VERSION,
  validateKnowledgeWritingStandard,
  type KnowledgeWritingDraft,
  type WritingStandardValidation,
} from "@/lib/ai-training/knowledge-writing-standard";
import { cn } from "@/lib/utils";

export function KnowledgeWritingStandardModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[240] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="writing-standard-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Permanent Guide · v{KNOWLEDGE_WRITING_STANDARD_VERSION}
            </p>
            <h2 id="writing-standard-title" className="text-lg font-semibold text-slate-900">
              {KNOWLEDGE_WRITING_STANDARD_META.title}
            </h2>
            <p className={saSectionSubtitle}>
              How every knowledge entry must be written. Facts here — conversation tone in the
              Global System Prompt.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close writing standard"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {KNOWLEDGE_WRITING_STANDARD_SECTIONS.map((section) => (
              <section
                key={section.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
              >
                <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            className={saBtnSecondary}
            onClick={() => {
              void navigator.clipboard.writeText(buildKnowledgeWritingStandardMarkdown());
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Markdown
          </button>
          <button type="button" className={saBtnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function KnowledgeWritingChecklist({
  draft,
  onApplyTemplate,
}: {
  draft: KnowledgeWritingDraft;
  onApplyTemplate?: () => void;
}) {
  const validation = useMemo(
    () => validateKnowledgeWritingStandard(draft),
    [draft]
  );

  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-600" aria-hidden />
          <span className="text-sm font-semibold text-slate-900">
            Enterprise Quality Checklist
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
              validation.passed
                ? "bg-emerald-100 text-emerald-800"
                : validation.requiredPassed
                  ? "bg-amber-100 text-amber-800"
                  : "bg-red-100 text-red-800"
            )}
          >
            {validation.passed
              ? "Ready"
              : validation.requiredPassed
                ? "Review"
                : "Incomplete"}
          </span>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-slate-400 transition", expanded && "rotate-180")}
        />
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3">
          <ChecklistGrid validation={validation} />

          {validation.issues.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-800">
              {validation.issues.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          ) : null}

          {validation.warnings.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
              {validation.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          ) : null}

          {onApplyTemplate && !draft.answer.trim() && draft.question.trim() ? (
            <button type="button" className={saBtnSecondarySm} onClick={onApplyTemplate}>
              Insert recommended answer structure
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ChecklistGrid({ validation }: { validation: WritingStandardValidation }) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {validation.checklist.map((item) => (
        <li
          key={item.id}
          className={cn(
            "flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs",
            item.passed ? "text-slate-700" : item.required ? "text-red-800" : "text-amber-800"
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
              item.passed ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-400"
            )}
            aria-hidden
          >
            {item.passed ? <Check className="h-3 w-3" /> : null}
          </span>
          <span>
            {item.label}
            {item.hint && !item.passed ? (
              <span className="mt-0.5 block text-[10px] opacity-80">{item.hint}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function KnowledgeWritingStandardButton({
  onClick,
  compact = false,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button type="button" className={saBtnSecondary} onClick={onClick}>
      <BookOpen className="mr-2 h-4 w-4" aria-hidden />
      {compact ? "Writing Standard" : "Knowledge Writing Standard"}
      <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-60" aria-hidden />
    </button>
  );
}

export { buildRecommendedAnswerTemplate };
