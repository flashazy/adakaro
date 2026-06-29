/**
 * Fact Explainer — explains why each fact was accepted, rejected, or used.
 */

import type { QuestionContext } from "./context-engine";
import { intentLabel } from "./intent-router";
import type {
  ExplainedFact,
  FactRejectionReason,
  FactRejectionSummary,
  KnowledgeConflict,
  ScoredFact,
} from "./types";

const REJECTION_LABELS: Record<FactRejectionReason, string> = {
  duplicate: "Duplicate",
  wrong_intent: "Wrong intent",
  low_confidence: "Low confidence",
  no_matching_section: "No matching section",
  contradiction: "Contradiction",
  empty_text: "Empty text",
  missing_evidence: "Missing evidence",
  unsupported_claim: "Unsupported claim",
};

export function categorizeRejection(input: {
  blocked?: boolean;
  belowThreshold?: boolean;
  duplicate?: boolean;
  contradiction?: boolean;
  noMatchingSection?: boolean;
}): FactRejectionReason | null {
  if (input.duplicate) return "duplicate";
  if (input.contradiction) return "contradiction";
  if (input.blocked) return "wrong_intent";
  if (input.belowThreshold) return "low_confidence";
  if (input.noMatchingSection) return "no_matching_section";
  return null;
}

export function explainFactDecision(input: {
  fact: ScoredFact;
  context: QuestionContext;
  used: boolean;
  accepted?: boolean;
  blocked?: boolean;
  belowThreshold?: boolean;
  threshold?: number;
  rejectionCategory?: FactRejectionReason | null;
}): string {
  const { fact, context, used, blocked, belowThreshold, threshold, rejectionCategory } = input;
  const intent = intentLabel(context.route.intent);

  if (used) {
    if (context.route.expectedAnswerType === "audience") {
      if (/\b(school|administrator|teacher|parent|principal|built for|designed for)\b/i.test(fact.text)) {
        return "Used in draft — relevant to audience definition.";
      }
    }
    return `Used in draft — relevant to ${intent.toLowerCase()} intent.`;
  }

  if (rejectionCategory === "empty_text") {
    return "Rejected — empty or malformed fact text.";
  }

  if (rejectionCategory === "missing_evidence") {
    return `Rejected — missing evidence (evidence score below minimum).`;
  }

  if (rejectionCategory === "unsupported_claim") {
    return "Rejected — unsupported claim with insufficient published evidence.";
  }

  if (rejectionCategory === "duplicate") {
    return "Rejected — duplicate of a higher-ranked fact.";
  }

  if (rejectionCategory === "contradiction") {
    return "Rejected — contradicts another published fact.";
  }

  if (rejectionCategory === "no_matching_section") {
    return "Accepted but unused — no matching section in the draft template.";
  }

  if (blocked || rejectionCategory === "wrong_intent") {
    return `Rejected — wrong intent for ${intent.toLowerCase()} question.`;
  }

  if (belowThreshold || rejectionCategory === "low_confidence") {
    return `Rejected — low confidence. Threshold: ${threshold ?? "n/a"}. Actual: ${fact.relevanceScore}.`;
  }

  if (input.accepted) {
    return "Accepted by fact filter.";
  }

  return "Not selected for final draft.";
}

function conflictFactIds(conflicts: KnowledgeConflict[]): Set<string> {
  const ids = new Set<string>();
  for (const conflict of conflicts) {
    const match = conflict.id.match(/^conflict:(.+):(.+)$/);
    if (match?.[1]) ids.add(match[1]);
    if (match?.[2]) ids.add(match[2]);
  }
  return ids;
}

export function buildExplainedFacts(input: {
  allScored: ScoredFact[];
  kept: ScoredFact[];
  discarded: ScoredFact[];
  usedFactIds: Set<string>;
  context: QuestionContext;
  conflicts?: KnowledgeConflict[];
  duplicateCount?: number;
}): ExplainedFact[] {
  const keptIds = new Set(input.kept.map((f) => f.id));
  const conflictIds = conflictFactIds(input.conflicts ?? []);

  return input.allScored.map((fact) => {
    const used = input.usedFactIds.has(fact.id);
    const accepted = keptIds.has(fact.id);
    const isDiscarded = input.discarded.some((d) => d.id === fact.id);

    let rejectionCategory: FactRejectionReason | null =
      fact.rejectionCategory ?? input.discarded.find((d) => d.id === fact.id)?.rejectionCategory ?? null;

    if (conflictIds.has(fact.id) && !used) {
      rejectionCategory = "contradiction";
    } else if (accepted && !used) {
      rejectionCategory = "no_matching_section";
    }

    return {
      id: fact.id,
      text: fact.text,
      sourceQuestion: fact.sourceQuestion,
      sourceEntryId: fact.sourceEntryId,
      score: fact.relevanceScore,
      used,
      accepted,
      reason:
        fact.discardReason ??
        explainFactDecision({
          fact,
          context: input.context,
          used,
          accepted,
          blocked: isDiscarded && rejectionCategory === "wrong_intent",
          belowThreshold: isDiscarded && rejectionCategory === "low_confidence",
          rejectionCategory,
        }),
      rejectionCategory: used ? null : rejectionCategory,
    };
  });
}

