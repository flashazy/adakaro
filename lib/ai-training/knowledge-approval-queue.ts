import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { GeneratedLessonDraft } from "./lesson-generator-types";
import { scoreToGrade } from "./lesson-generation-validator";
import {
  isEligibleForApprovalQueue,
  QUALITY_PASS_THRESHOLD,
} from "./knowledge-quality-engine";
import {
  createKnowledgeEntry,
  loadEntriesForDuplicateCheck,
  type KnowledgeEntryPayload,
} from "./knowledge-entry-mutations";
import { checkQuestionDuplicates } from "./knowledge-duplicates";
import type {
  AIKnowledgeApprovalQueueItem,
  AIKnowledgeEntry,
  ApprovalDuplicateRisk,
  ApprovalQueueSummary,
  ApprovalSourceType,
  ApprovalStatus,
  BulkPublishPreview,
  BulkPublishPreviewItem,
  KnowledgePriority,
} from "./types";

export interface ApprovalQueueFilters {
  status?: ApprovalStatus | "all";
  module?: string;
  category?: string;
  priority?: KnowledgePriority | "";
  intent?: string;
  qualityGrade?: string;
  duplicateRisk?: ApprovalDuplicateRisk | "";
  sourceType?: ApprovalSourceType | "";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ApprovalQueueListResult {
  rows: AIKnowledgeApprovalQueueItem[];
  total: number;
  summary: ApprovalQueueSummary;
  pendingByModule: Record<string, number>;
}

export interface ApprovalQueueUpdatePayload {
  proposed_question?: string;
  proposed_answer?: string;
  proposed_category?: string;
  proposed_priority?: KnowledgePriority;
  proposed_keywords?: string[];
  proposed_synonyms?: string[];
  proposed_search_phrases?: string[];
  proposed_alternative_wording?: string[];
  proposed_related_terms?: string[];
  proposed_intent_key?: string | null;
  proposed_intent_name?: string | null;
  proposed_intent_group?: string | null;
  proposed_curriculum_module?: string | null;
}

function normalizeRow(row: Record<string, unknown>): AIKnowledgeApprovalQueueItem {
  return {
    id: String(row.id),
    proposed_question: String(row.proposed_question),
    proposed_answer: String(row.proposed_answer),
    proposed_category: String(row.proposed_category ?? "General"),
    proposed_priority: (row.proposed_priority as KnowledgePriority) ?? "normal",
    proposed_keywords: (row.proposed_keywords as string[]) ?? [],
    proposed_synonyms: (row.proposed_synonyms as string[]) ?? [],
    proposed_search_phrases: (row.proposed_search_phrases as string[]) ?? [],
    proposed_alternative_wording: (row.proposed_alternative_wording as string[]) ?? [],
    proposed_related_terms: (row.proposed_related_terms as string[]) ?? [],
    proposed_intent_key: (row.proposed_intent_key as string | null) ?? null,
    proposed_intent_name: (row.proposed_intent_name as string | null) ?? null,
    proposed_intent_group: (row.proposed_intent_group as string | null) ?? null,
    proposed_curriculum_module: (row.proposed_curriculum_module as string | null) ?? null,
    source_type: (row.source_type as ApprovalSourceType) ?? "ai_lesson_generator",
    source_metadata: (row.source_metadata as Record<string, unknown>) ?? {},
    quality_score: Number(row.quality_score ?? 0),
    duplicate_risk: (row.duplicate_risk as ApprovalDuplicateRisk) ?? "none",
    coverage_score: Number(row.coverage_score ?? 0),
    approval_status: (row.approval_status as ApprovalStatus) ?? "pending",
    reviewed_by: (row.reviewed_by as string | null) ?? null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    rejection_reason: (row.rejection_reason as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function mapGeneratedLessonToQueueInsert(
  lesson: GeneratedLessonDraft,
  sourceMetadata: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    proposed_question: lesson.question,
    proposed_answer: lesson.answer,
    proposed_category: lesson.category,
    proposed_priority: lesson.priority,
    proposed_keywords: lesson.keywords,
    proposed_synonyms: lesson.synonyms,
    proposed_search_phrases: lesson.search_phrases,
    proposed_alternative_wording: lesson.alternative_wording,
    proposed_related_terms: lesson.related_terms,
    proposed_intent_key: lesson.intentKey,
    proposed_intent_name: lesson.intentLabel,
    proposed_intent_group: null,
    proposed_curriculum_module: lesson.curriculumModule,
    source_type: "ai_lesson_generator",
    source_metadata: {
      ...sourceMetadata,
      topicTag: lesson.topicTag,
      overallGrade: lesson.overallGrade,
      estimatedConfidence: lesson.estimatedConfidence,
      coverageContribution: lesson.coverageContribution,
      duplicateReason: lesson.duplicateReason,
      scores: lesson.scores,
      generatorDraftId: lesson.id,
      qualityReport: lesson.qualityReport,
      qualityStatus: lesson.qualityStatus,
      improvementAttempts: lesson.improvementAttempts,
    },
    quality_score: lesson.qualityReport?.overallQuality ?? lesson.scores.overallScore,
    duplicate_risk: lesson.duplicateRisk,
    coverage_score: lesson.scores.coverageScore,
    approval_status: "pending",
  };
}

export function gradeFromQualityScore(score: number): string {
  return scoreToGrade(score);
}

export function computeQueueSummary(
  rows: AIKnowledgeApprovalQueueItem[]
): ApprovalQueueSummary {
  let pending = 0;
  let approved = 0;
  let published = 0;
  let rejected = 0;
  let needsReview = 0;
  let duplicateRisk = 0;

  for (const row of rows) {
    switch (row.approval_status) {
      case "pending":
        pending++;
        break;
      case "approved":
        approved++;
        break;
      case "published":
        published++;
        break;
      case "rejected":
        rejected++;
        break;
      case "edited":
        needsReview++;
        break;
    }
    if (
      row.duplicate_risk === "medium" ||
      row.duplicate_risk === "high"
    ) {
      duplicateRisk++;
    }
    if (row.approval_status === "pending" && row.quality_score < 75) {
      needsReview++;
    }
  }

  return {
    pending,
    approved,
    published,
    rejected,
    needsReview,
    duplicateRisk,
    total: rows.length,
  };
}

export function computePendingByModule(
  rows: AIKnowledgeApprovalQueueItem[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.approval_status !== "pending" && row.approval_status !== "edited") {
      continue;
    }
    const mod = row.proposed_curriculum_module ?? "unknown";
    counts[mod] = (counts[mod] ?? 0) + 1;
  }
  return counts;
}

export async function loadAllQueueItemsForSummary(
  client: SupabaseClient<Database>
): Promise<AIKnowledgeApprovalQueueItem[]> {
  const { data, error } = await client
    .from("ai_knowledge_approval_queue")
    .select(
      "id, approval_status, duplicate_risk, quality_score, proposed_curriculum_module"
    );

  if (error) {
    console.error("[approval-queue] summary load:", error);
    return [];
  }

  return (data ?? []).map((row) =>
    normalizeRow(row as Record<string, unknown>)
  );
}

export async function listApprovalQueue(
  client: SupabaseClient<Database>,
  filters: ApprovalQueueFilters = {}
): Promise<ApprovalQueueListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  let query = client
    .from("ai_knowledge_approval_queue")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("approval_status", filters.status);
  }
  if (filters.module) {
    query = query.eq("proposed_curriculum_module", filters.module);
  }
  if (filters.category) {
    query = query.eq("proposed_category", filters.category);
  }
  if (filters.priority) {
    query = query.eq("proposed_priority", filters.priority);
  }
  if (filters.duplicateRisk) {
    query = query.eq("duplicate_risk", filters.duplicateRisk);
  }
  if (filters.sourceType) {
    query = query.eq("source_type", filters.sourceType);
  }
  if (filters.intent) {
    query = query.or(
      `proposed_intent_key.ilike.%${filters.intent}%,proposed_intent_name.ilike.%${filters.intent}%`
    );
  }
  if (filters.search) {
    const q = filters.search.trim();
    query = query.or(
      `proposed_question.ilike.%${q}%,proposed_answer.ilike.%${q}%,proposed_keywords.cs.{${q}}`
    );
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);

