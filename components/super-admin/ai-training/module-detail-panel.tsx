"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  Pencil,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import {
  saBtnPrimary,
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
import { formatDateTime } from "@/components/super-admin/ai-training/shared";
import type {
  CurriculumLesson,
  CurriculumModuleRow,
  ModuleHealthLabel,
  LessonStatus,
} from "@/lib/ai-training/knowledge-curriculum";
import { cn } from "@/lib/utils";

const HEALTH_STYLES: Record<ModuleHealthLabel, string> = {
  excellent: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  good: "bg-sky-100 text-sky-800 ring-sky-200",
  needs_improvement: "bg-amber-100 text-amber-800 ring-amber-200",
  incomplete: "bg-slate-200 text-slate-700 ring-slate-300",
};

const LESSON_STATUS_STYLES: Record<LessonStatus, string> = {
  published: "bg-emerald-100 text-emerald-800",
  draft: "bg-slate-200 text-slate-700",
  needs_review: "bg-amber-100 text-amber-800",
  archived: "bg-red-100 text-red-800",
};

export interface ModuleDetailPanelProps {
  module: CurriculumModuleRow;
  savingTarget: boolean;
  filteredLessons: CurriculumLesson[];
  filters: {
    filterPriority: string;
    setFilterPriority: (v: string) => void;
    filterStatus: string;
    setFilterStatus: (v: string) => void;
    filterHealth: string;
    setFilterHealth: (v: string) => void;
    filterIntent: string;
    setFilterIntent: (v: string) => void;
    filterNeedsReview: boolean;
    setFilterNeedsReview: (v: boolean) => void;
    search: string;
    setSearch: (v: string) => void;
  };
  onBack: () => void;
  onOpenEntry: (id: string) => void;
  onAddLesson: () => void;
  onGenerateLessons: () => void;
  onSaveModuleTarget: (target: number) => void;
  onExport: () => void;
}

