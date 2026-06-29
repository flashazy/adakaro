/**
 * Knowledge health checks when creating or reviewing a lesson.
 */

import { extractKnowledgeEntity, getRelatedLessonTemplates } from "./knowledge-entities";
import { inferIntentSignature } from "./intent-signature";
import { normalizeText } from "./knowledge-scoring";
import type { AIKnowledgeEntry } from "./types";

export type LessonHealthItemStatus = "ok" | "missing" | "recommended";

export interface LessonHealthItem {
  id: string;
  label: string;
  status: LessonHealthItemStatus;
  detail?: string;
}

export interface LessonDraftMetadata {
  keywords?: string[];
  search_phrases?: string[];
  synonyms?: string[];
  alternative_wording?: string[];
  related_terms?: string[];
  answer?: string;
}

export interface LessonCreationHealthResult {
  items: LessonHealthItem[];
  score: number;
}

function hasCategoryCoverage(
  entries: AIKnowledgeEntry[],
  category: string,
  entityLabel?: string
): boolean {
  const cat = category.toLowerCase();
  return entries.some((e) => {
    if (e.category.toLowerCase() !== cat) return false;
    if (!entityLabel) return true;
    const text = normalizeText(`${e.question} ${e.answer}`);
    return text.includes(normalizeText(entityLabel));
  });
}

function findRelatedInDatabase(
  templates: Array<{ question: string }>,
  entries: AIKnowledgeEntry[]
): { covered: string[]; missing: string[] } {
  const covered: string[] = [];
  const missing: string[] = [];

  for (const template of templates) {
    const norm = normalizeText(template.question);
    const found = entries.some(
      (e) => normalizeText(e.question) === norm || normalizeText(e.question).includes(norm)
    );
    if (found) covered.push(template.question);
    else missing.push(template.question);
  }

  return { covered, missing };
}

export function assessLessonCreationHealth(input: {
  question: string;
  category: string;
  draft?: LessonDraftMetadata;
  allEntries: AIKnowledgeEntry[];
  excludeId?: string;
}): LessonCreationHealthResult {
  const { question, category, draft, allEntries, excludeId } = input;
  const entries = allEntries.filter((e) => e.id !== excludeId && e.status === "active");
  const entity = extractKnowledgeEntity(question);
  const intent = inferIntentSignature(question);
  const items: LessonHealthItem[] = [];

  const keywords = draft?.keywords ?? [];
  const searchPhrases = draft?.search_phrases ?? [];
  const synonyms = draft?.synonyms ?? [];
  const altWording = draft?.alternative_wording ?? [];

  items.push({
    id: "keywords",
    label: "Keywords",
    status: keywords.length >= 3 ? "ok" : "missing",
    detail:
      keywords.length >= 3
        ? `${keywords.length} keywords defined`
        : "Add at least 3 searchable keywords",
  });

  items.push({
    id: "search_phrases",
    label: "Search Phrases",
    status: searchPhrases.length >= 1 ? "ok" : "missing",
    detail:
      searchPhrases.length >= 1
        ? `${searchPhrases.length} search phrase(s)`
        : "Add natural-language search phrases parents and staff might use",
  });

  items.push({
    id: "synonyms",
    label: "Synonyms",
    status: synonyms.length >= 1 ? "ok" : "missing",
    detail:
      synonyms.length >= 1
        ? `${synonyms.length} synonym(s)`
        : "Add synonyms to improve retrieval coverage",
  });

  items.push({
    id: "alternative_wording",
    label: "Alternative Wording",
    status: altWording.length >= 1 ? "ok" : "missing",
    detail:
      altWording.length >= 1
        ? `${altWording.length} alternative phrasing(s)`
        : "Add alternative ways users might ask this question",
  });

  if (entity) {
    const templates = getRelatedLessonTemplates(entity.id, intent.category).slice(0, 6);
    const { missing } = findRelatedInDatabase(templates, entries);
    items.push({
      id: "related_lessons",
      label: "Related Lessons",
      status: missing.length === 0 ? "ok" : "recommended",
      detail:
        missing.length === 0
          ? "Core related lessons exist for this entity"
          : `${missing.length} related lesson(s) not yet in the knowledge base`,
    });

    const faqCategories = ["Frequently Asked Questions", "General", category];
    const hasFaq = faqCategories.some((c) =>
      hasCategoryCoverage(entries, c, entity.label)
    );
    items.push({
      id: "faq",
      label: "FAQ Coverage",
      status: hasFaq ? "ok" : "recommended",
      detail: hasFaq
        ? "FAQ-style coverage exists for this topic"
        : "Consider adding FAQ lessons for this entity",
    });

    items.push({
      id: "troubleshooting",
      label: "Troubleshooting",
      status: hasCategoryCoverage(entries, "Troubleshooting", entity.label)
        ? "ok"
        : "recommended",
      detail: "Troubleshooting lessons help resolve common issues faster",
    });

    items.push({
      id: "best_practices",
      label: "Best Practices",
      status: hasCategoryCoverage(entries, "Best Practices", entity.label)
        ? "ok"
        : "recommended",
      detail: "Best-practice lessons improve operational guidance quality",
    });
  } else {
    items.push({
      id: "related_lessons",
      label: "Related Lessons",
      status: "recommended",
      detail: "Define a clear entity (e.g. module name) to unlock related-lesson suggestions",
    });
  }

  const okCount = items.filter((i) => i.status === "ok").length;
  const score = Math.round((okCount / items.length) * 100);

  return { items, score };
}
