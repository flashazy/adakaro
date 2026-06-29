/**
 * Reads published knowledge entries only — never drafts or archived lessons.
 */

import type { AIKnowledgeEntry } from "@/lib/ai-training/types";
import { normalizeText } from "@/lib/ai-training/knowledge-scoring";

export function isPublishedEntry(entry: AIKnowledgeEntry): boolean {
  return entry.status === "active" && !entry.merged_into_id;
}

export function filterPublishedEntries(entries: AIKnowledgeEntry[]): AIKnowledgeEntry[] {
  return entries.filter(isPublishedEntry);
}

export function findPublishedByQuestion(
  question: string,
  entries: AIKnowledgeEntry[],
  excludeId?: string
): AIKnowledgeEntry | null {
  const target = normalizeText(question);
  if (!target) return null;

  for (const entry of filterPublishedEntries(entries)) {
    if (excludeId && entry.id === excludeId) continue;
    if (normalizeText(entry.question) === target) return entry;
  }
  return null;
}

export function findPublishedByQuestions(
  questions: string[],
  entries: AIKnowledgeEntry[],
  excludeId?: string
): AIKnowledgeEntry[] {
  const found: AIKnowledgeEntry[] = [];
  const seen = new Set<string>();

  for (const question of questions) {
    const entry = findPublishedByQuestion(question, entries, excludeId);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    found.push(entry);
  }

  return found;
}

export function findPublishedByCategory(
  category: string,
  entries: AIKnowledgeEntry[],
  excludeId?: string,
  limit = 8
): AIKnowledgeEntry[] {
  const cat = category.trim().toLowerCase();
  if (!cat) return [];

  return filterPublishedEntries(entries)
    .filter((e) => e.id !== excludeId && e.category.trim().toLowerCase() === cat)
    .slice(0, limit);
}

export function findPublishedRelatedToQuestion(
  question: string,
  entries: AIKnowledgeEntry[],
  excludeId?: string,
  limit = 6
): AIKnowledgeEntry[] {
  const tokens = normalizeText(question)
    .split(/\s+/)
    .filter((t) => t.length > 3);

  if (tokens.length === 0) return [];

  const scored = filterPublishedEntries(entries)
    .filter((e) => e.id !== excludeId)
    .map((entry) => {
      const haystack = normalizeText(
        `${entry.question} ${entry.answer} ${entry.keywords.join(" ")} ${entry.related_terms.join(" ")}`
      );
      const score = tokens.filter((t) => haystack.includes(t)).length;
      return { entry, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((row) => row.entry);
}
