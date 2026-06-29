"use client";

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Circle,
  HeartPulse,
  Map,
  Target,
  TrendingUp,
} from "lucide-react";
import type { CurriculumPlannerSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import {
  SuggestedRelatedLessons,
} from "@/components/super-admin/ai-training/suggested-related-lessons";
import { cn } from "@/lib/utils";

export function CurriculumPlannerMetrics({
  analytics,
}: {
  analytics: CurriculumPlannerSnapshot["analytics"];
}) {
  const cards = [
    {
      label: "Knowledge Coverage",
      value: `${analytics.knowledgeCoveragePercent}%`,
      icon: TrendingUp,
      tone: "text-violet-700 bg-violet-50 ring-violet-100",
    },
    {
      label: "Critical Lessons",
      value: `${analytics.criticalLessonsCompleted} / ${analytics.criticalLessonsTotal}`,
      icon: Target,
      tone: "text-rose-700 bg-rose-50 ring-rose-100",
    },
    {
      label: "Medium Priority",
      value: String(analytics.mediumPriorityCount),
      icon: BookOpen,
      tone: "text-sky-700 bg-sky-50 ring-sky-100",
    },
    {
      label: "Low Priority",
      value: String(analytics.lowPriorityCount),
      icon: Circle,
      tone: "text-slate-700 bg-slate-50 ring-slate-100",
    },
    {
      label: "Est. Training Completion",
      value: `${analytics.estimatedTrainingCompletionPercent}%`,
      icon: CheckCircle2,
      tone: "text-emerald-700 bg-emerald-50 ring-emerald-100",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn("rounded-xl p-3.5 ring-1 ring-inset shadow-sm", card.tone)}
        >
          <div className="flex items-center gap-2">
            <card.icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{card.label}</p>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

export function KnowledgeRoadmapPanel({
  roadmap,
  onSelectEntry,
  onCreateLesson,
}: {
  roadmap: CurriculumPlannerSnapshot["roadmap"];
  onSelectEntry?: (entryId: string) => void;
  onCreateLesson?: (question: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Map className="h-4 w-4 text-violet-600" aria-hidden />
        <h3 className="text-sm font-semibold text-slate-900">Knowledge Roadmap</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Foundational learning paths — completed vs missing lessons by topic.
      </p>

      <div className="mt-4 space-y-4">
        {roadmap.map((track) => (
          <div key={track.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900">{track.label}</h4>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>
                  {track.completedCount}/{track.totalCount} complete
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 font-bold tabular-nums text-violet-700 ring-1 ring-violet-100">
                  {track.coveragePercent}%
                </span>
              </div>
            </div>
            <ul className="mt-2 space-y-1">
              {track.lessons.map((lesson) => (
                <li key={lesson.question} className="flex items-start gap-2 text-sm">
                  {lesson.status === "completed" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                  )}
                  {lesson.entryId && onSelectEntry ? (
                    <button
                      type="button"
                      className="text-left text-slate-800 hover:text-violet-800 hover:underline"
                      onClick={() => onSelectEntry(lesson.entryId!)}
                    >
                      {lesson.question}
                    </button>
                  ) : onCreateLesson && lesson.status === "missing" ? (
                    <button
                      type="button"
                      className="text-left font-medium text-amber-900 hover:underline"
                      onClick={() => onCreateLesson(lesson.question)}
                    >
                      {lesson.question}
                    </button>
                  ) : (
                    <span
                      className={cn(
                        lesson.status === "completed" ? "text-slate-700" : "font-medium text-amber-900"
                      )}
                    >
                      {lesson.question}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const GAP_KIND_LABELS: Record<string, string> = {
  missing_concept: "Missing concept",
  weak_coverage: "Weak coverage",
  duplicate: "Duplicate",
  orphan: "Orphan lesson",
  disconnected: "Disconnected",
  unused_category: "Unused category",
  broken_dependency: "Broken dependency",
  circular_reference: "Circular reference",
};

const SEVERITY_STYLES = {
  critical: "border-rose-200 bg-rose-50/60 text-rose-900",
  high: "border-amber-200 bg-amber-50/60 text-amber-900",
  medium: "border-sky-200 bg-sky-50/60 text-sky-900",
  low: "border-slate-200 bg-slate-50 text-slate-800",
} as const;

export function KnowledgeGapHealthPanel({
  issues,
  onSelectEntry,
}: {
  issues: CurriculumPlannerSnapshot["gapIssues"];
  onSelectEntry?: (entryId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-4 w-4 text-rose-600" aria-hidden />
        <h3 className="text-sm font-semibold text-slate-900">Knowledge Health</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Gaps, weak areas, orphans, broken dependencies, and repeated unanswered questions.
      </p>

      {issues.length === 0 ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-4 text-center text-sm text-emerald-800">
          No significant knowledge health issues detected.
        </p>
      ) : (
        <ul className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                SEVERITY_STYLES[issue.severity]
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                  {GAP_KIND_LABELS[issue.kind] ?? issue.kind}
                </span>
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-black/5">
                  {issue.severity}
                </span>
              </div>
              {issue.entryId && onSelectEntry ? (
                <button
                  type="button"
                  className="mt-1 text-left text-sm font-semibold hover:underline"
                  onClick={() => onSelectEntry(issue.entryId!)}
                >
                  {issue.title}
                </button>
              ) : (
                <p className="mt-1 text-sm font-semibold">{issue.title}</p>
              )}
              <p className="mt-0.5 text-xs leading-relaxed opacity-90">{issue.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CurriculumPlannerPanel({
  planner,
  onSelectEntry,
  onCreateLesson,
}: {
  planner: CurriculumPlannerSnapshot;
  onSelectEntry?: (entryId: string) => void;
  onCreateLesson?: (question: string, category?: string) => void;
}) {
  const topMissing = planner.topRecommendations.filter((r) => !r.inDatabase);

  return (
    <div className="space-y-4">
      <CurriculumPlannerMetrics analytics={planner.analytics} />

      <div className="grid gap-4 lg:grid-cols-2">
        <KnowledgeRoadmapPanel
          roadmap={planner.roadmap}
          onSelectEntry={onSelectEntry}
          onCreateLesson={(q) => onCreateLesson?.(q)}
        />
        <KnowledgeGapHealthPanel issues={planner.gapIssues} onSelectEntry={onSelectEntry} />
      </div>

      {topMissing.length > 0 ? (
        <SuggestedRelatedLessons
          suggestions={topMissing.map((r) => ({
            ...r,
            moduleId: r.moduleId ?? null,
            moduleName: r.moduleName ?? null,
            becauseYouCreated: r.becauseYouCreated ?? null,
          }))}
          onSelectEntry={onSelectEntry}
          onCreateLesson={onCreateLesson}
        />
      ) : null}
    </div>
  );
}