export function ModuleDetailPanel({
  module,
  savingTarget,
  filteredLessons,
  filters,
  onBack,
  onOpenEntry,
  onAddLesson,
  onGenerateLessons,
  onSaveModuleTarget,
  onExport,
}: ModuleDetailPanelProps) {
  const [targetInput, setTargetInput] = useState(String(module.targetLessons));
  const [editingTarget, setEditingTarget] = useState(false);

  useEffect(() => {
    setTargetInput(String(module.targetLessons));
  }, [module.targetLessons]);

  return (
    <div className="mt-8 space-y-6">
      <button type="button" className={saBtnSecondarySm} onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        All modules
      </button>

      <div className={cn(saSection, "bg-gradient-to-br from-indigo-50/80 to-white")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Curriculum Module
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{module.name}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{module.description}</p>
            <p className="mt-3 text-sm font-medium text-slate-700">
              Progress: {module.completedLessons} / {module.targetLessons} lessons
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={saBtnPrimary} onClick={onAddLesson}>
              <Plus className="mr-2 h-4 w-4" />
              Add Lesson
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:from-indigo-700 hover:to-violet-700"
              onClick={onGenerateLessons}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Lessons
            </button>
            <button type="button" className={saBtnSecondary} onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-slate-200/80">
            <p className="text-xs font-semibold uppercase text-slate-400">Progress</p>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {module.completedLessons} / {module.targetLessons} lessons
            </p>
            <ProgressBar percent={module.completionPercent} className="mt-3" />
          </div>
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-slate-200/80">
            <p className="text-xs font-semibold uppercase text-slate-400">Target</p>
            {editingTarget ? (
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className={cn(saInput, "w-full")}
                />
                <button
                  type="button"
                  className={saBtnPrimarySm}
                  disabled={savingTarget}
                  onClick={() => {
                    const v = Number(targetInput);
                    if (Number.isFinite(v) && v > 0) {
                      onSaveModuleTarget(v);
                      setEditingTarget(false);
                    }
                  }}
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xl font-bold">{module.targetLessons}</p>
                <button
                  type="button"
                  className={saBtnSecondarySm}
                  onClick={() => setEditingTarget(true)}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Edit
                </button>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Remaining: {module.remainingLessons}
            </p>
          </div>
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-slate-200/80">
            <p className="text-xs font-semibold uppercase text-slate-400">Health</p>
            <div className="mt-2">
              <HealthBadge health={module.health} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {module.needsReviewCount} need review · {module.untestedCount} untested
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={(e) => filters.setSearch(e.target.value)}
            placeholder="Search question or intent…"
            className={cn(saInput, "w-full pl-9")}
          />
        </div>
        <select
          value={filters.filterPriority}
          onChange={(e) => filters.setFilterPriority(e.target.value)}
          className={saInput}
        >
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={filters.filterStatus}
          onChange={(e) => filters.setFilterStatus(e.target.value)}
          className={saInput}
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="needs_review">Needs Review</option>
        </select>
        <select
          value={filters.filterHealth}
          onChange={(e) => filters.setFilterHealth(e.target.value)}
          className={saInput}
        >
          <option value="">All health</option>
          <option value="healthy">Healthy</option>
          <option value="needs_review">Needs review</option>
        </select>
        <input
          value={filters.filterIntent}
          onChange={(e) => filters.setFilterIntent(e.target.value)}
          placeholder="Intent filter"
          className={saInput}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.filterNeedsReview}
            onChange={(e) => filters.setFilterNeedsReview(e.target.checked)}
          />
          Needs review
        </label>
      </div>

      <ModuleLessonTable
        title="Lessons"
        lessons={filteredLessons}
        modules={[module]}
        onOpenEntry={onOpenEntry}
        showChecklist
      />
    </div>
  );
}

export function ModuleLessonTable({
  title,
  lessons,
  modules,
  onOpenEntry,
  showChecklist = false,
}: {
  title: string;
  lessons: CurriculumLesson[];
  modules: CurriculumModuleRow[];
  onOpenEntry: (id: string) => void;
  showChecklist?: boolean;
}) {
  const moduleName = (id: string) =>
    modules.find((m) => m.id === id)?.name ?? id;

  return (
    <div className={cn(saSection, "overflow-x-auto p-0")}>
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className={saSectionTitle}>{title}</h3>
        <p className={saSectionSubtitle}>{lessons.length} lesson(s)</p>
      </div>
      {lessons.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No lessons match your filters.
        </p>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className={saTableHeadRow}>
              <th className={saTableHeadCell}>#</th>
              <th className={saTableHeadCell}>Question</th>
              {!showChecklist ? <th className={saTableHeadCell}>Module</th> : null}
              <th className={saTableHeadCell}>Intent</th>
              <th className={saTableHeadCell}>Priority</th>
              <th className={saTableHeadCell}>Status</th>
              <th className={saTableHeadCell}>Health</th>
              <th className={saTableHeadCell}>Updated</th>
              {showChecklist ? <th className={saTableHeadCell}>Checklist</th> : null}
              <th className={saTableHeadCell} />
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson) => (
              <tr key={lesson.entryId} className={saTableRowHover}>
                <td className="px-4 py-3 tabular-nums text-slate-500">
                  {lesson.lessonNumber}
                </td>
                <td className="max-w-xs px-4 py-3 font-medium text-slate-900">
                  {lesson.question}
                </td>
                {!showChecklist ? (
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {moduleName(lesson.moduleId)}
                  </td>
                ) : null}
                <td className="px-4 py-3 font-mono text-xs text-violet-700">
                  {lesson.intentKey ?? "—"}
                </td>
                <td className="px-4 py-3 capitalize">{lesson.priority}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      LESSON_STATUS_STYLES[lesson.status]
                    )}
                  >
                    {lesson.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 capitalize">{lesson.health}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {formatDateTime(lesson.updatedAt)}
                </td>
                {showChecklist ? (
                  <td className="px-4 py-3">
                    <ChecklistPopover lesson={lesson} />
                  </td>
                ) : null}
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className={saBtnSecondarySm}
                    onClick={() => onOpenEntry(lesson.entryId)}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ChecklistPopover({ lesson }: { lesson: CurriculumLesson }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className={saBtnSecondarySm}
        onClick={() => setOpen((v) => !v)}
      >
        {lesson.checklistScore}%
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <ul className="space-y-1 text-xs">
            {lesson.checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full",
                    item.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                  )}
                >
                  {item.done ? <Check className="h-2.5 w-2.5" /> : null}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ProgressBar({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs font-semibold tabular-nums text-slate-600">{percent}%</p>
    </div>
  );
}

function HealthBadge({ health }: { health: ModuleHealthLabel }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset",
        HEALTH_STYLES[health]
      )}
    >
      {health.replace("_", " ")}
    </span>
  );
}
