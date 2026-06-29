/**
 * Fact Extractor — splits published lessons into atomic facts.
 */

import { normalizeText } from "@/lib/ai-training/knowledge-scoring";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";
import type { ExtractedFact, RankedLesson } from "./types";

let factCounter = 0;

function nextFactId(entryId: string): string {
  factCounter += 1;
  return `fact:${entryId}:${factCounter}`;
}

function cleanFactText(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeFact(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => cleanFactText(s))
    .filter((s) => s.length >= 12);
}

function extractBullets(block: string): string[] {
  const bullets: string[] = [];
  for (const line of block.split("\n")) {
    const match = line.trim().match(/^[-•*]\s+(.+)/);
    if (match?.[1]) bullets.push(cleanFactText(match[1]));
  }
  return bullets;
}

function splitAnswerBlocks(answer: string): Array<{ heading: string | null; body: string }> {
  const blocks: Array<{ heading: string | null; body: string }> = [];
  let currentHeading: string | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    if (currentHeading || bodyLines.length > 0) {
      blocks.push({ heading: currentHeading, body: bodyLines.join("\n").trim() });
    }
    bodyLines = [];
  };

  for (const line of answer.split("\n")) {
    const trimmed = line.trim();
    const bold = trimmed.match(/^\*\*([^*]+)\*\*$/);
    if (bold) {
      flush();
      currentHeading = bold[1] ?? null;
      continue;
    }
    bodyLines.push(line);
  }

  flush();
  return blocks;
}

function makeFact(
  text: string,
  entry: AIKnowledgeEntry,
  sectionHint: string | null
): ExtractedFact | null {
  const cleaned = cleanFactText(text);
  if (!isValidFactText(cleaned)) return null;

  return {
    id: nextFactId(entry.id),
    text: cleaned,
    normalizedText: normalizeText(cleaned),
    sourceEntryId: entry.id,
    sourceQuestion: entry.question,
    sectionHint,
    tokens: tokenizeFact(cleaned),
  };
}

export function isValidFactText(text: string): boolean {
  const cleaned = cleanFactText(text);
  if (!cleaned || cleaned.length < 10) return false;
  if (/^(overview|purpose|notes|audience|capabilities|steps|plans)$/i.test(cleaned)) return false;
  if (containsPlaceholderContent(cleaned)) return false;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;

  return true;
}

function containsPlaceholderContent(text: string): boolean {
  return /\b(fact one|fact two|capability one|example text|lorem ipsum|insert here|placeholder)\b/i.test(
    text
  );
}

export function extractFactsFromLesson(entry: AIKnowledgeEntry): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const blocks = splitAnswerBlocks(entry.answer);

  if (blocks.length === 0) {
    for (const sentence of splitSentences(entry.answer)) {
      const fact = makeFact(sentence, entry, null);
      if (fact) facts.push(fact);
    }
    return facts;
  }

  for (const block of blocks) {
    const bullets = extractBullets(block.body);
    if (bullets.length > 0) {
      for (const bullet of bullets) {
        const fact = makeFact(bullet, entry, block.heading);
        if (fact) facts.push(fact);
      }
      continue;
    }

    for (const sentence of splitSentences(block.body)) {
      const fact = makeFact(sentence, entry, block.heading);
      if (fact) facts.push(fact);
    }
  }

  return facts;
}

export function extractFactsFromLessons(lessons: RankedLesson[]): ExtractedFact[] {
  factCounter = 0;
  const all: ExtractedFact[] = [];
  for (const lesson of lessons) {
    all.push(...extractFactsFromLesson(lesson.entry));
  }
  return all;
}

export function resetFactIdCounter(): void {
  factCounter = 0;
}