  if (error) {
    throw new Error(error.message);
  }

  let rows = (data ?? []).map((row) =>
    normalizeRow(row as Record<string, unknown>)
  );

  if (filters.qualityGrade) {
    rows = rows.filter(
      (row) => gradeFromQualityScore(row.quality_score) === filters.qualityGrade
    );
  }

  const allForSummary = await loadAllQueueItemsForSummary(client);
  const summary = computeQueueSummary(allForSummary);
  const pendingByModule = computePendingByModule(allForSummary);

  return {
    rows,
    total: count ?? rows.length,
    summary,
    pendingByModule,
  };
}

export async function getApprovalQueueItem(
  client: SupabaseClient<Database>,
  id: string
): Promise<AIKnowledgeApprovalQueueItem | null> {
  const { data, error } = await client
    .from("ai_knowledge_approval_queue")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeRow(data as Record<string, unknown>);
}

export async function createApprovalQueueItems(
  client: SupabaseClient<Database>,
  lessons: GeneratedLessonDraft[],
  sourceMetadata: Record<string, unknown> = {}
): Promise<{ count: number; ids: string[]; rejected: number }> {
  if (lessons.length === 0) return { count: 0, ids: [], rejected: 0 };

  const eligible = lessons.filter((lesson) =>
    isEligibleForApprovalQueue(lesson.qualityReport)
  );
  const rejected = lessons.length - eligible.length;

  if (eligible.length === 0) {
    return {
      count: 0,
      ids: [],
      rejected,
    };
  }

  const inserts = eligible.map((lesson) =>
    mapGeneratedLessonToQueueInsert(lesson, sourceMetadata)
  );

  const { data, error } = await client
    .from("ai_knowledge_approval_queue")
    .insert(inserts as never[])
    .select("id");

  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((row) => String((row as { id: string }).id));
  return { count: ids.length, ids, rejected };
}

