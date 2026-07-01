"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Pencil,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  saBtnPrimarySm,
  saBtnSecondarySm,
  saSectionSubtitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import {
  buildRecommendedAnswerTemplate,
  validateKnowledgeWritingStandard,
  type KnowledgeWritingDraft,
} from "@/lib/ai-training/knowledge-writing-standard";
import type { EnterpriseReadinessResult } from "@/lib/ai-training/knowledge-authoring";
import { collectValidationIssues, groupValidationIssues } from "@/lib/ai-training/collect-validation-issues";
import type { GroupedValidationIssue, ValidationIssue } from "@/lib/ai-training/knowledge-validation-locations";
import { cn } from "@/lib/utils";

function LocationBreadcrumb({ issue }: { issue: ValidationIssue }) {
  const { location } = issue;
  return (
    <div className="mt-2 space-y-0.5 text-[11px] text-slate-600">
      <p className="flex items-center gap-1 font-medium text-slate-700">
        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
        Location
      </p>
      <p className="pl-4">{location.section}</p>
      <p className="pl-4">→ {location.field}</p>
      <p className="pl-4">
        → Paragraph {location.paragraphIndex + 1}
        {location.sentenceIndex > 0 || issue.original.includes(".")
          ? ` → Sentence ${location.sentenceIndex + 1}`
          : null}
      </p>
    </div>
  );
}