export function buildRejectionSummary(input: {
  explainedFacts: ExplainedFact[];
  duplicatesRemoved: number;
}): FactRejectionSummary[] {
  const counts = new Map<FactRejectionReason, number>();

  for (const fact of input.explainedFacts) {
    if (fact.used || !fact.rejectionCategory) continue;
    counts.set(fact.rejectionCategory, (counts.get(fact.rejectionCategory) ?? 0) + 1);
  }

  if (input.duplicatesRemoved > 0) {
    counts.set("duplicate", (counts.get("duplicate") ?? 0) + input.duplicatesRemoved);
  }

  return (Object.keys(REJECTION_LABELS) as FactRejectionReason[])
    .map((reason) => ({
      reason,
      label: REJECTION_LABELS[reason],
      count: counts.get(reason) ?? 0,
    }))
    .filter((entry) => entry.count > 0);
}

export function buildFactConfidenceReasons(input: {
  context: QuestionContext;
  explainedFacts: ExplainedFact[];
  sectionConfidence: Array<{ section: string; confidence: number }>;
}): string[] {
  const reasons: string[] = [];
  const intent = input.context.route.intent;
  const used = input.explainedFacts.filter((f) => f.used);
  const accepted = input.explainedFacts.filter((f) => f.accepted);
  const audienceFacts = used.filter((f) =>
    /\b(school|administrator|teacher|parent|principal|owner|built for)\b/i.test(f.text)
  );

  reasons.push(`${accepted.length} facts accepted, ${used.length} used in draft.`);

  if (intent === "identity" && input.context.route.expectedAnswerType === "audience") {
    reasons.push(`Only ${audienceFacts.length} audience facts used.`);
    if (!used.some((f) => /\bteacher\b/i.test(f.text))) reasons.push("Missing teacher facts.");
    if (!used.some((f) => /\bparent\b/i.test(f.text))) reasons.push("Missing parent facts.");
    if (!used.some((f) => /\b(owner|principal)\b/i.test(f.text))) reasons.push("Missing school owner facts.");
    if (!used.some((f) => /\b(primary|secondary)\b/i.test(f.text))) {
      reasons.push("Missing supported school types.");
    }
    if (!used.some((f) => /\b(africa|country|region)\b/i.test(f.text))) {
      reasons.push("Missing regional facts.");
    }
  }

  const lowSections = input.sectionConfidence.filter((s) => s.confidence < 40 && s.confidence > 0);
  for (const section of lowSections) {
    reasons.push(`Low confidence in ${section.section} section (${section.confidence}%).`);
  }

  const unusedAccepted = input.explainedFacts.filter((f) => f.accepted && !f.used).length;
  if (unusedAccepted > 0) {
    reasons.push(`${unusedAccepted} accepted facts had no matching section.`);
  }

  return reasons;
}

export function buildSectionConfidence(input: {
  sections: Array<{ title: string; confidence?: number }>;
  explainedFacts: ExplainedFact[];
  sectionPlan: string[];
}): Array<{ section: string; confidence: number; reasons: string[] }> {
  const result: Array<{ section: string; confidence: number; reasons: string[] }> = [];

  for (const title of input.sectionPlan) {
    const section = input.sections.find((s) => s.title === title);
    const confidence = section?.confidence ?? 0;
    const usedInSection = input.explainedFacts.filter((f) => f.used).length;
    const reasons: string[] = [];

    if (confidence >= 80) reasons.push("Strong fact support from published lessons.");
    else if (confidence >= 50) reasons.push("Partial fact coverage.");
    else if (confidence > 0) reasons.push(`${usedInSection > 0 ? "Limited" : "Minimal"} facts for this section.`);
    else reasons.push("No verified facts — section omitted.");

    result.push({ section: title, confidence, reasons });
  }

  return result;
}

export function audienceTopicPatterns(): Array<{ topic: string; category: string; pattern: RegExp }> {
  return [
    { topic: "School owners", category: "Audience", pattern: /\b(school owner|owner)\b/i },
    { topic: "Principals", category: "Audience", pattern: /\b(principal|headteacher|head teacher)\b/i },
    { topic: "Teachers", category: "Audience", pattern: /\bteacher\b/i },
    { topic: "Finance officers", category: "Audience", pattern: /\b(finance officer|bursar|accountant)\b/i },
    { topic: "Parents", category: "Audience", pattern: /\bparent\b/i },
    { topic: "Students", category: "Audience", pattern: /\bstudent\b/i },
    { topic: "Primary schools", category: "Schools", pattern: /\bprimary school\b/i },
    { topic: "Secondary schools", category: "Schools", pattern: /\bsecondary school\b/i },
    { topic: "Countries supported", category: "Regional", pattern: /\b(africa|country|countries|region)\b/i },
    { topic: "School size", category: "Schools", pattern: /\b(small|large|size|students)\b/i },
  ];
}
