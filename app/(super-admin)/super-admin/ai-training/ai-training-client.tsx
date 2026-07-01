"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Activity,
  Archive,
  BookMarked,
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardList,
  FileUp,
  GitBranch,
  GitMerge,
  GraduationCap,
  HeartPulse,
  HelpCircle,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import {
  SaKpiCard,
  SaKpiCardHighlighted,
  saBtnDangerOutline,
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
import { BulkImportModal } from "@/components/super-admin/ai-training/bulk-import-modal";
import { KnowledgeDuplicatePanel } from "@/components/super-admin/ai-training/knowledge-duplicate-panel";
import type { DuplicateCheckApiResult } from "@/components/super-admin/ai-training/knowledge-duplicate-panel";
import { KnowledgeDuplicateSaveModal } from "@/components/super-admin/ai-training/knowledge-duplicate-save-modal";
import { KnowledgeNearDuplicateModal } from "@/components/super-admin/ai-training/knowledge-near-duplicate-modal";
import { KnowledgeHealthBadge } from "@/components/super-admin/ai-training/knowledge-health-badge";
import { KnowledgeMergeModal } from "@/components/super-admin/ai-training/knowledge-merge-modal";
import { KnowledgeVersionPanel } from "@/components/super-admin/ai-training/knowledge-version-panel";
import {
  KnowledgeWritingChecklist,
  KnowledgePostSaveRecommendations,
  buildRecommendedAnswerTemplate,
} from "@/components/super-admin/ai-training/knowledge-writing-guide";
import {
  autoFixProfessionalLanguage,
  autoFixTimelessWording,
} from "@/lib/ai-training/knowledge-writing-standard";
import { KnowledgeAnswerAssistant } from "@/components/super-admin/ai-training/knowledge-answer-assistant";
import { AIKnowledgeAuthorButton } from "@/components/ai-training/AIKnowledgeAuthorButton";
import { AuthorDocumentationEditor } from "@/components/ai-training/AuthorDocumentationEditor";
import type {
  HighlightedTextareaHandle,
  TextHighlight,
} from "@/components/ai-training/AuthorDocumentationEditor";
import type { MetadataField } from "@/lib/ai-training/knowledge-metadata-generator";
import {
  collectValidationIssues,
  filterActiveIssues,
} from "@/lib/ai-training/collect-validation-issues";
import {
  getEditorStepId,
  replaceSentenceAtLocation,
  type ValidationIssue,
} from "@/lib/ai-training/knowledge-validation-locations";
import { normalizeKnowledgeEntry } from "@/lib/ai-training/normalize-knowledge-entry";
import {
  buildCurriculumPlannerContext,
  getLessonPrerequisites,
} from "@/lib/ai-training/knowledge-curriculum-planner";
import {
  AuthoringWorkflowRail,
  AuthoringWorkflowSection,
} from "@/components/super-admin/ai-training/knowledge-authoring-workflow";
import { computeAuthoringWorkflowSteps } from "@/lib/ai-training/knowledge-authoring-workflow";
import {
  assessEnterpriseReadiness,
  buildPostSaveRecommendations,
  type PostSaveRecommendation,
} from "@/lib/ai-training/knowledge-authoring";
import { KnowledgePagination, KNOWLEDGE_DEFAULT_PAGE_SIZE } from "@/components/super-admin/ai-training/knowledge-pagination";
import { AIClassificationPanel } from "@/components/super-admin/ai-training/ai-classification-panel";
import { BulkIntentRecalculateModal } from "@/components/super-admin/ai-training/bulk-intent-recalculate-modal";
import { IntentHealthBanner } from "@/components/super-admin/ai-training/intent-health-banner";
import { IntentCoveragePanel } from "@/components/super-admin/ai-training/intent-coverage-panel";
import { LearningPanel } from "@/components/super-admin/ai-training/learning-panel";
import {
  AIHealthScoreCard,
  formatDateTime,
  HorizontalBarChart,
  KpiSkeleton,
  QualityBadge,
  TableSkeleton,
  TrendChart,
} from "@/components/super-admin/ai-training/shared";
import { KnowledgeCurriculumPanel } from "@/components/super-admin/ai-training/knowledge-curriculum-panel";
import { KnowledgeApprovalQueue } from "@/components/super-admin/ai-training/knowledge-approval-queue";
import { KnowledgeQualityPanel } from "@/components/super-admin/ai-training/knowledge-quality-panel";
import { KnowledgeOperationsOverview } from "@/components/super-admin/ai-training/knowledge-operations-overview";
import { KnowledgeHealthPanel } from "@/components/super-admin/ai-training/knowledge-health-panel";
import { KnowledgeMissionsPanel } from "@/components/super-admin/ai-training/knowledge-missions-panel";
import { KnowledgeGraphPanel } from "@/components/super-admin/ai-training/knowledge-graph-panel";
import { KnowledgeSignalsPanel } from "@/components/super-admin/ai-training/knowledge-signals-panel";
import { KnowledgeMemoryPanel } from "@/components/super-admin/ai-training/knowledge-memory-panel";
import { KnowledgeIntelligenceScorecardPanel } from "@/components/super-admin/ai-training/knowledge-intelligence-scorecard";
import { TestAIDrawer } from "@/components/super-admin/ai-training/test-ai-drawer";
import type { CurriculumModuleId } from "@/lib/ai-training/knowledge-curriculum";
import {
  missionToGenerationMode,
  resolveMissionModuleId,
} from "@/lib/ai-training/knowledge-missions";
import type { GenerationMode } from "@/lib/ai-training/lesson-generation-prompt";
import type { KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";
import { enrichEntryMetrics } from "@/lib/ai-training/load-analytics";
import type { RecommendationApplyAction } from "@/lib/ai-training/test-observability-console";
import type {
  AIActivityItem,
  AIKnowledgeEntry,
  AITrainingAnalytics,
  AIUnansweredQuestion,
  BulkRecalculatePreview,
  BulkRecalculateResult,
  DuplicateSaveAction,
  IntentHealthSummary,
  KnowledgePriority,
} from "@/lib/ai-training/types";
import { STARTER_QUESTIONS } from "@/lib/ai-training/types";
import {
  getLastKnowledgeCategory,
  migrateKnowledgeCategory,
  rememberLastKnowledgeCategory,
} from "@/lib/ai-training/knowledge-categories";
import { KnowledgeCategorySelect } from "@/components/super-admin/ai-training/knowledge-category-select";
import { KnowledgeMetadataFields, keywordsToText, textToKeywords } from "@/components/super-admin/ai-training/knowledge-metadata-fields";
import { cn } from "@/lib/utils";

type TabId =
  | "overview"
  | "health"
  | "missions"
  | "graph"
  | "knowledge"
  | "curriculum"
  | "approval"
  | "unanswered"
  | "signals"
  | "analytics"
  | "learning"
  | "memory"
  | "intelligence";

const TABS: { id: TabId; label: string; icon: typeof Brain }[] = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "health", label: "Knowledge Health", icon: HeartPulse },
  { id: "missions", label: "Missions", icon: Rocket },
  { id: "graph", label: "Knowledge Graph", icon: GitBranch },
  { id: "curriculum", label: "Curriculum", icon: BookMarked },
  { id: "approval", label: "Review Queue", icon: ClipboardList },
  { id: "knowledge", label: "Published Knowledge", icon: BookOpen },
  { id: "signals", label: "Learning Signals", icon: Activity },
  { id: "unanswered", label: "Unanswered", icon: HelpCircle },
  { id: "learning", label: "AI Learning", icon: GraduationCap },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "memory", label: "AI Memory", icon: Brain },
  { id: "intelligence", label: "System Intelligence", icon: Target },
];

const PRIORITY_OPTIONS: KnowledgePriority[] = [
  "low",
  "normal",
  "high",
  "critical",
];

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.slice(0, 4).map((item) => (
        <span
          key={item}
          className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-100"
        >
          {item}
        </span>
      ))}
      {items.length > 4 ? (
        <span className="text-[11px] text-slate-400">+{items.length - 4}</span>
      ) : null}
    </div>
  );
}

const ACTIVITY_LABELS: Record<AIActivityItem["type"], string> = {
  unanswered: "New unanswered question",
  created: "New knowledge entry",
  edited: "Edited entry",
  archived: "Archived entry",
};

function formatSource(source: string): string {
  return source.replace(/_/g, " ");
}

interface EntryFormState {
  id?: string;
  category: string;
  curriculumModule?: string;
  question: string;
  keywords: string;
  search_phrases: string;
  alternative_wording: string;
  synonyms: string;
  related_terms: string;
  answer: string;
  priority: KnowledgePriority;
  unansweredId?: string;
}

const emptyForm = (): EntryFormState => ({
  category: "General",
  question: "",
  keywords: "",
  search_phrases: "",
  alternative_wording: "",
  synonyms: "",
  related_terms: "",
  answer: "",
  priority: "normal",
});