function IssueCard({
  group,
  index,
  isActive,
  onJump,
  onReplace,
  onEdit,
  onIgnore,
}: {
  group: GroupedValidationIssue;
  index: number;
  isActive: boolean;
  onJump?: () => void;
  onReplace?: () => void;
  onEdit?: () => void;
  onIgnore?: () => void;
}) {
  const primary = group.issues[0];
  if (!primary) return null;

  return (
    <article
      className={cn(
        "rounded-lg border p-3 text-xs transition-shadow",
        isActive
          ? "border-indigo-300 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-100"
          : "border-slate-200 bg-white"
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        Issue #{index + 1}
        {group.count > 1 ? ` · ${group.count} items` : ""}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{group.ruleLabel}</p>
      <p className="mt-1 text-[11px] text-slate-600">{group.summary}</p>

      <LocationBreadcrumb issue={primary} />

      <div className="mt-3 space-y-2">
        <div>
          <p className="font-semibold text-slate-700">Current</p>
          <p className="mt-0.5 rounded-md bg-slate-50 px-2 py-1.5 italic text-slate-800">
            {group.examples[0] ?? primary.original ?? "—"}
          </p>
          {group.examples.length > 1 ? (
            <ul className="mt-1 space-y-0.5 text-[10px] text-slate-500">
              {group.examples.slice(1).map((example) => (
                <li key={example}>• {example}</li>
              ))}
            </ul>
          ) : null}
        </div>
        {primary.suggestion ? (
          <div>
            <p className="font-semibold text-emerald-800">Suggested</p>
            <p className="mt-0.5 rounded-md bg-emerald-50/80 px-2 py-1.5 text-emerald-900">
              {primary.suggestion}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {onJump ? (
          <button type="button" className={saBtnSecondarySm} onClick={onJump}>
            <MapPin className="mr-1 h-3 w-3" />
            Jump to sentence
          </button>
        ) : null}
        {onReplace && group.fixable && primary.suggestion ? (
          <button type="button" className={saBtnPrimarySm} onClick={onReplace}>
            <Wand2 className="mr-1 h-3 w-3" />
            Accept
          </button>
        ) : null}
        {onEdit ? (
          <button type="button" className={saBtnSecondarySm} onClick={onEdit}>
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </button>
        ) : null}
        {onIgnore ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
            onClick={onIgnore}
          >
            Ignore
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function KnowledgeWritingChecklist({
  draft,
  onApplyTemplate,
  readiness,
  onFixAllQuality,
  fixingAll,
  issues: issuesProp,
  activeIssueIndex: activeIssueIndexProp,
  onActiveIssueChange: onActiveIssueChangeProp,
  onJumpToIssue,
  onReplaceIssue,
  onEditIssue,
  onIgnoreIssue,
}: {
  draft: KnowledgeWritingDraft;
  onApplyTemplate?: () => void;
  readiness?: EnterpriseReadinessResult | null;
  onAutoFixLanguage?: () => void;
  onFixAllQuality?: () => void;
  fixingAll?: boolean;
  issues?: ValidationIssue[];
  activeIssueIndex?: number;
  onActiveIssueChange?: (index: number) => void;
  onJumpToIssue?: (issue: ValidationIssue) => void;
  onReplaceIssue?: (issue: ValidationIssue) => void;
  onEditIssue?: (issue: ValidationIssue) => void;
  onIgnoreIssue?: (issue: ValidationIssue) => void;
}) {
  const validation = useMemo(
    () => validateKnowledgeWritingStandard(draft),
    [draft]
  );

  const [expanded, setExpanded] = useState(true);
  const [localIssueIndex, setLocalIssueIndex] = useState(0);

  const fallbackIssues = useMemo(
    () => collectValidationIssues(draft, readiness ?? null),
    [draft, readiness]
  );
  const issues = issuesProp ?? fallbackIssues;
  const groupedIssues = useMemo(() => groupValidationIssues(issues), [issues]);
  const activeIssueIndex = activeIssueIndexProp ?? localIssueIndex;
  const onActiveIssueChange = onActiveIssueChangeProp ?? setLocalIssueIndex;

  const totalChecks = readiness?.checks.length ?? validation.checklist.length;
  const passedChecks =
    readiness?.checks.filter((c) => c.passed).length ??
    validation.checklist.filter((c) => c.passed).length;
  const issueCount = groupedIssues.length;

  const activeGroup = groupedIssues[activeIssueIndex] ?? null;
  const activeIssue = activeGroup?.issues[0] ?? null;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey || groupedIssues.length === 0) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        onActiveIssueChange(Math.max(0, activeIssueIndex - 1));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        onActiveIssueChange(Math.min(groupedIssues.length - 1, activeIssueIndex + 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [groupedIssues.length, activeIssueIndex, onActiveIssueChange]);

  const ready = readiness?.ready ?? validation.passed;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex flex-wrap items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-600" aria-hidden />
          <span className="text-sm font-semibold text-slate-900">Enterprise Quality Review</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            {passedChecks} Passed
          </span>
          {issueCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              {issueCount} {issueCount === 1 ? "Issue" : "Issues"}
            </span>
          ) : (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                ready ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
              )}
            >
              {ready ? "Enterprise Ready" : "Review"}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-slate-400 transition", expanded && "rotate-180")}
        />
      </button>

      {expanded ? (
        <div className="mt-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs text-slate-600">
              {issueCount === 0 ? (
                <span className="font-semibold text-emerald-700">All quality checks passed</span>
              ) : (
                <>
                  <span className="font-semibold text-amber-800">{issueCount} issues remaining</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span>{passedChecks} / {totalChecks} checks passed</span>
                </>
              )}
            </p>
            {groupedIssues.length > 1 ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={saBtnSecondarySm}
                  disabled={activeIssueIndex <= 0}
                  onClick={() => onActiveIssueChange(activeIssueIndex - 1)}
                  title="Previous issue (Alt+↑)"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </button>
                <button
                  type="button"
                  className={saBtnSecondarySm}
                  disabled={activeIssueIndex >= groupedIssues.length - 1}
                  onClick={() => onActiveIssueChange(activeIssueIndex + 1)}
                  title="Next issue (Alt+↓)"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>

          {groupedIssues.length > 0 ? (
            <div className="space-y-3">
              {activeGroup && activeIssue ? (
                <IssueCard
                  group={activeGroup}
                  index={activeIssueIndex}
                  isActive
                  onJump={onJumpToIssue ? () => onJumpToIssue(activeIssue) : undefined}
                  onReplace={
                    onReplaceIssue && activeIssue.fixable
                      ? () => {
                          for (const item of activeGroup.issues.filter((i) => i.fixable)) {
                            onReplaceIssue(item);
                          }
                        }
                      : undefined
                  }
                  onEdit={onEditIssue ? () => onEditIssue(activeIssue) : undefined}
                  onIgnore={
                    onIgnoreIssue
                      ? () => {
                          for (const item of activeGroup.issues) {
                            onIgnoreIssue(item);
                          }
                        }
                      : undefined
                  }
                />
              ) : null}

              {groupedIssues.length > 1 ? (
                <ul className="space-y-1.5">
                  {groupedIssues.map((group, idx) =>
                    idx === activeIssueIndex ? null : (
                      <li key={group.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between rounded-md border border-slate-100 bg-white px-2.5 py-1.5 text-left text-[11px] hover:border-indigo-200 hover:bg-indigo-50/30"
                          onClick={() => onActiveIssueChange(idx)}
                        >
                          <span className="font-medium text-slate-800">
                            {group.ruleLabel}
                            <span className="ml-1.5 font-normal text-slate-500">
                              — {group.summary}
                            </span>
                          </span>
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        </button>
                      </li>
                    )
                  )}
                </ul>
              ) : null}
            </div>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {(readiness?.checks ?? validation.checklist.map((c) => ({
                id: c.id,
                label: c.label,
                passed: c.passed,
              }))).map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "rounded-lg px-2 py-1.5 text-xs",
                    item.passed ? "text-emerald-800 bg-emerald-50/50" : "text-slate-500"
                  )}
                >
                  {item.passed ? "✓" : "○"} {item.label}
                </li>
              ))}
            </ul>
          )}

          {readiness && readiness.blockers.length > 0 && issues.length === 0 ? (
            <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-800">
              {readiness.blockers.map((blocker) => (
                <li key={blocker}>• {blocker}</li>
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

          <div className="flex flex-wrap gap-2">
            {onFixAllQuality ? (
              <button
                type="button"
                className={saBtnPrimarySm}
                disabled={fixingAll}
                onClick={onFixAllQuality}
              >
                {fixingAll ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                )}
                Fix All Quality Issues
              </button>
            ) : null}
            {onApplyTemplate && !draft.answer.trim() && draft.question.trim() ? (
              <button type="button" className={saBtnSecondarySm} onClick={onApplyTemplate}>
                Insert recommended answer structure
              </button>
            ) : null}
          </div>

          {groupedIssues.length > 0 ? (
            <p className="text-[10px] text-slate-400">
              Tip: Use Alt+↑ and Alt+↓ to cycle through grouped issues.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function KnowledgePostSaveRecommendations({
  recommendations,
  onCreateLesson,
  onDismiss,
}: {
  recommendations: Array<{
    question: string;
    reason: string;
    supportingReasons?: string[];
    dependentLessonCount?: number;
    priorityScore: number;
    priorityLevel: string;
    starRating: number;
    inDatabase: boolean;
  }>;
  onCreateLesson: (question: string) => void;
  onDismiss: () => void;
}) {
  if (recommendations.length === 0) return null;

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-violet-900">
            <Sparkles className="h-4 w-4" />
            Recommended Next Lessons
          </p>
          <p className={cn(saSectionSubtitle, "mt-0.5")}>
            Missing knowledge detected from the dependency graph.
          </p>
        </div>
        <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {recommendations.map((rec) => (
          <li
            key={rec.question.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white/80 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900">{rec.question}</p>
              <p className="whitespace-pre-wrap text-[10px] leading-relaxed text-slate-500">{rec.reason}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-amber-600">
                {"★".repeat(rec.starRating)}
                <span className="text-slate-300">{"★".repeat(5 - rec.starRating)}</span>
              </span>
              <span className="text-[10px] font-bold tabular-nums text-slate-600">
                {rec.priorityScore}
              </span>
              {!rec.inDatabase ? (
                <button
                  type="button"
                  className={saBtnSecondarySm}
                  onClick={() => onCreateLesson(rec.question)}
                >
                  Create
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { buildRecommendedAnswerTemplate };