export async function updateApprovalQueueItem(
  client: SupabaseClient<Database>,
  id: string,
  payload: ApprovalQueueUpdatePayload,
  userId: string
): Promise<AIKnowledgeApprovalQueueItem | null> {
  const patch: Record<string, unknown> = {
    ...payload,
    approval_status: "edited",
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("ai_knowledge_approval_queue")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return normalizeRow(data as Record<string, unknown>);
}

export async function approveQueueItem(
  client: SupabaseClient<Database>,
  id: string,
  userId: string
): Promise<AIKnowledgeApprovalQueueItem | null> {
  const { data, error } = await client
    .from("ai_knowledge_approval_queue")
    .update({
      approval_status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    } as never)
    .eq("id", id)
    .in("approval_status", ["pending", "edited"])
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return normalizeRow(data as Record<string, unknown>);
}

export async function rejectQueueItem(
  client: SupabaseClient<Database>,
  id: string,
  userId: string,
  reason?: string
): Promise<AIKnowledgeApprovalQueueItem | null> {
  const { data, error } = await client
    .from("ai_knowledge_approval_queue")
    .update({
      approval_status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason?.trim() || "Rejected by reviewer",
    } as never)
    .eq("id", id)
    .neq("approval_status", "published")
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return normalizeRow(data as Record<string, unknown>);
}

export function evaluatePublishDuplicate(
  question: string,
  category: string,
  entries: AIKnowledgeEntry[]
): BulkPublishPreviewItem["outcome"] {
  const check = checkQuestionDuplicates(question, entries, { category });

  if (check.exactMatch) return "blocked";
  if (check.nearDuplicateMatch && check.nearDuplicateMatch.classification !== "different_intent") {
    return "warning";
  }
  if (
    check.similar.some(
      (m) =>
        m.similarity >= 0.72 &&
        m.classification !== "different_intent"
    )
  ) {
    return "warning";
  }
  return "safe";
}

export async function previewBulkPublish(
  client: SupabaseClient<Database>,
  ids: string[]
): Promise<BulkPublishPreview> {
  const entries = await loadEntriesForDuplicateCheck(client);
  const items: BulkPublishPreviewItem[] = [];

  for (const id of ids) {
    const item = await getApprovalQueueItem(client, id);
    if (!item) continue;
    if (item.approval_status === "published") {
      items.push({
        id,
        question: item.proposed_question,
        outcome: "blocked",
        reason: "Already published",
      });
      continue;
    }
    if (item.approval_status === "rejected") {
      items.push({
        id,
        question: item.proposed_question,
        outcome: "blocked",
        reason: "Item was rejected",
      });
      continue;
    }

    const outcome = evaluatePublishDuplicate(
      item.proposed_question,
      item.proposed_category,
      entries
    );
    const check = checkQuestionDuplicates(item.proposed_question, entries, {
      category: item.proposed_category,
    });

    let reason: string | null = null;
    if (outcome === "blocked") {
      reason = check.exactMatch
        ? `Exact duplicate: "${check.exactMatch.entry.question}"`
        : "Duplicate blocked";
    } else if (outcome === "warning") {
      reason =
        check.nearDuplicateMatch?.matchReasons[0] ??
        "Near duplicate — review before publishing";
    }

    items.push({
      id,
      question: item.proposed_question,
      outcome,
      reason,
    });
  }

  const safeToPublish = items.filter((i) => i.outcome === "safe").length;
  const duplicateWarnings = items.filter((i) => i.outcome === "warning").length;
  const blockedDuplicates = items.filter((i) => i.outcome === "blocked").length;

  return {
    totalSelected: ids.length,
    safeToPublish,
    duplicateWarnings,
    blockedDuplicates,
    estimatedNewEntries: safeToPublish + duplicateWarnings,
    items,
  };
}

function queueItemToPayload(item: AIKnowledgeApprovalQueueItem): KnowledgeEntryPayload {
  return {
    category: item.proposed_category,
    curriculum_module: item.proposed_curriculum_module,
    question: item.proposed_question,
    answer: item.proposed_answer,
    keywords: item.proposed_keywords,
    search_phrases: item.proposed_search_phrases,
    alternative_wording: item.proposed_alternative_wording,
    synonyms: item.proposed_synonyms,
    related_terms: item.proposed_related_terms,
    priority: item.proposed_priority,
  };
}

export async function publishQueueItem(
  client: SupabaseClient<Database>,
  id: string,
  userId: string,
  options?: { allowNearDuplicate?: boolean }
): Promise<
  | { ok: true; entry: AIKnowledgeEntry; item: AIKnowledgeApprovalQueueItem }
  | { ok: false; error: string; preview?: BulkPublishPreviewItem }
> {
  const item = await getApprovalQueueItem(client, id);
  if (!item) return { ok: false, error: "Draft not found." };
  if (item.approval_status === "published") {
    return { ok: false, error: "Already published." };
  }
  if (item.approval_status === "rejected") {
    return { ok: false, error: "Rejected drafts cannot be published." };
  }

  const entries = await loadEntriesForDuplicateCheck(client);
  const outcome = evaluatePublishDuplicate(
    item.proposed_question,
    item.proposed_category,
    entries
  );

  if (outcome === "blocked") {
    const check = checkQuestionDuplicates(item.proposed_question, entries, {
      category: item.proposed_category,
    });
    return {
      ok: false,
      error: "Exact duplicate exists — publish blocked.",
      preview: {
        id,
        question: item.proposed_question,
        outcome: "blocked",
        reason: check.exactMatch?.matchReasons[0] ?? "Exact duplicate",
      },
    };
  }

  if (outcome === "warning" && !options?.allowNearDuplicate) {
    const check = checkQuestionDuplicates(item.proposed_question, entries, {
      category: item.proposed_category,
    });
    return {
      ok: false,
      error: "Near duplicate detected — confirm to publish anyway.",
      preview: {
        id,
        question: item.proposed_question,
        outcome: "warning",
        reason: check.nearDuplicateMatch?.matchReasons[0] ?? "Near duplicate",
      },
    };
  }

  const payload = queueItemToPayload(item);
  const result = await createKnowledgeEntry(client, payload, userId, {
    allEntries: entries,
    duplicateAction: "create",
  });

  if (!result.ok) {
    if ("duplicate" in result && result.duplicate) {
      return {
        ok: false,
        error: "Duplicate detected during publish.",
        preview: {
          id,
          question: item.proposed_question,
          outcome: "blocked",
          reason: result.check.exactMatch?.matchReasons[0] ?? "Duplicate",
        },
      };
    }
    return { ok: false, error: "error" in result ? result.error : "Publish failed." };
  }

  const { data: updated, error } = await client
    .from("ai_knowledge_approval_queue")
    .update({
      approval_status: "published",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    entry: result.row,
    item: updated
      ? normalizeRow(updated as Record<string, unknown>)
      : item,
  };
}

export async function deleteQueueItem(
  client: SupabaseClient<Database>,
  id: string
): Promise<boolean> {
  const { error } = await client
    .from("ai_knowledge_approval_queue")
    .delete()
    .eq("id", id)
    .neq("approval_status", "published");

  return !error;
}

export async function bulkApproveQueueItems(
  client: SupabaseClient<Database>,
  ids: string[],
  userId: string
): Promise<number> {
  let count = 0;
  for (const id of ids) {
    const row = await approveQueueItem(client, id, userId);
    if (row) count++;
  }
  return count;
}

export async function bulkRejectQueueItems(
  client: SupabaseClient<Database>,
  ids: string[],
  userId: string,
  reason?: string
): Promise<number> {
  let count = 0;
  for (const id of ids) {
    const row = await rejectQueueItem(client, id, userId, reason);
    if (row) count++;
  }
  return count;
}

export async function bulkPublishQueueItems(
  client: SupabaseClient<Database>,
  ids: string[],
  userId: string,
  options?: { allowNearDuplicate?: boolean; skipBlocked?: boolean }
): Promise<{ published: number; blocked: number; warnings: number; errors: string[] }> {
  let published = 0;
  let blocked = 0;
  let warnings = 0;
  const errors: string[] = [];

  for (const id of ids) {
    const result = await publishQueueItem(client, id, userId, options);
    if (result.ok) {
      published++;
      continue;
    }
    if (result.preview?.outcome === "blocked") {
      blocked++;
      if (!options?.skipBlocked) {
        errors.push(`${result.preview.question}: ${result.error}`);
      }
      continue;
    }
    if (result.preview?.outcome === "warning" && options?.allowNearDuplicate) {
      const retry = await publishQueueItem(client, id, userId, {
        allowNearDuplicate: true,
      });
      if (retry.ok) {
        published++;
        warnings++;
      } else {
        errors.push(retry.error);
      }
      continue;
    }
    if (result.preview?.outcome === "warning") {
      warnings++;
      errors.push(`${result.preview.question}: ${result.error}`);
      continue;
    }
    errors.push(result.error);
  }

  return { published, blocked, warnings, errors };
}

export async function bulkDeleteQueueItems(
  client: SupabaseClient<Database>,
  ids: string[]
): Promise<number> {
  let count = 0;
  for (const id of ids) {
    if (await deleteQueueItem(client, id)) count++;
  }
  return count;
}

export { isEligibleForApprovalQueue, QUALITY_PASS_THRESHOLD };

export function buildDuplicateReportForItem(
  item: AIKnowledgeApprovalQueueItem,
  entries: AIKnowledgeEntry[]
) {
  const check = checkQuestionDuplicates(item.proposed_question, entries, {
    category: item.proposed_category,
  });
  return {
    duplicateRisk: item.duplicate_risk,
    storedReason: item.source_metadata.duplicateReason ?? null,
    check,
    publishOutcome: evaluatePublishDuplicate(
      item.proposed_question,
      item.proposed_category,
      entries
    ),
  };
}
