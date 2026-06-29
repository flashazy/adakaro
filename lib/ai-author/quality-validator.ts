/**
 * Quality Validator — contradiction detection, confidence, draft validation, and polish.
 */

import {
  formatGeneratedDraft,
  validateDocumentationFormatting,
} from "./draft-formatter";
import type { QuestionContext } from "./context-engine";
import { intentLabel } from "./intent-router";
import { removeDuplicateOverviews } from "./draft-composer";
import {
  containsPlaceholderContent,
  removeEmptySections,
  stripPlaceholderLines,
} from "./placeholder-guard";
import type {
  AuthorIntent,
  ConfidenceBreakdown,
  DraftSection,
  DraftValidationIssue,
  DraftValidationResult,
  KnowledgeConflict,
  ScoredFact,
} from "./types";

const FREE_FOREVER = /\bfree forever\b/i;
const FREE_UP_TO = /\bfree up to\b|\bfree for up to\b|\bup to \d+\b/i;
const PAID_ONLY = /\bpaid only\b|\bno free\b/i;

export function detectConflicts(facts: ScoredFact[]): KnowledgeConflict[] {
  const conflicts: KnowledgeConflict[] = [];
  const pricingFacts = facts.filter((f) =>
    /\bfree\b|\bpricing\b|\bplan\b|\bcost\b|\bsubscription\b/i.test(f.text)
  );

  for (let i = 0; i < pricingFacts.length; i++) {
    for (let j = i + 1; j < pricingFacts.length; j++) {
      const a = pricingFacts[i]!;
      const b = pricingFacts[j]!;
      const conflict = detectPairConflict(a, b);
      if (conflict) conflicts.push(conflict);
    }
  }

  return conflicts;
}

function detectPairConflict(a: ScoredFact, b: ScoredFact): KnowledgeConflict | null {
  const textA = a.text;
  const textB = b.text;

  if (
    (FREE_FOREVER.test(textA) && FREE_UP_TO.test(textB)) ||
    (FREE_FOREVER.test(textB) && FREE_UP_TO.test(textA))
  ) {
    return {
      id: `conflict:${a.id}:${b.id}`,
      topic: "Pricing",
      factA: textA,
      factB: textB,
      sourceA: a.sourceQuestion,
      sourceB: b.sourceQuestion,
      message: "Knowledge Conflict: lessons disagree on free plan limits.",
    };
  }

  if (
    (FREE_FOREVER.test(textA) && PAID_ONLY.test(textB)) ||
    (FREE_FOREVER.test(textB) && PAID_ONLY.test(textA))
  ) {
    return {
      id: `conflict:${a.id}:${b.id}`,
      topic: "Pricing",
      factA: textA,
      factB: textB,
      sourceA: a.sourceQuestion,
      sourceB: b.sourceQuestion,
      message: "Knowledge Conflict: lessons disagree on whether a free plan exists.",
    };
  }

  return null;
}

export function validateDraft(input: {
  draft: string;
  sections: DraftSection[];
  intent: AuthorIntent;
  conflicts: KnowledgeConflict[];
  acceptedFactsCount: number;
}): DraftValidationResult {
  const issues: DraftValidationIssue[] = [];
  const { draft, sections, intent, acceptedFactsCount } = input;
  const MIN_DRAFT_LENGTH = 40;

  if (acceptedFactsCount === 0) {
    issues.push({
      code: "no_accepted_facts",
      message: "No facts passed the acceptance filter from selected published lessons.",
    });
  } else if (draft.trim().length < MIN_DRAFT_LENGTH) {
    issues.push({
      code: "empty_draft",
      message: "Draft lacks substantive content despite accepted facts.",
    });
  }

  if (containsPlaceholderContent(draft)) {
    issues.push({
      code: "placeholder",
      message: "Placeholder or template text detected in draft.",
    });
  }

  const paragraphs = draft.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const seen = new Set<string>();
  for (const para of paragraphs) {
    const key = para.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
    if (seen.has(key)) {
      issues.push({ code: "duplicate_paragraph", message: "Duplicate paragraph detected." });
      break;
    }
    seen.add(key);
  }

  const overviewCount = (draft.match(/^(?:\*\*Overview\*\*|Overview)$/gm) ?? []).length;
  if (overviewCount > 1) {
    issues.push({ code: "repeated_overview", message: "Repeated overview section detected." });
  }

  if (/\.\.\.\s*$|,\s*$|\band\s*$/m.test(draft)) {
    issues.push({ code: "unfinished", message: "Unfinished sentence detected." });
  }

  if (intent !== "pricing" && /\bfree up to\b|\bsubscription plan\b|\bbilling cycle\b/i.test(draft)) {
    issues.push({ code: "irrelevant_pricing", message: "Irrelevant pricing content in non-pricing draft." });
  }

  if (intent === "identity" && /\bpermission role access\b/i.test(draft)) {
    issues.push({ code: "irrelevant_permissions", message: "Irrelevant permissions content in identity draft." });
  }

  if (sections.length > 0 && sections.every((s) => s.content.trim().length < 10)) {
    issues.push({
      code: "empty_section",
      message: "No section contains meaningful content.",
    });
  }

  const formatting = validateDocumentationFormatting(draft);
  for (const issue of formatting.issues) {
    if (issue.code === "inline_bullets" || issue.code === "collapsed_list") {
      issues.push({ code: "formatting", message: issue.message });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    rebuilt: false,
  };
}

export function hasPlaceholderIssue(result: DraftValidationResult): boolean {
  return result.issues.some((issue) => issue.code === "placeholder");
}

export function calculateConfidence(input: {
  questionContext: QuestionContext;
  sections: DraftSection[];
  factsUsed: ScoredFact[];
  sectionPlan: string[];
  coverageOverall?: number;
}): ConfidenceBreakdown {
  const intent = input.questionContext.route.intentConfidence;
  const facts =
    input.factsUsed.length > 0
      ? Math.round(
          input.factsUsed.reduce((sum, f) => sum + f.relevanceScore, 0) / input.factsUsed.length
        )
      : 40;
  const filledSections = input.sections.filter((s) => s.content.trim().length > 0).length;
  const coverage =
    input.coverageOverall ??
    Math.round((filledSections / Math.max(1, input.sectionPlan.length)) * 100);
  const overall = Math.round(intent * 0.3 + facts * 0.45 + coverage * 0.25);

  return { intent, facts, coverage, overall };
}

export function polishDraft(draft: string): string {
  let result = removeDuplicateOverviews(draft);

  result = stripPlaceholderLines(result);
  result = removeEmptySections(result);
  result = formatGeneratedDraft(result);

  return result;
}

export function templateFamilyLabel(questionContext: QuestionContext): string {
  return intentLabel(questionContext.route.intent);
}