type EntryClassification = Pick<
  AIKnowledgeEntry,
  | "intent_key"
  | "intent_name"
  | "intent_group"
  | "related_intents"
  | "intent_confidence"
  | "intent_recalculated_at"
>;

function classificationFromEntry(row: AIKnowledgeEntry): EntryClassification {
  return {
    intent_key: row.intent_key ?? null,
    intent_name: row.intent_name ?? null,
    intent_group: row.intent_group ?? null,
    related_intents: row.related_intents ?? [],
    intent_confidence: row.intent_confidence ?? null,
    intent_recalculated_at: row.intent_recalculated_at ?? null,
  };
}

function formatIntentConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

export function AITrainingClient({
  initialAnalytics,
}: {
  initialAnalytics: AITrainingAnalytics;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [approvalQueueModule, setApprovalQueueModule] = useState<string | null>(null);
  const [pendingMission, setPendingMission] = useState<{
    moduleId: CurriculumModuleId;
    mode: GenerationMode;
  } | null>(null);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [knowledgeRows, setKnowledgeRows] = useState<AIKnowledgeEntry[]>([]);
  const [unansweredRows, setUnansweredRows] = useState<AIUnansweredQuestion[]>([]);
  const [knowledgeTotal, setKnowledgeTotal] = useState(0);
  const [unansweredTotal, setUnansweredTotal] = useState(0);
  const [knowledgePage, setKnowledgePage] = useState(1);
  const [knowledgePageSize, setKnowledgePageSize] = useState(KNOWLEDGE_DEFAULT_PAGE_SIZE);
  const [knowledgeCategory, setKnowledgeCategory] = useState("");
  const [unansweredPage, setUnansweredPage] = useState(1);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [unansweredSearch, setUnansweredSearch] = useState("");
  const [knowledgeStatus, setKnowledgeStatus] = useState("active");
  const [unansweredStatus, setUnansweredStatus] = useState("pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [loadingUnanswered, setLoadingUnanswered] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<EntryFormState>(emptyForm());
  const [metadataBaseline, setMetadataBaseline] = useState<{
    question: string;
    answer: string;
  } | null>(null);
  const [metadataGeneratedNotice, setMetadataGeneratedNotice] = useState(false);
  const [fixingAllQuality, setFixingAllQuality] = useState(false);
  const [ignoredIssueIds, setIgnoredIssueIds] = useState<Set<string>>(new Set());
  const [activeIssueIndex, setActiveIssueIndex] = useState(0);
  const [activeHighlightRange, setActiveHighlightRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [activeMetadataHighlight, setActiveMetadataHighlight] = useState<{
    field: MetadataField;
    start: number;
    end: number;
  } | null>(null);
  const answerEditorRef = useRef<HighlightedTextareaHandle>(null);
  const questionEditorRef = useRef<HTMLTextAreaElement>(null);
  const metadataEditorRefs = useRef<Partial<Record<MetadataField, HighlightedTextareaHandle | null>>>({});
  const [postSaveRecommendations, setPostSaveRecommendations] = useState<
    PostSaveRecommendation[] | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [testDrawerOpen, setTestDrawerOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [activity, setActivity] = useState<AIActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [classificationEntry, setClassificationEntry] =
    useState<EntryClassification | null>(null);
  const [recalculatingIntent, setRecalculatingIntent] = useState(false);
  const [intentHealth, setIntentHealth] = useState<IntentHealthSummary | null>(
    null
  );
  const [bulkIntentOpen, setBulkIntentOpen] = useState(false);
  const [bulkIntentStep, setBulkIntentStep] = useState<
    "preview" | "applying" | "summary"
  >("preview");
  const [bulkIntentPreview, setBulkIntentPreview] =
    useState<BulkRecalculatePreview | null>(null);
  const [bulkIntentResult, setBulkIntentResult] =
    useState<BulkRecalculateResult | null>(null);
  const [bulkIntentLoading, setBulkIntentLoading] = useState(false);
  const [showIntentColumns, setShowIntentColumns] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckApiResult | null>(
    null
  );
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [nearDuplicateModalOpen, setNearDuplicateModalOpen] = useState(false);
  const [nearDuplicateAcknowledged, setNearDuplicateAcknowledged] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState("");
  const [merging, setMerging] = useState(false);
  const [editMeta, setEditMeta] = useState<{
    version_number: number;
    updated_at: string;
    created_at: string;
  } | null>(null);
  const [intelligenceSnapshot, setIntelligenceSnapshot] =
    useState<KnowledgeIntelligenceSnapshot | null>(null);

  const loadIntelligenceSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/ai-training/intelligence");
      if (!res.ok) return;
      const data = (await res.json()) as { snapshot?: KnowledgeIntelligenceSnapshot };
      setIntelligenceSnapshot(data.snapshot ?? null);
    } catch {
      /* non-blocking */
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const refreshAnalytics = useCallback(async () => {
    const res = await fetch("/api/super-admin/ai-training/analytics");
    if (res.ok) {
      setAnalytics((await res.json()) as AITrainingAnalytics);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setLoadingActivity(true);
    try {
      const res = await fetch("/api/super-admin/ai-training/activity");
      if (res.ok) {
        const data = (await res.json()) as { activity: AIActivityItem[] };
        setActivity(data.activity);
      }
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  const loadIntentHealth = useCallback(async () => {
    const res = await fetch("/api/super-admin/ai-training/knowledge/intent-health");
    if (res.ok) {
      setIntentHealth((await res.json()) as IntentHealthSummary);
    }
  }, []);

  useEffect(() => {
    void loadIntentHealth();
    void loadIntelligenceSnapshot();
  }, [loadIntentHealth, loadIntelligenceSnapshot]);

  const refreshOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      await Promise.all([refreshAnalytics(), loadActivity(), loadIntelligenceSnapshot()]);
    } finally {
      setLoadingOverview(false);
    }
  }, [refreshAnalytics, loadActivity, loadIntelligenceSnapshot]);

  const loadKnowledge = useCallback(async () => {
    setLoadingKnowledge(true);
    try {
      const params = new URLSearchParams({
        page: String(knowledgePage),
        pageSize: String(knowledgePageSize),
        status: knowledgeStatus,
      });
      if (knowledgeSearch) params.set("search", knowledgeSearch);
      if (knowledgeCategory) params.set("category", knowledgeCategory);
      const res = await fetch(
        `/api/super-admin/ai-training/knowledge?${params}`
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        showToast(err.error ?? "Could not load knowledge entries.");
        setKnowledgeRows([]);
        setKnowledgeTotal(0);
        return;
      }
      const data = (await res.json()) as {
        rows: AIKnowledgeEntry[];
        total: number;
      };
      setKnowledgeRows(
        data.rows.map((row) =>
          normalizeKnowledgeEntry(row as unknown as Record<string, unknown>)
        )
      );
      setKnowledgeTotal(data.total);
    } finally {
      setLoadingKnowledge(false);
    }
  }, [knowledgePage, knowledgePageSize, knowledgeSearch, knowledgeStatus, knowledgeCategory]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [knowledgePage, knowledgePageSize, knowledgeSearch, knowledgeStatus, knowledgeCategory]);

  const loadUnanswered = useCallback(async () => {
    setLoadingUnanswered(true);
    try {
      const params = new URLSearchParams({
        page: String(unansweredPage),
        pageSize: "20",
        status: unansweredStatus,
      });
      if (unansweredSearch) params.set("search", unansweredSearch);
      const res = await fetch(
        `/api/super-admin/ai-training/unanswered?${params}`
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        showToast(err.error ?? "Could not load unanswered questions.");
        setUnansweredRows([]);
        setUnansweredTotal(0);
        return;
      }
      const data = (await res.json()) as {
        rows: AIUnansweredQuestion[];
        total: number;
      };
      setUnansweredRows(data.rows);
      setUnansweredTotal(data.total);
    } finally {
      setLoadingUnanswered(false);
    }
  }, [unansweredPage, unansweredSearch, unansweredStatus]);

  useEffect(() => {
    if (tab === "knowledge") void loadKnowledge();
  }, [tab, loadKnowledge]);

  useEffect(() => {
    if (tab === "unanswered") void loadUnanswered();
  }, [tab, loadUnanswered]);

  useEffect(() => {
    if (tab === "overview") void loadActivity();
  }, [tab, loadActivity]);

  const openCreateForm = (prefill?: Partial<EntryFormState>) => {
    setClassificationEntry(null);
    setEditMeta(null);
    setDuplicateCheck(null);
    setMetadataBaseline(null);
    setMetadataGeneratedNotice(false);
    setIgnoredIssueIds(new Set());
    setActiveIssueIndex(0);
    setActiveHighlightRange(null);
    setActiveMetadataHighlight(null);
    setForm({
      ...emptyForm(),
      category: prefill?.category ?? getLastKnowledgeCategory(),
      ...prefill,
    });
    setFormOpen(true);
  };

  const unansweredPages = Math.max(1, Math.ceil(unansweredTotal / 20));

  const openCreateLesson = (moduleId: CurriculumModuleId, category: string, question?: string) => {
    openCreateForm({ category, curriculumModule: moduleId, question });
    setTab("knowledge");
  };

  const populateFormFromEntry = useCallback((row: AIKnowledgeEntry) => {
    const entry = normalizeKnowledgeEntry(row as unknown as Record<string, unknown>);
    setClassificationEntry(classificationFromEntry(entry));
    setEditMeta({
      version_number: entry.version_number ?? 1,
      updated_at: entry.updated_at,
      created_at: entry.created_at,
    });
    setDuplicateCheck(null);
    setIgnoredIssueIds(new Set());
    setActiveIssueIndex(0);
    setActiveHighlightRange(null);
    setActiveMetadataHighlight(null);
    setMetadataBaseline({ question: entry.question, answer: entry.answer });
    setMetadataGeneratedNotice(true);
    setForm({
      id: entry.id,
      category: entry.category,
      question: entry.question,
      keywords: keywordsToText(entry.keywords),
      search_phrases: keywordsToText(entry.search_phrases),
      alternative_wording: keywordsToText(entry.alternative_wording),
      synonyms: keywordsToText(entry.synonyms ?? []),
      related_terms: keywordsToText(entry.related_terms),
      answer: entry.answer,
      priority: entry.priority,
    });
    setFormOpen(true);
  }, []);

  const openEditForm = (row: AIKnowledgeEntry) => {
    populateFormFromEntry(row);
  };

  const openEntryById = async (entryId: string) => {
    const res = await fetch(`/api/super-admin/ai-training/knowledge/${entryId}`);
    if (!res.ok) {
      showToast("Could not load that entry.");
      return;
    }
    const data = (await res.json()) as { row: AIKnowledgeEntry };
    populateFormFromEntry(data.row);
  };

  const applyTestSuggestion = async (
    action: RecommendationApplyAction,
    value: string | undefined,
    entryId?: string
  ) => {
    if (action === "create_entry") {
      openCreateForm({ question: value ?? "" });
      setTab("knowledge");
      setTestDrawerOpen(false);
      return;
    }

    if (action === "recalculate_intent" && entryId) {
      const res = await fetch(
        `/api/super-admin/ai-training/knowledge/${entryId}/recalculate-intent`,
        { method: "POST" }
      );
      showToast(
        res.ok ? "Intent recalculation queued." : "Intent recalculation failed."
      );
      if (res.ok) void loadKnowledge();
      return;
    }

    if (!entryId) return;

    let row = knowledgeRows.find((r) => r.id === entryId);
    if (!row) {
      const res = await fetch(`/api/super-admin/ai-training/knowledge/${entryId}`);
      if (!res.ok) {
        showToast("Could not load entry.");
        return;
      }
      row = (await res.json() as { row: AIKnowledgeEntry }).row;
    }

    const trimmed = value?.trim();
    const next: AIKnowledgeEntry = { ...row, synonyms: row.synonyms ?? [] };

    if (action === "append_search_phrase" && trimmed) {
      next.search_phrases = [...new Set([...next.search_phrases, trimmed])];
    } else if (action === "append_keyword" && trimmed) {
      next.keywords = [...new Set([...next.keywords, trimmed])];
    } else if (action === "append_synonym" && trimmed) {
      next.synonyms = [...new Set([...(next.synonyms ?? []), trimmed])];
    } else if (action === "append_alternative_wording" && trimmed) {
      next.alternative_wording = [
        ...new Set([...next.alternative_wording, trimmed]),
      ];
    } else if (action === "append_related_term" && trimmed) {
      next.related_terms = [...new Set([...next.related_terms, trimmed])];
    }

    openEditForm(next);
    setTab("knowledge");
    setTestDrawerOpen(false);
    showToast("Entry opened with suggestion applied.");
  };

  const handleDuplicateCheck = useCallback((result: DuplicateCheckApiResult | null) => {
    setDuplicateCheck(result);
    setNearDuplicateAcknowledged(false);
  }, []);

  const writingDraft = useMemo(
    () => ({
      category: form.category,
      question: form.question,
      answer: form.answer,
      keywords: textToKeywords(form.keywords),
      search_phrases: textToKeywords(form.search_phrases),
      alternative_wording: textToKeywords(form.alternative_wording),
      synonyms: textToKeywords(form.synonyms),
      related_terms: textToKeywords(form.related_terms),
      priority: form.priority,
      intent_key: classificationEntry?.intent_key ?? null,
    }),
    [form, classificationEntry?.intent_key]
  );

  const enterpriseReadiness = useMemo(
    () =>
      assessEnterpriseReadiness({
        draft: writingDraft,
        duplicateCheck,
        metadataBaseline,
        editingEntryId: form.id ?? null,
        allEntries: knowledgeRows,
      }),
    [writingDraft, duplicateCheck, metadataBaseline, form.id, knowledgeRows]
  );

  const metadataFieldsText = useMemo(
    () => ({
      keywords: form.keywords,
      synonyms: form.synonyms,
      search_phrases: form.search_phrases,
      alternative_wording: form.alternative_wording,
      related_terms: form.related_terms,
    }),
    [form.keywords, form.synonyms, form.search_phrases, form.alternative_wording, form.related_terms]
  );

  const allValidationIssues = useMemo(
    () => collectValidationIssues(writingDraft, enterpriseReadiness, metadataFieldsText),
    [writingDraft, enterpriseReadiness, metadataFieldsText]
  );

  const validationIssues = useMemo(
    () => filterActiveIssues(allValidationIssues, ignoredIssueIds),
    [allValidationIssues, ignoredIssueIds]
  );

  useEffect(() => {
    if (activeIssueIndex >= validationIssues.length) {
      setActiveIssueIndex(Math.max(0, validationIssues.length - 1));
    }
  }, [validationIssues.length, activeIssueIndex]);

  const issueTone = (ruleId: string): TextHighlight["tone"] => {
    if (ruleId.includes("professional")) return "rose";
    if (ruleId.includes("timeless")) return "amber";
    if (ruleId.startsWith("metadata")) return "sky";
    return "violet";
  };

  const answerHighlights = useMemo((): TextHighlight[] => {
    return validationIssues
      .filter((issue) => issue.location.section === "Answer")
      .map((issue) => ({
        start: issue.location.charStart,
        end: issue.location.charEnd,
        issueId: issue.id,
        ruleLabel: issue.ruleLabel,
        reason: issue.reason,
        suggestion: issue.suggestion,
        tone: issueTone(issue.ruleId),
      }));
  }, [validationIssues]);

  const metadataFieldHighlights = useMemo(() => {
    const map: Partial<Record<MetadataField, TextHighlight[]>> = {};
    for (const issue of validationIssues) {
      if (issue.location.section !== "Metadata") continue;
      const field = issue.location.field as MetadataField;
      if (!map[field]) map[field] = [];
      map[field]!.push({
        start: issue.location.charStart,
        end: issue.location.charEnd,
        issueId: issue.id,
        ruleLabel: issue.ruleLabel,
        reason: issue.reason,
        suggestion: issue.suggestion,
        tone: issueTone(issue.ruleId),
      });
    }
    return map;
  }, [validationIssues]);

  const flashHighlight = useCallback((start: number, end: number) => {
    setActiveHighlightRange({ start, end });
    window.setTimeout(() => setActiveHighlightRange(null), 3000);
  }, []);

  const jumpToIssue = useCallback((issue: ValidationIssue) => {
    const stepId = getEditorStepId(issue);
    document.getElementById(`authoring-step-${stepId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    window.setTimeout(() => {
      if (issue.location.section === "Answer") {
        answerEditorRef.current?.scrollToRange(issue.location.charStart, issue.location.charEnd);
        answerEditorRef.current?.focusAt(issue.location.charStart, issue.location.charEnd);
        flashHighlight(issue.location.charStart, issue.location.charEnd);
      } else if (issue.location.section === "Question") {
        const textarea = questionEditorRef.current;
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(issue.location.charStart, issue.location.charEnd);
          flashHighlight(issue.location.charStart, issue.location.charEnd);
        }
      } else if (issue.location.section === "Metadata") {
        const field = issue.location.field as MetadataField;
        setActiveMetadataHighlight({
          field,
          start: issue.location.charStart,
          end: issue.location.charEnd,
        });
        const editor = metadataEditorRefs.current[field];
        editor?.scrollToRange(issue.location.charStart, issue.location.charEnd);
        editor?.focusAt(issue.location.charStart, issue.location.charEnd);
        window.setTimeout(() => setActiveMetadataHighlight(null), 3000);
      }
    }, 200);
  }, [flashHighlight]);

  const replaceIssue = useCallback(
    (issue: ValidationIssue) => {
      if (!issue.suggestion) return;

      if (issue.location.section === "Answer") {
        const nextAnswer = replaceSentenceAtLocation(
          form.answer,
          issue.location,
          issue.suggestion
        );
        setForm((f) => ({ ...f, answer: nextAnswer }));
        showToast("Sentence updated.");
        return;
      }

      if (issue.location.section === "Metadata") {
        const field = issue.location.field as MetadataField;
        const current = form[field];
        const lines = current.split("\n");
        const lineIndex = issue.location.paragraphIndex;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          lines[lineIndex] = issue.suggestion;
        } else {
          lines.push(issue.suggestion);
        }
        setForm((f) => ({ ...f, [field]: lines.join("\n") }));
        showToast("Metadata line updated.");
        return;
      }

      if (issue.location.section === "Question") {
        setForm((f) => ({ ...f, question: issue.suggestion }));
        showToast("Question updated.");
      }
    },
    [form.answer, form]
  );

  const ignoreIssue = useCallback((issue: ValidationIssue) => {
    setIgnoredIssueIds((prev) => new Set([...prev, issue.id]));
    showToast("Issue ignored for this session.");
  }, []);

  const handleHighlightAction = useCallback(
    (issueId: string, action: "accept" | "ignore") => {
      const issue = validationIssues.find((item) => item.id === issueId);
      if (!issue) return;
      if (action === "accept") replaceIssue(issue);
      else ignoreIssue(issue);
    },
    [validationIssues, replaceIssue, ignoreIssue]
  );

  const workflowSteps = useMemo(
    () =>
      computeAuthoringWorkflowSteps({
        question: form.question,
        answer: form.answer,
        category: form.category,
        keywordsText: form.keywords,
        synonymsText: form.synonyms,
        searchPhrasesText: form.search_phrases,
        alternativeWordingText: form.alternative_wording,
        relatedTermsText: form.related_terms,
        duplicateCheckLoading,
        duplicateCheckReady: Boolean(duplicateCheck) || (!duplicateCheckLoading && form.question.trim().length >= 3),
        hasRelatedInsights: Boolean(duplicateCheck),
        hasDependencyInsights: Boolean(duplicateCheck),
        hasPriorityInsight: Boolean(duplicateCheck),
        metadataBaseline,
        enterpriseReady: enterpriseReadiness.ready,
        enterpriseConfidence: enterpriseReadiness.confidenceScore,
      }),
    [
      form,
      duplicateCheck,
      duplicateCheckLoading,
      metadataBaseline,
      enterpriseReadiness.ready,
      enterpriseReadiness.confidenceScore,
    ]
  );

  const workflowStepStatus = (id: string) =>
    workflowSteps.find((s) => s.id === id)?.status ?? "pending";

  const draftAuthorContext = useMemo(() => {
    const plannerContext = buildCurriculumPlannerContext({ entries: knowledgeRows });
    const prerequisites = getLessonPrerequisites(
      form.question,
      plannerContext,
      form.id
    );
    const relatedQuestions =
      duplicateCheck?.prioritizedRelatedLessons?.map((l) => l.question) ??
      duplicateCheck?.suggestedRelatedLessons?.map((l) => l.question) ??
      [];

    return {
      prerequisiteQuestions: prerequisites.map((p) => p.question),
      dependencyQuestions: prerequisites.filter((p) => !p.completed).map((p) => p.question),
      relatedQuestions,
    };
  }, [form.question, form.id, knowledgeRows, duplicateCheck]);

  const handleAutoFixLanguage = () => {
    setForm((f) => ({
      ...f,
      answer: autoFixTimelessWording(autoFixProfessionalLanguage(f.answer)),
    }));
  };

  const handleFixAllQuality = async () => {
    if (!form.question.trim() || !form.answer.trim()) return;
    setFixingAllQuality(true);
    try {
      const res = await fetch("/api/super-admin/ai-training/knowledge/fix-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          question: form.question,
          answer: form.answer,
          keywords: textToKeywords(form.keywords),
          synonyms: textToKeywords(form.synonyms),
          search_phrases: textToKeywords(form.search_phrases),
          alternative_wording: textToKeywords(form.alternative_wording),
          related_terms: textToKeywords(form.related_terms),
        }),
      });
      if (!res.ok) throw new Error("Fix failed");
      const data = (await res.json()) as {
        answer: string;
        metadata: {
          keywords: string[];
          synonyms: string[];
          search_phrases: string[];
          alternative_wording: string[];
          related_terms: string[];
        };
      };
      setForm((f) => ({
        ...f,
        answer: data.answer,
        keywords: keywordsToText(data.metadata.keywords),
        synonyms: keywordsToText(data.metadata.synonyms),
        search_phrases: keywordsToText(data.metadata.search_phrases),
        alternative_wording: keywordsToText(data.metadata.alternative_wording),
        related_terms: keywordsToText(data.metadata.related_terms),
      }));
      setMetadataBaseline({ question: form.question.trim(), answer: data.answer.trim() });
      setMetadataGeneratedNotice(true);
      showToast("Quality issues resolved.");
    } catch {
      showToast("Could not fix all quality issues.");
    } finally {
      setFixingAllQuality(false);
    }
  };

  const buildEntryPayload = () => ({
    category: migrateKnowledgeCategory(form.category),
    curriculum_module: form.curriculumModule ?? null,
    question: form.question,
    answer: form.answer,
    priority: form.priority,
    keywords: textToKeywords(form.keywords),
    search_phrases: textToKeywords(form.search_phrases),
    alternative_wording: textToKeywords(form.alternative_wording),
    synonyms: textToKeywords(form.synonyms),
    related_terms: textToKeywords(form.related_terms),
    autoGenerateKeywords: false,
    unansweredId: form.unansweredId,
  });

  const performSave = async (options?: {
    duplicateAction?: DuplicateSaveAction;
    targetEntryId?: string;
  }) => {
    const payload = {
      ...buildEntryPayload(),
      duplicateAction: options?.duplicateAction,
      targetEntryId: options?.targetEntryId ?? duplicateCheck?.exactMatch?.entry.id,
    };
    const editingId = form.id;

    if (editingId && !options?.duplicateAction) {
      const res = await fetch(
        `/api/super-admin/ai-training/knowledge/${editingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Save failed");
      }
      const data = (await res.json()) as { row?: AIKnowledgeEntry };
      if (data.row) {
        setClassificationEntry(classificationFromEntry(data.row));
        setEditMeta({
          version_number: data.row.version_number ?? 1,
          updated_at: data.row.updated_at,
          created_at: data.row.created_at,
        });
      }
      return data.row;
    }

    const res = await fetch("/api/super-admin/ai-training/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.status === 409) {
      const data = (await res.json()) as {
        duplicate?: boolean;
        check?: DuplicateCheckApiResult;
      };
      if (data.check) setDuplicateCheck(data.check);
      setDuplicateModalOpen(true);
      return null;
    }

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? "Save failed");
    }

    const data = (await res.json()) as { row?: AIKnowledgeEntry };
    const saved = data.row;

    if (
      editingId &&
      saved &&
      options?.duplicateAction &&
      editingId !== saved.id
    ) {
      await fetch(`/api/super-admin/ai-training/knowledge/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
    }

    return saved;
  };

  const persistCategoryAfterSave = () => {
    rememberLastKnowledgeCategory(migrateKnowledgeCategory(form.category));
  };

  const commitSave = async () => {
    setSaving(true);
    try {
      const saved = await performSave();
      if (!saved) return;
      persistCategoryAfterSave();
      const recs = buildPostSaveRecommendations(saved, [
        ...knowledgeRows.filter((r) => r.id !== saved.id),
        saved,
      ]);
      if (recs.length > 0) setPostSaveRecommendations(recs);
      setFormOpen(false);
      setDuplicateModalOpen(false);
      setNearDuplicateModalOpen(false);
      setNearDuplicateAcknowledged(false);
      showToast(form.id ? "Entry updated." : "Entry created.");
      void loadKnowledge();
      void refreshAnalytics();
      void loadIntentHealth();
      if (form.unansweredId) void loadUnanswered();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveEntry = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.answer.trim()) {
      showToast("Answer is required before saving.");
      return;
    }

    const conflictingDuplicate =
      duplicateCheck?.exactMatch &&
      (!form.id || duplicateCheck.exactMatch.entry.id !== form.id);

    if (conflictingDuplicate) {
      setDuplicateModalOpen(true);
      return;
    }

    const needsNearDuplicateConfirm =
      !form.id &&
      duplicateCheck?.nearDuplicateMatch &&
      duplicateCheck.nearDuplicateMatch.scores.entitySimilarity >= 0.25 &&
      !nearDuplicateAcknowledged;

    if (needsNearDuplicateConfirm) {
      setNearDuplicateModalOpen(true);
      return;
    }

    if (!enterpriseReadiness.ready) {
      showToast(
        enterpriseReadiness.blockers[0] ??
          "Complete the Enterprise Quality Checklist before saving."
      );
      return;
    }

    await commitSave();
  };

  const handleDuplicateSaveAction = async (action: DuplicateSaveAction) => {
    setSaving(true);
    try {
      const saved = await performSave({
        duplicateAction: action,
        targetEntryId: duplicateCheck?.exactMatch?.entry.id,
      });
      if (!saved) return;
      persistCategoryAfterSave();
      setFormOpen(false);
      setDuplicateModalOpen(false);
      showToast("Entry saved.");
      void loadKnowledge();
      void refreshAnalytics();
      void loadIntentHealth();
      if (form.unansweredId) void loadUnanswered();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const mergeSelectedEntries = async () => {
    const ids = [...selectedIds];
    if (ids.length !== 2) return;
    const entries = ids
      .map((id) => knowledgeRows.find((r) => r.id === id))
      .filter(Boolean) as AIKnowledgeEntry[];
    if (entries.length !== 2) {
      showToast("Select two entries on this page to merge.");
      return;
    }
    setMergePrimaryId(entries[0]!.id);
    setMergeModalOpen(true);
  };

  const confirmMerge = async () => {
    const ids = [...selectedIds];
    if (ids.length !== 2 || !mergePrimaryId) return;
    const duplicateId = ids.find((id) => id !== mergePrimaryId);
    if (!duplicateId) return;

    setMerging(true);
    try {
      const res = await fetch("/api/super-admin/ai-training/knowledge/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryId: mergePrimaryId, duplicateId }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        showToast(err.error ?? "Merge failed.");
        return;
      }
      setMergeModalOpen(false);
      setSelectedIds(new Set());
      showToast("Entries merged.");
      void loadKnowledge();
      void refreshAnalytics();
      void loadIntentHealth();
    } finally {
      setMerging(false);
    }
  };

  const mergeModalEntries = useMemo((): [AIKnowledgeEntry, AIKnowledgeEntry] | null => {
    if (selectedIds.size !== 2) return null;
    const entries = [...selectedIds]
      .map((id) => knowledgeRows.find((r) => r.id === id))
      .filter(Boolean) as AIKnowledgeEntry[];
    return entries.length === 2 ? [entries[0]!, entries[1]!] : null;
  }, [selectedIds, knowledgeRows]);

  const bulkAction = async (action: "archive" | "delete" | "activate") => {
    if (selectedIds.size === 0) return;
    const res = await fetch("/api/super-admin/ai-training/knowledge/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selectedIds], action }),
    });
    if (!res.ok) {
      showToast("Bulk action failed");
      return;
    }
    setSelectedIds(new Set());
    showToast(`Bulk ${action} completed.`);
    void loadKnowledge();
    void refreshAnalytics();
  };

  const archiveEntry = async (id: string) => {
    await fetch(`/api/super-admin/ai-training/knowledge/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    void loadKnowledge();
    void refreshAnalytics();
  };

  const deleteEntry = async (id: string) => {
    if (!window.confirm("Delete this knowledge entry permanently?")) return;
    await fetch(`/api/super-admin/ai-training/knowledge/${id}`, {
      method: "DELETE",
    });
    void loadKnowledge();
    void refreshAnalytics();
    void loadIntentHealth();
  };

  const recalculateEntryIntent = async () => {
    if (!form.id) return;
    setRecalculatingIntent(true);
    try {
      const res = await fetch(
        `/api/super-admin/ai-training/knowledge/${form.id}/recalculate-intent`,
        { method: "POST" }
      );
      if (!res.ok) {
        showToast("Intent recalculation failed.");
        return;
      }
      const data = (await res.json()) as { row: AIKnowledgeEntry };
      setClassificationEntry(classificationFromEntry(data.row));
      showToast("Intent successfully recalculated.");
      void loadKnowledge();
      void loadIntentHealth();
    } finally {
      setRecalculatingIntent(false);
    }
  };

  const openBulkIntentRecalculate = async () => {
    setBulkIntentOpen(true);
    setBulkIntentStep("preview");
    setBulkIntentResult(null);
    setBulkIntentLoading(true);
    try {
      const res = await fetch(
        "/api/super-admin/ai-training/knowledge/recalculate-intents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "preview" }),
        }
      );
      if (res.ok) {
        setBulkIntentPreview((await res.json()) as BulkRecalculatePreview);
      }
    } finally {
      setBulkIntentLoading(false);
    }
  };

  const applyBulkIntentRecalculate = async () => {
    if (!bulkIntentPreview) return;
    setBulkIntentStep("applying");
    setBulkIntentLoading(true);
    try {
      const res = await fetch(
        "/api/super-admin/ai-training/knowledge/recalculate-intents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "apply",
            changeIds: bulkIntentPreview.changes.map((c) => c.id),
          }),
        }
      );
      if (res.ok) {
        setBulkIntentResult((await res.json()) as BulkRecalculateResult);
        setBulkIntentStep("summary");
        void loadKnowledge();
        void loadIntentHealth();
      } else {
        showToast("Bulk recalculation failed.");
        setBulkIntentStep("preview");
      }
    } finally {
      setBulkIntentLoading(false);
    }
  };

  const updateUnanswered = async (
    id: string,
    status: AIUnansweredQuestion["status"]
  ) => {
    await fetch(`/api/super-admin/ai-training/unanswered/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void loadUnanswered();
    void refreshAnalytics();
  };

  const createFromUnanswered = async (row: AIUnansweredQuestion) => {
    openCreateForm({
      question: row.question,
      unansweredId: row.id,
    });
  };

  const knowledgeCategoryOptions = useMemo(
    () => knowledgeRows.map((row) => row.category),
    [knowledgeRows]
  );

  const overviewCards = useMemo(
    () => [
      {
        label: "Knowledge Entries",
        value: analytics.activeKnowledgeEntries,
        caption: `${analytics.totalKnowledgeEntries} total`,
      },
      {
        label: "Unanswered Queue",
        value: analytics.pendingUnansweredCount,
        caption: `${analytics.unansweredCount} all time`,
      },
      {
        label: "Answer Success Rate",
        value: `${analytics.answerSuccessRate}%`,
        caption: "Avg match confidence",
      },
    ],
    [analytics]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Super Admin
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            AI Operations Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
            Monitor AI quality, training progress, coverage, and performance
            across Adakaro&apos;s knowledge base.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTestDrawerOpen(true)}
            className={saBtnSecondary}
          >
            <Play className="mr-2 h-4 w-4" aria-hidden />
            Test Adakaro AI
          </button>
          <button
            type="button"
            onClick={() => void refreshOverview()}
            className={saBtnSecondary}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      <nav
        className="mt-8 flex flex-wrap gap-2"
        aria-label="AI Training sections"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
              tab === id
                ? "bg-indigo-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      <IntentHealthBanner
        health={intentHealth}
        onRecalculate={() => void openBulkIntentRecalculate()}
      />

      {tab === "overview" ? (
        <div className="mt-8 space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loadingOverview ? (
              <>
                <KpiSkeleton />
                <KpiSkeleton />
                <KpiSkeleton />
                <KpiSkeleton />
              </>
            ) : (
              <>
                <AIHealthScoreCard
                  score={analytics.aiHealth.score}
                  status={analytics.aiHealth.status}
                  breakdown={{
                    coveragePercent: analytics.knowledgeCoveragePercent,
                    knowledgeEntries: analytics.activeKnowledgeEntries,
                    unansweredQuestions: analytics.pendingUnansweredCount,
                  }}
                />
                {overviewCards.map((card) => (
                  <SaKpiCardHighlighted
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    caption={card.caption}
                  />
                ))}
              </>
            )}
          </div>

          <KnowledgeOperationsOverview
            snapshot={intelligenceSnapshot}
            userName="Abdallah"
            onStartMission={(mission) => {
              const moduleId = resolveMissionModuleId(mission);
              if (moduleId) {
                setPendingMission({
                  moduleId,
                  mode: missionToGenerationMode(mission),
                });
                setTab("curriculum");
                showToast(`Starting mission: ${mission.title}`);
              }
            }}
            onNavigateTab={(t) => setTab(t as TabId)}
          />

          <IntentCoveragePanel />

          <KnowledgeQualityPanel />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={saSection}>
              <h2 className={saSectionTitle}>Recent AI Activity</h2>
              <p className={saSectionSubtitle}>
                Latest unanswered questions and knowledge changes.
              </p>
              {loadingActivity ? (
                <TableSkeleton rows={4} />
              ) : activity.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">No recent activity yet.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {activity.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                          {ACTIVITY_LABELS[item.type]}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-medium text-slate-800">
                          {item.label}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatDateTime(item.timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={saSection}>
              <h2 className={saSectionTitle}>Trending Unanswered</h2>
              <p className={saSectionSubtitle}>
                Repeated questions that need knowledge entries.
              </p>
              <ul className="mt-4 space-y-3">
                {analytics.trendingUnanswered.length === 0 ? (
                  <li className="text-sm text-slate-400">No trending questions.</li>
                ) : (
                  analytics.trendingUnanswered.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {q.question}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatSource(q.source)} · {q.occurrences}× asked
                        </p>
                      </div>
                      <button
                        type="button"
                        className={saBtnPrimarySm}
                        onClick={() => {
                          openCreateForm({ question: q.question });
                          setTab("knowledge");
                        }}
                      >
                        Create Entry
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={saSection}>
              <h2 className={saSectionTitle}>Most Used Questions</h2>
              <p className={saSectionSubtitle}>
                Knowledge entries with the highest match count.
              </p>
              <ul className="mt-4 space-y-3">
                {analytics.mostUsedQuestions.length === 0 ? (
                  <li className="text-sm text-slate-400">No usage yet.</li>
                ) : (
                  analytics.mostUsedQuestions.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {q.question}
                        </p>
                        <p className="text-xs text-slate-400">{q.category}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-indigo-600">
                        {q.usage_count}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className={saSection}>
              <h2 className={saSectionTitle}>Knowledge Coverage</h2>
              <p className={saSectionSubtitle}>
                Matched questions vs unanswered queue.
              </p>
              <p className="mt-4 text-4xl font-extrabold tabular-nums text-slate-900">
                {analytics.knowledgeCoveragePercent}%
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${analytics.knowledgeCoveragePercent}%` }}
                />
              </div>
              <button
                type="button"
                className={cn(saBtnPrimarySm, "mt-4")}
                onClick={() => setTab("unanswered")}
              >
                Review unanswered queue ({analytics.pendingUnansweredCount})
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "knowledge" ? (
        <div className="mt-8 space-y-4">
          {postSaveRecommendations && postSaveRecommendations.length > 0 ? (
            <KnowledgePostSaveRecommendations
              recommendations={postSaveRecommendations}
              onCreateLesson={(question) => {
                openCreateForm({ question, category: form.category });
                setPostSaveRecommendations(null);
              }}
              onDismiss={() => setPostSaveRecommendations(null)}
            />
          ) : null}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={knowledgeSearch}
                onChange={(e) => {
                  setKnowledgeSearch(e.target.value);
                  setKnowledgePage(1);
                }}
                placeholder="Search questions, answers, categories…"
                className={cn(saInput, "w-full pl-9")}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={knowledgeStatus}
                onChange={(e) => {
                  setKnowledgeStatus(e.target.value);
                  setKnowledgePage(1);
                }}
                className={saInput}
                aria-label="Filter by status"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
              <KnowledgeCategorySelect
                value={knowledgeCategory}
                onChange={(next) => {
                  setKnowledgeCategory(next);
                  setKnowledgePage(1);
                }}
                extraCategories={knowledgeCategoryOptions}
                allowEmpty
                emptyLabel="All categories"
                aria-label="Filter by category"
                className="min-w-[200px]"
              />
              <button
                type="button"
                className={saBtnSecondary}
                onClick={() => void openBulkIntentRecalculate()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Recalculate All Intents
              </button>
              <button
                type="button"
                className={saBtnSecondary}
                onClick={() => setShowIntentColumns((v) => !v)}
              >
                Columns
              </button>
              <button
                type="button"
                className={saBtnSecondary}
                onClick={() => setBulkImportOpen(true)}
              >
                <FileUp className="mr-2 h-4 w-4" />
                Bulk Import
              </button>
              <button
                type="button"
                className={saBtnPrimary}
                onClick={() => openCreateForm()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </button>
            </div>
          </div>

          {selectedIds.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm">
              <span>{selectedIds.size} selected</span>
              {selectedIds.size === 2 ? (
                <button
                  type="button"
                  className={saBtnSecondarySm}
                  onClick={() => void mergeSelectedEntries()}
                >
                  <GitMerge className="mr-1.5 h-3.5 w-3.5" />
                  Merge
                </button>
              ) : null}
              <button
                type="button"
                className={saBtnSecondarySm}
                onClick={() => void bulkAction("archive")}
              >
                Archive
              </button>
              <button
                type="button"
                className={saBtnDangerOutline}
                onClick={() => void bulkAction("delete")}
              >
                Delete
              </button>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loadingKnowledge ? (
              <TableSkeleton rows={6} />
            ) : knowledgeRows.length === 0 ? (
              <div className="py-16 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  No knowledge entries yet
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Start training Adakaro AI with these common questions.
                </p>
                <ul className="mx-auto mt-6 max-w-md space-y-2 text-left">
                  {STARTER_QUESTIONS.map((q) => (
                    <li
                      key={q}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                    >
                      <span className="text-sm text-slate-700">{q}</span>
                      <button
                        type="button"
                        className={saBtnPrimarySm}
                        onClick={() => openCreateForm({ question: q })}
                      >
                        Create Entry
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={cn(saBtnSecondary, "mt-6")}
                  onClick={() => setBulkImportOpen(true)}
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  Bulk Import
                </button>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={saTableHeadRow}>
                    <th className={saTableHeadCell}>
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={
                          knowledgeRows.length > 0 &&
                          knowledgeRows.every((r) => selectedIds.has(r.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(knowledgeRows.map((r) => r.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                      />
                    </th>
                    <th className={saTableHeadCell}>Quality</th>
                    <th className={saTableHeadCell}>Health</th>
                    <th className={saTableHeadCell}>Category</th>
                    <th className={saTableHeadCell}>Question</th>
                    {showIntentColumns ? (
                      <>
                        <th className={saTableHeadCell}>Intent</th>
                        <th className={saTableHeadCell}>Confidence</th>
                        <th className={saTableHeadCell}>Last Recalculated</th>
                      </>
                    ) : null}
                    <th className={saTableHeadCell}>Keywords</th>
                    <th className={saTableHeadCell}>Usage</th>
                    <th className={saTableHeadCell}>Success</th>
                    <th className={saTableHeadCell}>Last Matched</th>
                    <th className={saTableHeadCell}>Status</th>
                    <th className={saTableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {knowledgeRows.map((row) => {
                    const metrics = enrichEntryMetrics(row, null);
                    return (
                    <tr key={row.id} className={saTableRowHover}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(row.id);
                            else next.delete(row.id);
                            setSelectedIds(next);
                          }}
                          aria-label={`Select ${row.question}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <QualityBadge
                          level={metrics.qualityLevel}
                          score={metrics.qualityScore}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <KnowledgeHealthBadge level={row.health_status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.category}</td>
                      <td className="max-w-xs px-4 py-3 font-medium text-slate-900">
                        {row.question}
                      </td>
                      {showIntentColumns ? (
                        <>
                          <td className="max-w-[8rem] truncate px-4 py-3 font-mono text-xs text-slate-600">
                            {row.intent_key ?? "—"}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            {formatIntentConfidence(row.intent_confidence)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatDateTime(row.intent_recalculated_at ?? null)}
                          </td>
                        </>
                      ) : null}
                      <td className="max-w-[12rem] px-4 py-3">
                        <ChipList items={row.keywords} />
                      </td>
                      <td className="px-4 py-3 tabular-nums">{row.usage_count}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {metrics.successRate > 0 ? `${metrics.successRate}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateTime(row.last_used_at)}
                      </td>
                      <td className="px-4 py-3 capitalize">{row.status}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            onClick={() => void openEntryById(row.id)}
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-700"
                            onClick={() => void archiveEntry(row.id)}
                            aria-label="Archive"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() => void deleteEntry(row.id)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <KnowledgePagination
            page={knowledgePage}
            pageSize={knowledgePageSize}
            total={knowledgeTotal}
            onPageChange={setKnowledgePage}
            onPageSizeChange={(size) => {
              setKnowledgePageSize(size);
              setKnowledgePage(1);
            }}
          />
        </div>
      ) : null}

      {tab === "unanswered" ? (
        <div className="mt-8 space-y-4">
          {analytics.trendingUnanswered.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <TrendingUp className="h-4 w-4" />
                Trending unanswered questions
              </div>
              <ul className="mt-3 space-y-2">
                {analytics.trendingUnanswered.slice(0, 5).map((q) => (
                  <li
                    key={q.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-800">{q.question}</span>
                    <span className="text-xs text-amber-800">
                      {q.occurrences}× · {formatSource(q.source)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={unansweredSearch}
                onChange={(e) => {
                  setUnansweredSearch(e.target.value);
                  setUnansweredPage(1);
                }}
                placeholder="Search unanswered questions…"
                className={cn(saInput, "w-full pl-9")}
              />
            </div>
            <select
              value={unansweredStatus}
              onChange={(e) => {
                setUnansweredStatus(e.target.value);
                setUnansweredPage(1);
              }}
              className={saInput}
            >
              <option value="pending">Pending</option>
              <option value="answered">Answered</option>
              <option value="ignored">Ignored</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loadingUnanswered ? (
              <TableSkeleton rows={5} />
            ) : unansweredRows.length === 0 ? (
              <div className="py-16 text-center">
                <HelpCircle className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  No unanswered questions in this filter
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  When visitors ask questions AI can&apos;t answer, they appear here.
                </p>
                <ul className="mx-auto mt-6 max-w-md space-y-2 text-left">
                  {STARTER_QUESTIONS.map((q) => (
                    <li
                      key={q}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                    >
                      <span className="text-sm text-slate-700">{q}</span>
                      <button
                        type="button"
                        className={saBtnPrimarySm}
                        onClick={() => openCreateForm({ question: q })}
                      >
                        Create Entry
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={saTableHeadRow}>
                    <th className={saTableHeadCell}>Question</th>
                    <th className={saTableHeadCell}>Occurrences</th>
                    <th className={saTableHeadCell}>Source</th>
                    <th className={saTableHeadCell}>First Seen</th>
                    <th className={saTableHeadCell}>Last Seen</th>
                    <th className={saTableHeadCell}>Status</th>
                    <th className={saTableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {unansweredRows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        saTableRowHover,
                        row.occurrences > 1 && "bg-amber-50/40"
                      )}
                    >
                      <td className="max-w-md px-4 py-3 font-medium text-slate-900">
                        <div className="flex items-start gap-2">
                          {row.occurrences > 1 ? (
                            <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                              Trending
                            </span>
                          ) : null}
                          <span>{row.question}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-slate-800">
                        {row.occurrences}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">
                        {formatSource(row.source)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateTime(row.first_seen_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateTime(row.last_seen_at)}
                      </td>
                      <td className="px-4 py-3 capitalize">{row.status}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className={saBtnPrimarySm}
                            onClick={() => createFromUnanswered(row)}
                          >
                            Create Entry
                          </button>
                          <button
                            type="button"
                            className={saBtnSecondarySm}
                            onClick={() =>
                              void updateUnanswered(row.id, "answered")
                            }
                          >
                            Mark Answered
                          </button>
                          <button
                            type="button"
                            className={saBtnSecondarySm}
                            onClick={() =>
                              void updateUnanswered(row.id, "archived")
                            }
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {unansweredPages > 1 ? (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {unansweredPage} of {unansweredPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={saBtnSecondarySm}
                  disabled={unansweredPage <= 1}
                  onClick={() => setUnansweredPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={saBtnSecondarySm}
                  disabled={unansweredPage >= unansweredPages}
                  onClick={() => setUnansweredPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "curriculum" ? (
        <KnowledgeCurriculumPanel
          onOpenEntry={(id) => void openEntryById(id)}
          onAddLesson={(moduleId, category, question) =>
            openCreateLesson(moduleId, category, question)
          }
          onOpenApprovalQueue={(moduleId) => {
            setApprovalQueueModule(moduleId ?? null);
            setTab("approval");
          }}
          pendingMission={pendingMission}
          onPendingMissionHandled={() => setPendingMission(null)}
          intelligenceSnapshot={intelligenceSnapshot}
        />
      ) : null}

      {tab === "approval" ? (
        <KnowledgeApprovalQueue
          initialModule={approvalQueueModule}
          initialStatus="pending"
        />
      ) : null}

      {tab === "health" ? (
        <div className="mt-4">
          <KnowledgeHealthPanel
            snapshot={intelligenceSnapshot}
            onSelectEntry={(id) => void openEntryById(id)}
            onCreateLesson={(question, category) => openCreateForm({ question, category })}
          />
        </div>
      ) : null}

      {tab === "missions" ? (
        <div className="mt-4">
          <KnowledgeMissionsPanel
            snapshot={intelligenceSnapshot}
            onStartMission={(mission) => {
              const moduleId = resolveMissionModuleId(mission);
              if (moduleId) {
                setPendingMission({
                  moduleId,
                  mode: missionToGenerationMode(mission),
                });
                setTab("curriculum");
                showToast(`Starting mission: ${mission.title}`);
                return;
              }
              if (mission.type === "reduce_duplicates") {
                setTab("knowledge");
                showToast(`Mission: ${mission.title} — review Published Knowledge for overlaps`);
                return;
              }
              setTab("curriculum");
              showToast(`Mission: ${mission.title} — select a module in Curriculum to continue`);
            }}
          />
        </div>
      ) : null}

      {tab === "graph" ? (
        <div className="mt-4">
          <KnowledgeGraphPanel snapshot={intelligenceSnapshot} onOpenEntry={(id) => void openEntryById(id)} />
        </div>
      ) : null}

      {tab === "signals" ? (
        <div className="mt-4">
          <KnowledgeSignalsPanel snapshot={intelligenceSnapshot} />
        </div>
      ) : null}

      {tab === "memory" ? (
        <div className="mt-4">
          <KnowledgeMemoryPanel snapshot={intelligenceSnapshot} />
        </div>
      ) : null}

      {tab === "intelligence" ? (
        <div className="mt-4">
          <KnowledgeIntelligenceScorecardPanel snapshot={intelligenceSnapshot} />
        </div>
      ) : null}

      {tab === "learning" ? <LearningPanel /> : null}

      {tab === "analytics" ? (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SaKpiCard
              label="Total Entries"
              value={analytics.totalKnowledgeEntries}
            />
            <SaKpiCard
              label="Active Entries"
              value={analytics.activeKnowledgeEntries}
            />
            <SaKpiCard
              label="Unanswered"
              value={analytics.pendingUnansweredCount}
            />
            <SaKpiCard
              label="Answer Success Rate"
              value={`${analytics.answerSuccessRate}%`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TrendChart
              title="Knowledge Usage Trend"
              data={analytics.usageTrend}
              emptyMessage="Create knowledge entries to start tracking usage."
            />
            <HorizontalBarChart
              title="Top Categories"
              subtitle="Entries and usage by category"
              items={analytics.topCategories.map((c) => ({
                category: c.category,
                count: c.count,
              }))}
              labelKey="category"
              valueKey="count"
              emptyMessage="Categories will appear as knowledge entries are created."
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <HorizontalBarChart
              title="Most Searched Keywords"
              items={analytics.mostSearchedKeywords.map((kw) => ({
                keyword: kw.keyword,
                count: kw.count,
              }))}
              labelKey="keyword"
              valueKey="count"
              emptyMessage="Keywords will appear after users interact with Adakaro AI."
            />
            <HorizontalBarChart
              title="Coverage by Category"
              subtitle="Share of knowledge base per category"
              items={analytics.coverageByCategory.map((c) => ({
                category: c.category,
                coverage: c.coveragePercent,
              }))}
              labelKey="category"
              valueKey="coverage"
              suffix="%"
              emptyMessage="Coverage metrics will appear after AI training begins."
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TrendChart
              title="Question Frequency"
              data={analytics.questionFrequency}
              barClass="bg-violet-500/80"
              emptyMessage="Visitor questions will be tracked automatically."
            />
            <div className={saSection}>
              <h3 className={saSectionTitle}>Answer Success Rate</h3>
              <p className={saSectionSubtitle}>
                Average confidence when knowledge entries match questions.
              </p>
              <p className="mt-4 text-4xl font-extrabold tabular-nums text-slate-900">
                {analytics.answerSuccessRate}%
              </p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600"
                  style={{ width: `${analytics.answerSuccessRate}%` }}
                />
              </div>
              <div className="mt-6">
                <AIHealthScoreCard
                  score={analytics.aiHealth.score}
                  status={analytics.aiHealth.status}
                  breakdown={{
                    coveragePercent: analytics.knowledgeCoveragePercent,
                    knowledgeEntries: analytics.activeKnowledgeEntries,
                    unansweredQuestions: analytics.pendingUnansweredCount,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div
            className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={form.id ? "Edit knowledge entry" : "Add knowledge entry"}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {form.id ? "Edit Entry" : "Add Knowledge Entry"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Guided enterprise authoring — follow each step from question to save.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void saveEntry(e)} className="mt-6 space-y-4">
              <AuthoringWorkflowRail
                steps={workflowSteps}
                loadingStepId={duplicateCheckLoading ? "knowledge-search" : null}
              />

              <AuthoringWorkflowSection
                stepId="question"
                stepNumber={1}
                title="Question"
                subtitle="Category, priority, and the lesson question"
                status={workflowStepStatus("question")}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Category</span>
                    <KnowledgeCategorySelect
                      value={form.category}
                      onChange={(category) => setForm((f) => ({ ...f, category }))}
                      extraCategories={knowledgeCategoryOptions}
                      rememberSelection
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Priority</span>
                    <select
                      value={form.priority}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          priority: e.target.value as KnowledgePriority,
                        }))
                      }
                      className={cn(saInput, "mt-1 w-full")}
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="mt-4 block text-sm">
                  <span className="font-medium text-slate-700">Question</span>
                  <textarea
                    ref={questionEditorRef}
                    id="author-question-editor"
                    value={form.question}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, question: e.target.value }))
                    }
                    rows={2}
                    required
                    placeholder="One clear intent per entry"
                    className={cn(saInput, "mt-1 w-full")}
                  />
                </label>
              </AuthoringWorkflowSection>

              {form.question.trim().length >= 3 ? (
                <KnowledgeDuplicatePanel
                  variant="workflow"
                  question={form.question}
                  category={form.category}
                  excludeId={form.id}
                  allEntries={knowledgeRows}
                  workflowSteps={workflowSteps}
                  onLoadingChange={setDuplicateCheckLoading}
                  onSelectEntry={(id) => void openEntryById(id)}
                  onCreateLesson={(question, category) =>
                    openCreateForm({ question, category })
                  }
                  onCheckResult={handleDuplicateCheck}
                />
              ) : null}

              <AuthoringWorkflowSection
                stepId="answer-structure"
                stepNumber={6}
                title="Generate answer structure"
                subtitle="Insert a recommended documentation outline"
                status={workflowStepStatus("answer-structure")}
              >
                <button
                  type="button"
                  className={saBtnSecondary}
                  disabled={!form.question.trim()}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      answer: buildRecommendedAnswerTemplate(f.question),
                    }))
                  }
                >
                  Generate answer structure
                </button>
              </AuthoringWorkflowSection>

              <AuthoringWorkflowSection
                stepId="author-review"
                stepNumber={7}
                title="Author writes & reviews"
                subtitle="Generate an AI draft, then edit facts-only documentation"
                status={workflowStepStatus("author-review")}
              >
                <AIKnowledgeAuthorButton
                  question={form.question}
                  category={form.category}
                  priority={form.priority}
                  structure={form.answer}
                  curriculumModule={form.curriculumModule}
                  answer={form.answer}
                  excludeEntryId={form.id}
                  prerequisiteQuestions={draftAuthorContext.prerequisiteQuestions}
                  dependencyQuestions={draftAuthorContext.dependencyQuestions}
                  relatedQuestions={draftAuthorContext.relatedQuestions}
                  onDraftApplied={(draft) =>
                    setForm((f) => ({ ...f, answer: draft }))
                  }
                />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700">Answer</span>
                  <KnowledgeAnswerAssistant
                    question={form.question}
                    answer={form.answer}
                    onApply={(nextAnswer) =>
                      setForm((f) => ({ ...f, answer: nextAnswer }))
                    }
                  />
                </div>
                <AuthorDocumentationEditor
                  key={form.id ?? "new-entry"}
                  ref={answerEditorRef}
                  value={form.answer}
                  onChange={(nextAnswer) =>
                    setForm((f) => ({ ...f, answer: nextAnswer }))
                  }
                  required
                  placeholder="Use sections: Overview, Purpose, Capabilities, Permissions, Notes…"
                  highlights={answerHighlights}
                  activeRange={activeHighlightRange}
                  onHighlightAction={handleHighlightAction}
                />
              </AuthoringWorkflowSection>

              <AuthoringWorkflowSection
                stepId="generate-metadata"
                stepNumber={8}
                title="Generate metadata"
                subtitle="Keywords, synonyms, search phrases, and related terms"
                status={workflowStepStatus("generate-metadata")}
              >
                <KnowledgeMetadataFields
                  category={form.category}
                  question={form.question}
                  answer={form.answer}
                  fields={{
                    keywords: form.keywords,
                    synonyms: form.synonyms,
                    search_phrases: form.search_phrases,
                    alternative_wording: form.alternative_wording,
                    related_terms: form.related_terms,
                  }}
                  onChange={(metadataFields) =>
                    setForm((f) => ({
                      ...f,
                      ...metadataFields,
                    }))
                  }
                  metadataBaseline={metadataBaseline}
                  onBaselineUpdate={setMetadataBaseline}
                  showGeneratedNotice={metadataGeneratedNotice}
                  onGeneratedNotice={setMetadataGeneratedNotice}
                  fieldHighlights={metadataFieldHighlights}
                  activeFieldRange={activeMetadataHighlight}
                  fieldRefs={metadataEditorRefs}
                  onHighlightAction={handleHighlightAction}
                />
              </AuthoringWorkflowSection>

              <AuthoringWorkflowSection
                stepId="quality-check"
                stepNumber={9}
                title="Quality check"
                subtitle="Enterprise readiness validation"
                status={workflowStepStatus("quality-check")}
              >
                <KnowledgeWritingChecklist
                  draft={writingDraft}
                  readiness={enterpriseReadiness}
                  fixingAll={fixingAllQuality}
                  onAutoFixLanguage={handleAutoFixLanguage}
                  onFixAllQuality={() => void handleFixAllQuality()}
                  issues={validationIssues}
                  activeIssueIndex={activeIssueIndex}
                  onActiveIssueChange={setActiveIssueIndex}
                  onJumpToIssue={jumpToIssue}
                  onReplaceIssue={replaceIssue}
                  onEditIssue={jumpToIssue}
                  onIgnoreIssue={ignoreIssue}
                />
              </AuthoringWorkflowSection>

              {form.id && editMeta ? (
                <KnowledgeVersionPanel
                  entryId={form.id}
                  currentVersion={editMeta.version_number}
                  updatedAt={editMeta.updated_at}
                  createdAt={editMeta.created_at}
                  onRestored={(row) => {
                    setForm({
                      id: row.id,
                      category: row.category,
                      question: row.question,
                      keywords: keywordsToText(row.keywords),
                      search_phrases: keywordsToText(row.search_phrases),
                      alternative_wording: keywordsToText(row.alternative_wording),
                      synonyms: keywordsToText(row.synonyms ?? []),
                      related_terms: keywordsToText(row.related_terms),
                      answer: row.answer,
                      priority: row.priority,
                    });
                    setClassificationEntry(classificationFromEntry(row));
                    setEditMeta({
                      version_number: row.version_number ?? 1,
                      updated_at: row.updated_at,
                      created_at: row.created_at,
                    });
                    showToast("Version restored.");
                    void loadKnowledge();
                  }}
                />
              ) : null}

              {form.id && classificationEntry ? (
                <AIClassificationPanel
                  entry={classificationEntry}
                  recalculating={recalculatingIntent}
                  onRecalculate={() => void recalculateEntryIntent()}
                />
              ) : null}

              <AuthoringWorkflowSection
                stepId="save"
                stepNumber={10}
                title="Save"
                subtitle="Publish when enterprise quality checks pass"
                status={workflowStepStatus("save")}
              >
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className={saBtnSecondary}
                    onClick={() => setFormOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={saBtnPrimary}
                    disabled={saving || !enterpriseReadiness.ready}
                    title={
                      enterpriseReadiness.ready
                        ? undefined
                        : enterpriseReadiness.blockers[0]
                    }
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    {enterpriseReadiness.ready
                      ? "Save Entry"
                      : `Enterprise Ready ${enterpriseReadiness.confidenceScore}%`}
                  </button>
                </div>
              </AuthoringWorkflowSection>
            </form>
          </div>
        </div>
      ) : null}

      <TestAIDrawer
        open={testDrawerOpen}
        onClose={() => setTestDrawerOpen(false)}
        onCreateEntry={(question) => {
          openCreateForm({ question });
          setTab("knowledge");
          setTestDrawerOpen(false);
        }}
        onOpenEntry={(entryId) => {
          void openEntryById(entryId);
          setTab("knowledge");
          setTestDrawerOpen(false);
        }}
        onImproveEntry={(entryId) => {
          void openEntryById(entryId);
          setTab("knowledge");
          setTestDrawerOpen(false);
        }}
        onApplySuggestion={(action, value, entryId) => {
          void applyTestSuggestion(action, value, entryId);
        }}
        onRecalculateIntent={(entryId) => {
          void applyTestSuggestion("recalculate_intent", undefined, entryId);
        }}
      />

      <BulkImportModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onImported={(count) => {
          showToast(`${count} entries imported.`);
          void loadKnowledge();
          void refreshAnalytics();
          void loadActivity();
          void loadIntentHealth();
        }}
      />

      <BulkIntentRecalculateModal
        open={bulkIntentOpen}
        preview={bulkIntentPreview}
        result={bulkIntentResult}
        step={bulkIntentStep}
        loading={bulkIntentLoading}
        onClose={() => setBulkIntentOpen(false)}
        onApply={() => void applyBulkIntentRecalculate()}
      />

      <KnowledgeDuplicateSaveModal
        open={duplicateModalOpen}
        check={duplicateCheck}
        currentQuestion={form.question}
        currentCategory={form.category}
        saving={saving}
        onAction={(action) => void handleDuplicateSaveAction(action)}
        onClose={() => setDuplicateModalOpen(false)}
      />

      <KnowledgeNearDuplicateModal
        open={nearDuplicateModalOpen}
        check={duplicateCheck}
        currentQuestion={form.question}
        currentCategory={form.category}
        saving={saving}
        onConfirm={() => {
          setNearDuplicateAcknowledged(true);
          setNearDuplicateModalOpen(false);
          void commitSave();
        }}
        onViewExisting={() => {
          const id = duplicateCheck?.nearDuplicateMatch?.entry.id;
          setNearDuplicateModalOpen(false);
          if (id) void openEntryById(id);
        }}
        onClose={() => setNearDuplicateModalOpen(false)}
      />

      {mergeModalEntries ? (
        <KnowledgeMergeModal
          open={mergeModalOpen}
          entries={mergeModalEntries}
          primaryId={mergePrimaryId}
          merging={merging}
          onPrimaryChange={setMergePrimaryId}
          onMerge={() => void confirmMerge()}
          onClose={() => setMergeModalOpen(false)}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[210] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
