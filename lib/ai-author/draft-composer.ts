/**
 * Smart Document Composer — assembles documentation strictly from accepted facts.
 *
 * Future LLM engines replace only this module.
 */

import { composeDocumentation } from "./composition-writer";
import { composeSectionBlock, formatGeneratedDraft } from "./draft-formatter";
import type { QuestionContext } from "./context-engine";
import {
  containsPlaceholderContent,
  isPlaceholderLine,
  removeEmptySections,
  stripPlaceholderLines,
} from "./placeholder-guard";
import {
  assignFactsToSections,
  deduplicateFacts,
} from "./section-builder";
import { getSectionPlan } from "./intent-router";
import type { DraftSection, ScoredFact } from "./types";

function ensureSentence(text: string): string {
  const trimmed = text.trim().replace(/^[-•*]\s+/, "");
  if (!trimmed || isPlaceholderLine(trimmed) || containsPlaceholderContent(trimmed)) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function formatFactLine(fact: ScoredFact, asStep: boolean, index?: number): string {
  const text = fact.text.trim().replace(/^[-•*]\s+/, "");
  if (!text || isPlaceholderLine(text)) return "";

  if (asStep) {
    const cleaned = text.replace(/^\d+\.\s*/, "");
    return `${(index ?? 0) + 1}. ${ensureSentence(cleaned).replace(/[.!?]$/, "")}`;
  }

  return text.startsWith("-") ? text : `- ${text}`;
}

function renderSectionContent(
  title: string,
  facts: ScoredFact[],
  questionContext: QuestionContext
): string {
  const asSteps =
    title === "Steps" || questionContext.route.expectedAnswerType === "step_by_step";

  const lines = facts
    .map((fact, index) => formatFactLine(fact, asSteps, index))
    .filter((line) => line.length > 0);

  const unique = [...new Set(lines)];
  if (unique.length === 0) return "";

  if (title === "Overview" && unique.length === 1) {
    return unique[0]!.replace(/^- /, "");
  }

  return unique.join("\n");
}

export function populateSectionsFromFacts(input: {
  questionContext: QuestionContext;
  primaryFacts: ScoredFact[];
  fallbackFacts?: ScoredFact[];
  structure?: string;
}): {
  sections: DraftSection[];
  factsUsed: ScoredFact[];
  duplicatesRemoved: number;
  sectionPopulation: Array<{ section: string; factCount: number }>;
} {
  const sectionPlan = getSectionPlan(input.questionContext.route.intent, input.structure);
  const { facts: dedupedFacts, duplicatesRemoved } = deduplicateFacts(input.primaryFacts);
  let assignments = assignFactsToSections(sectionPlan, dedupedFacts);

  const fallback = input.fallbackFacts ?? [];
  for (const title of sectionPlan) {
    const current = assignments.get(title) ?? [];
    if (current.length > 0) continue;

  const fallbackCandidates = fallback
      .filter((f) => !dedupedFacts.some((k) => k.id === f.id))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    const subAssign = assignFactsToSections([title], fallbackCandidates);
    const rescued = subAssign.get(title) ?? [];
    if (rescued.length > 0) {
      assignments.set(title, rescued);
    }
  }

  const sections: DraftSection[] = [];
  const factsUsed: ScoredFact[] = [];
  const sectionPopulation: Array<{ section: string; factCount: number }> = [];

  for (const title of sectionPlan) {
    const sectionFacts = assignments.get(title) ?? [];
    if (sectionFacts.length === 0) {
      sectionPopulation.push({ section: title, factCount: 0 });
      continue;
    }

    const content = renderSectionContent(title, sectionFacts, input.questionContext);
    if (!content.trim() || containsPlaceholderContent(content)) {
      sectionPopulation.push({ section: title, factCount: 0 });
      continue;
    }

    for (const fact of sectionFacts) {
      factsUsed.push(fact);
    }

    sections.push({
      title,
      content,
      sources: [...new Set(sectionFacts.map((f) => f.sourceQuestion))],
      sourceEntryIds: [...new Set(sectionFacts.map((f) => f.sourceEntryId))],
      sourceFactIds: sectionFacts.map((f) => f.id),
      confidence: Math.round(
        sectionFacts.reduce((sum, f) => sum + f.relevanceScore, 0) / sectionFacts.length
      ),
    });

    sectionPopulation.push({ section: title, factCount: sectionFacts.length });
  }

  return { sections, factsUsed, duplicatesRemoved, sectionPopulation };
}

function composeStructuredDraft(input: {
  questionContext: QuestionContext;
  sections: DraftSection[];
  keptFacts: ScoredFact[];
}): string {
  const { questionContext, sections, keptFacts } = input;
  const answerType = questionContext.route.expectedAnswerType;

  const usesSemanticComposer =
    answerType === "audience" ||
    answerType === "definition" ||
    answerType === "capabilities" ||
    answerType === "general_facts";

  if (usesSemanticComposer && keptFacts.length > 0) {
    const composed = composeDocumentation({
      facts: keptFacts,
      expectedAnswerType: answerType,
      intent: questionContext.route.intent,
    });
    if (composed.draft.trim()) return composed.draft;
  }

  if (sections.length > 0) {
    return composeFromPopulatedSections(sections);
  }

  return "";
}

function composeFromPopulatedSections(sections: DraftSection[]): string {
  return sections
    .filter((s) => s.content.trim().length > 0 && !containsPlaceholderContent(s.content))
    .map((s) => composeSectionBlock(s.title, s.content))
    .join("\n\n");
}

function composeEmergencyFactsDraft(facts: ScoredFact[]): string {
  const lines = facts
    .slice(0, 8)
    .map((f) => formatFactLine(f, false))
    .filter((line) => line.length > 0);

  if (lines.length === 0) return "";

  if (lines.length === 1) {
    return composeSectionBlock("Overview", lines[0]!.replace(/^- /, ""));
  }

  return [
    composeSectionBlock("Overview", lines[0]!.replace(/^- /, "")),
    composeSectionBlock("Key Facts", lines.slice(1).join("\n")),
  ].join("\n\n");
}

export function composeDraft(input: {
  questionContext: QuestionContext;
  sections: DraftSection[];
  factsUsed: ScoredFact[];
  keptFacts: ScoredFact[];
  structure?: string;
}): string {
  const { questionContext, sections, factsUsed, keptFacts } = input;

  let draft = composeStructuredDraft({
    questionContext,
    sections,
    keptFacts,
  });

  if (!draft.trim() && keptFacts.length > 0) {
    draft = composeEmergencyFactsDraft(
      [...keptFacts].sort((a, b) => b.relevanceScore - a.relevanceScore)
    );
  }

  draft = stripPlaceholderLines(draft);
  draft = removeEmptySections(draft);
  draft = formatGeneratedDraft(draft);

  return draft;
}

export function removeDuplicateOverviews(draft: string): string {
  const overviewPattern =
    /^(?:\*\*Overview\*\*|Overview)\s*\n\n([\s\S]*?)(?=\n\n(?:\*\*[^*]+\*\*|[A-Z][A-Za-z0-9 &/-]{2,})|$)/gm;
  const matches = [...draft.matchAll(overviewPattern)];
  if (matches.length <= 1) return draft;

  let result = draft;
  for (let i = 1; i < matches.length; i++) {
    result = result.replace(matches[i]![0], "");
  }
  return result.replace(/\n{3,}/g, "\n\n").trim();
}
