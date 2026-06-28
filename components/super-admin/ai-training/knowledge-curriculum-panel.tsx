"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookMarked,
  Check,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Target,
} from "lucide-react";
import {
  SaKpiCard,
  saKpiCard,
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
import { downloadCurriculumExport } from "@/lib/ai-training/knowledge-curriculum-export";
import type {
  CurriculumDashboardData,
  CurriculumLesson,
  CurriculumModuleId,
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

interface KnowledgeCurriculumPanelProps {
  onOpenEntry: (entryId: string) => void;
  onAddLesson: (moduleId: CurriculumModuleId, category: string) => void;
}

export function KnowledgeCurriculumPanel({
  onOpenEntry,
  onAddLesson,
}: KnowledgeCurriculumPanelProps) {
  const [data, setData] = useState<CurriculumDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedModuleId, setSelectedModuleId] = useState<CurriculumModuleId | null>(
    null
  );
  const [editingTarget, setEditingTarget] = useState(false);
  const [globalTargetInput, setGlobalTargetInput] = useState("2500");
  const [savingTarget, setSavingTarget] = useState(false);

  const [filterModule, setFilterModule] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterHealth, setFilterHealth] = useState("");
  const [filterIntent, setFilterIntent] = useState("");
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);
  const [filterMissing, setFilterMissing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/ai-training/curriculum");
      if (!res.ok) return;
      const json = (await res.json()) as CurriculumDashboardData;
      setData(json);
      setGlobalTargetInput(String(json.summary.knowledgeTarget));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedModule = useMemo(
    () => data?.modules.find((m) => m.id === selectedModuleId) ?? null,
    [data, selectedModuleId]
  );

  const filteredLessons = useMemo(() => {
    if (!data) return [];
    let lessons = selectedModule
      ? selectedModule.lessons
      : data.modules.flatMap((m) => m.lessons);

    if (filterModule) {
      lessons = lessons.filter((l) => l.moduleId === filterModule);
    }
    if (filterPriority) {
      lessons = lessons.filter((l) => l.priority === filterPriority);
    }
    if (filterStatus) {
      lessons = lessons.filter((l) => l.status === filterStatus);
    }
    if (filterHealth) {
      lessons = lessons.filter((l) => l.health === filterHealth);
    }
    if (filterIntent.trim()) {
      const q = filterIntent.toLowerCase();
      lessons = lessons.filter(
        (l) =>
          l.intentKey?.toLowerCase().includes(q) ||
          l.intentName?.toLowerCase().includes(q)
      );
    }
    if (filterNeedsReview) {
      lessons = lessons.filter((l) => l.status === "needs_review");
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      lessons = lessons.filter(
        (l) =>
          l.question.toLowerCase().includes(q) ||
          l.intentKey?.toLowerCase().includes(q) ||
          l.intentName?.toLowerCase().includes(q)
      );
    }
    if (filterMissing && selectedModule) {
      return lessons;
    }
    return lessons;
  }, [
    data,
    selectedModule,
    filterModule,
    filterPriority,
    filterStatus,
    filterHealth,
    filterIntent,
    filterNeedsReview,
    filterMissing,
    search,
  ]);

  const saveGlobalTarget = async () => {
    const value = Number(globalTargetInput);
    if (!Number.isFinite(value) || value < 1) return;
    setSavingTarget(true);
    try {
      const res = await fetch("/api/super-admin/ai-training/curriculum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeTarget: value }),
      });
      if (res.ok) void load();
    } finally {
      setSavingTarget(false);
      setEditingTarget(false);
    }
  };

  const saveModuleTarget = async (moduleId: string, target: number) => {
    setSavingTarget(true);
    try {
      const res = await fetch(
        `/api/super-admin/ai-training/curriculum/modules/${moduleId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetLessons: target }),
        }
      );
      if (res.ok) void load();
    } finally {
      setSavingTarget(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="mt-8 flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading curriculum…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-500">
        Could not load curriculum data.
      </div>
    );
  }

  if (selectedModule) {
    return (
      <ModuleDetailView
        module={selectedModule}
        savingTarget={savingTarget}
        filteredLessons={filteredLessons}
        filters={{
          filterPriority,
          setFilterPriority,
          filterStatus,
          setFilterStatus,
          filterHealth,
          setFilterHealth,
          filterIntent,
          setFilterIntent,
          filterNeedsReview,
          setFilterNeedsReview,
          search,
          setSearch,
        }}
        onBack={() => setSelectedModuleId(null)}
        onOpenEntry={onOpenEntry}
        onAddLesson={() => onAddLesson(selectedModule.id, selectedModule.defaultCategory)}
        onSaveModuleTarget={(target) => void saveModuleTarget(selectedModule.id, target)}
        onExport={() => downloadCurriculumExport(data, "csv")}
      />
    );
  }

  const s = data.summary;

  return (
    <div className="mt-8 space-y-6">
      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SaKpiCard label="Total Knowledge Entries" value={String(s.totalEntries)} />
        <SaKpiCard label="Total Modules" value={String(s.totalModules)} />
        <SaKpiCard label="Completed Modules" value={String(s.completedModules)} />
        <SaKpiCard label="Lessons Completed" value={String(s.lessonsCompleted)} />
        <SaKpiCard label="Lessons Remaining" value={String(s.lessonsRemaining)} />
        <SaKpiCard
          label="Overall Completion"
          value={`${s.overallCompletionPercent}%`}
        />
        <SaKpiCard
          label="Last Updated"
          value={s.lastUpdated ? formatDateTime(s.lastUpdated) : "—"}
          className="[&_p:last-child]:text-lg"
        />
        <div className={saKpiCard}>
          <p className="text-sm font-medium text-slate-500">Knowledge Target</p>
          {editingTarget ? (
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min={1}
                value={globalTargetInput}
                onChange={(e) => setGlobalTargetInput(e.target.value)}
                className={cn(saInput, "w-full")}
              />
              <button
                type="button"
                className={saBtnPrimarySm}
                disabled={savingTarget}
                onClick={() => void saveGlobalTarget()}
              >
                Save
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-end justify-between">
              <p className="text-3xl font-extrabold tabular-nums text-slate-950">
                {s.knowledgeTarget.toLocaleString()}
              </p>
              <button
                type="button"
                className={saBtnSecondarySm}
                onClick={() => setEditingTarget(true)}
              >
                <Target className="mr-1 h-3 w-3" />
                Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overall progress ring */}
      <div className={cn(saSection, "flex flex-col items-center gap-4 py-8 sm:flex-row sm:justify-center sm:gap-10")}>
        <ProgressRing percent={s.overallCompletionPercent} size={160} />
        <div className="text-center sm:text-left">
          <h3 className={saSectionTitle}>Overall Knowledge Progress</h3>
          <p className="mt-2 text-3xl font-bold tabular-nums text-indigo-600">
            {s.overallCompletionPercent}%
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {s.lessonsCompleted.toLocaleString()} / {s.knowledgeTarget.toLocaleString()} lessons
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            Adakaro AI has mastered {s.overallCompletionPercent}% of its planned curriculum.
          </p>
        </div>
      </div>

      {/* Coverage insights */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CoverageCard title="Strong Areas" items={data.coverage.strongAreas} tone="emerald" />
        <CoverageCard title="Weak Areas" items={data.coverage.weakAreas} tone="amber" />
        <CoverageCard title="Empty Modules" items={data.coverage.emptyModules} tone="slate" />
        <div className={saSection}>
          <h3 className={saSectionTitle}>Knowledge Coverage</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {data.coverage.largestModule ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">Largest module</dt>
                <dd className="font-medium">
                  {data.coverage.largestModule.name} ({data.coverage.largestModule.count})
                </dd>
              </div>
            ) : null}
            {data.coverage.smallestModule ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">Smallest module</dt>
                <dd className="font-medium">
                  {data.coverage.smallestModule.name} ({data.coverage.smallestModule.count})
                </dd>
              </div>
            ) : null}
            {data.coverage.mostImprovedModule ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">Most improved (30d)</dt>
                <dd className="font-medium">
                  {data.coverage.mostImprovedModule.name} (+{data.coverage.mostImprovedModule.recentCount})
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lessons…"
            className={cn(saInput, "w-full pl-9")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className={saInput}
            aria-label="Filter by module"
          >
            <option value="">All modules</option>
            {data.modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={saInput}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="needs_review">Needs Review</option>
            <option value="archived">Archived</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={filterNeedsReview}
              onChange={(e) => setFilterNeedsReview(e.target.checked)}
            />
            Needs review
          </label>
          <button
            type="button"
            className={saBtnSecondary}
            onClick={() => downloadCurriculumExport(data, "csv")}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            className={saBtnSecondary}
            onClick={() => downloadCurriculumExport(data, "markdown")}
          >
            MD
          </button>
          <button
            type="button"
            className={saBtnSecondary}
            onClick={() => downloadCurriculumExport(data, "pdf")}
          >
            PDF
          </button>
          <button type="button" className={saBtnSecondary} onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      {/* Module table */}
      <div className={cn(saSection, "overflow-x-auto p-0")}>
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className={saSectionTitle}>Module Curriculum</h3>
          <p className={saSectionSubtitle}>
            Each module is a subject — each knowledge entry is a lesson.
          </p>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className={saTableHeadRow}>
              <th className={saTableHeadCell}>Module</th>
              <th className={saTableHeadCell}>Target</th>
              <th className={saTableHeadCell}>Done</th>
              <th className={saTableHeadCell}>Left</th>
              <th className={saTableHeadCell}>Progress</th>
              <th className={saTableHeadCell}>Health</th>
              <th className={saTableHeadCell}>Status</th>
              <th className={saTableHeadCell} />
            </tr>
          </thead>
          <tbody>
            {data.modules.map((mod) => (
              <tr key={mod.id} className={saTableRowHover}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{mod.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                    {mod.description}
                  </p>
                </td>
                <td className="px-4 py-3 tabular-nums">{mod.targetLessons}</td>
                <td className="px-4 py-3 tabular-nums text-emerald-700">
                  {mod.completedLessons}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-500">
                  {mod.remainingLessons}
                </td>
                <td className="px-4 py-3 min-w-[140px]">
                  <ProgressBar percent={mod.completionPercent} />
                </td>
                <td className="px-4 py-3">
                  <HealthBadge health={mod.health} />
                </td>
                <td className="px-4 py-3 capitalize text-slate-600">
                  {mod.status.replace("_", " ")}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className={saBtnSecondarySm}
                    onClick={() => setSelectedModuleId(mod.id)}
                  >
                    Open
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* All lessons preview when searching */}
      {search || filterModule || filterStatus ? (
        <LessonTable
          title="Matching Lessons"
          lessons={filteredLessons}
          modules={data.modules}
          onOpenEntry={onOpenEntry}
        />
      ) : null}
    </div>
  );
}

function ModuleDetailView({
  module,
  savingTarget,
  filteredLessons,
  filters,
  onBack,
  onOpenEntry,
  onAddLesson,
  onSaveModuleTarget,
  onExport,
}: {
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
  onSaveModuleTarget: (target: number) => void;
  onExport: () => void;
}) {
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
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={saBtnPrimary} onClick={onAddLesson}>
              <Plus className="mr-2 h-4 w-4" />
              Add Lesson
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

      <LessonTable
        title="Lessons"
        lessons={filteredLessons}
        modules={[module]}
        onOpenEntry={onOpenEntry}
        showChecklist
      />
    </div>
  );
}

function LessonTable({
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

function ProgressRing({ percent, size }: { percent: number; size: number }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#curriculumGradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700"
      />
      <defs>
        <linearGradient id="curriculumGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="rotate-90 fill-slate-900 text-2xl font-bold"
        style={{ transformOrigin: "center" }}
      >
        {percent}%
      </text>
    </svg>
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

function CoverageCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "amber" | "slate";
}) {
  const styles = {
    emerald: "border-emerald-200 bg-emerald-50/50",
    amber: "border-amber-200 bg-amber-50/50",
    slate: "border-slate-200 bg-slate-50/50",
  };
  return (
    <div className={cn(saSection, styles[tone])}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <BookMarked className="h-4 w-4" />
        {title}
      </h3>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">None identified yet.</p>
      )}
    </div>
  );
}
