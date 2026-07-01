/**
 * Aggregates all enterprise validation issues with source locations.
 */

import type { EnterpriseReadinessResult } from "./knowledge-authoring";
import {
  applyWordSuggestionToSentence,
  buildIssueId,
  locateMetadataLine,
  locateQuestionIssue,
  locateSentenceInAnswer,
  type ValidationIssue,
  type ValidationIssueLocation,
} from "./knowledge-validation-locations";
import { validateMetadataDraft } from "./knowledge-metadata-validator";
import type { KnowledgeWritingDraft, RuleFailure } from "./knowledge-writing-standard";
import { validateKnowledgeWritingStandard } from "./knowledge-writing-standard";

const RULE_LABELS: Record<string, string> = {
  "professional-language": "Professional language",
  timeless: "Timeless wording",
  "facts-not-conversation": "Facts, not conversation",
  "structured-answer": "Structure",
  "one-intent": "One clear intent",
  grammar: "Grammar",
  keywords: "Keywords",
  synonyms: "Synonyms",
  "search-phrases": "Search phrases",
  "alternative-wording": "Alternative wording",
  "related-terms": "Related terms",
  "metadata-valid": "Metadata",
  "metadata-synced": "Metadata sync",
  "duplicate-analysis": "Duplicate analysis",
  "dependency-analysis": "Dependencies",
  category: "Category",
  priority: "Priority",
  "accurate-answer": "Answer completeness",
};

function failureToIssue(
  failure: RuleFailure,
  draft: KnowledgeWritingDraft
): ValidationIssue {
  const isQuestion = failure.ruleId === "one-intent";
  let location: ValidationIssueLocation;
  let original = failure.sentence;
  let suggestion = failure.suggestion;
  let fixable = true;

  if (isQuestion) {
    location = locateQuestionIssue(draft.question);
    original = draft.question;
    suggestion = failure.suggestion;
    fixable = false;
  } else if (failure.ruleId === "structured-answer") {
    location =
      failure.location ??
      locateSentenceInAnswer(draft.answer, failure.sentence) ?? {
        section: "Answer",
        field: "Overview",
        paragraphIndex: 0,
        sentenceIndex: 0,
        charStart: 0,
        charEnd: Math.min(draft.answer.length, 120),
      };
    fixable = false;
  } else {
    location =
      failure.location ??
      locateSentenceInAnswer(draft.answer, failure.sentence) ?? {
        section: "Answer",
        field: "Answer",
        paragraphIndex: 0,
        sentenceIndex: 0,
        charStart: 0,
        charEnd: draft.answer.length,
      };

    const sentenceText = draft.answer.slice(location.charStart, location.charEnd);
    if (failure.word && failure.word !== "(structure)") {
      suggestion = applyWordSuggestionToSentence(sentenceText, failure.word, failure.suggestion);
    }
    original = sentenceText || failure.sentence;
  }

  return {
    id: buildIssueId(failure.ruleId, location, original),
    ruleId: failure.ruleId,
    ruleLabel: failure.ruleLabel,
    location,
    original,
    suggestion,
    reason: failure.reason,
    fixable,
  };
}

function metadataFieldToIssues(
  fieldErrors: Record<string, string[]>,
  fieldsText: Record<string, string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [field, errors] of Object.entries(fieldErrors)) {
    const text = fieldsText[field] ?? "";
    const lines = text.split("\n");

    for (const error of errors) {
      let lineIndex = 0;
      let lineText = lines[0] ?? "";
      const quoted = error.match(/"([^"]+)"/);
      if (quoted) {
        const idx = lines.findIndex((l) => l.trim().toLowerCase() === quoted[1]!.toLowerCase());
        if (idx >= 0) {
          lineIndex = idx;
          lineText = lines[idx]!;
        }
      }

      const location = locateMetadataLine(field, lineIndex, lineText, text);
      const suggestionMatch = error.match(/Suggested shorter versions:\n([\s\S]+)/);
      const firstSuggestion = suggestionMatch?.[1]
        ?.split("\n")
        .map((l) => l.replace(/^•\s*/, "").trim())
        .find(Boolean);

      issues.push({
        id: buildIssueId(`metadata-${field}`, location, lineText || error),
        ruleId: `metadata-${field}`,
        ruleLabel: RULE_LABELS[field.replace(/_/g, "-")] ?? field,
        location,
        original: lineText || error,
        suggestion: firstSuggestion ?? "",
        reason: error.split("\n")[0] ?? error,
        fixable: Boolean(firstSuggestion),
      });
    }
  }

  return issues;
}

export function collectValidationIssues(
  draft: KnowledgeWritingDraft,
  readiness: EnterpriseReadinessResult | null,
  metadataFieldsText?: Record<string, string>
): ValidationIssue[] {
  const writing = validateKnowledgeWritingStandard(draft);
  const issues: ValidationIssue[] = [];

  for (const failure of writing.failures) {
    issues.push(failureToIssue(failure, draft));
  }

  const metadataCheck = validateMetadataDraft(
    {
      keywords: draft.keywords,
      synonyms: draft.synonyms,
      search_phrases: draft.search_phrases,
      alternative_wording: draft.alternative_wording,
      related_terms: draft.related_terms,
    },
    draft.question
  );

  if (!metadataCheck.valid && metadataFieldsText) {
    issues.push(...metadataFieldToIssues(metadataCheck.fieldErrors, metadataFieldsText));
  }

  if (readiness) {
    for (const check of readiness.checks) {
      if (check.passed) continue;
      if (issues.some((i) => i.ruleId === check.id)) continue;

      const label = RULE_LABELS[check.id] ?? check.label;
      let location: ValidationIssueLocation;

      if (check.id === "metadata-synced" || check.id === "metadata-valid") {
        location = {
          section: "Metadata",
          field: "keywords",
          paragraphIndex: 0,
          sentenceIndex: 0,
          charStart: 0,
          charEnd: 0,
        };
      } else if (check.id === "duplicate-analysis" || check.id === "dependency-analysis") {
        continue;
      } else if (check.id === "accurate-answer") {
        location = {
          section: "Answer",
          field: "Overview",
          paragraphIndex: 0,
          sentenceIndex: 0,
          charStart: 0,
          charEnd: Math.min(draft.answer.length, 80),
        };
      } else {
        location = locateQuestionIssue(draft.question);
      }

      issues.push({
        id: buildIssueId(check.id, location, check.label),
        ruleId: check.id,
        ruleLabel: label,
        location,
        original: check.hint ?? check.label,
        suggestion: check.hint ?? "",
        reason: check.hint ?? `${label} check failed.`,
        fixable: false,
      });
    }
  }

  return issues;
}

export function filterActiveIssues(
  issues: ValidationIssue[],
  ignoredIds: Set<string>
): ValidationIssue[] {
  return issues.filter((issue) => !ignoredIds.has(issue.id));
}
