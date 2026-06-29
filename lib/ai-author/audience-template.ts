/**
 * Audience Template — structured composition for audience-focused documentation.
 */

import type { ScoredFact } from "./types";
import { containsPlaceholderContent, isPlaceholderLine } from "./placeholder-guard";

export interface AudienceComposition {
  intro: string;
  roles: string[];
  context: string;
  keyFacts: string[];
}

function ensureSentence(text: string): string {
  const trimmed = text.trim().replace(/^[-•*]\s+/, "");
  if (!trimmed || isPlaceholderLine(trimmed) || containsPlaceholderContent(trimmed)) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function extractRole(text: string): string | null {
  const cleaned = text.replace(/^[-•*]\s+/, "").trim();
  if (/\bbuilt for schools and administrators\b/i.test(cleaned)) {
    return "School administrators";
  }
  if (/\bteachers manage classes\b/i.test(cleaned)) {
    return "Teachers";
  }
  if (/\bparents use the portal\b/i.test(cleaned)) {
    return "Parents";
  }
  if (/\bprincipal\b/i.test(cleaned)) return "Principals";
  if (/\bschool owner\b/i.test(cleaned)) return "School owners";
  if (/\bfinance officer\b/i.test(cleaned)) return "Finance officers";
  if (/\bstudent\b/i.test(cleaned) && /\bportal\b/i.test(cleaned)) return "Students";
  if (/\bteacher\b/i.test(cleaned)) return "Teachers";
  if (/\bparent\b/i.test(cleaned)) return "Parents";
  if (/\badministrator\b/i.test(cleaned)) return "School administrators";
  if (/\bcoordinator\b/i.test(cleaned)) return "Academic coordinators";
  return null;
}

export function buildAudienceComposition(facts: ScoredFact[]): AudienceComposition {
  const overviewFacts = facts.filter((f) =>
    /\b(cloud|platform|school management|designed for|built for|adakaro is)\b/i.test(f.text)
  );
  const roleFacts = facts.filter((f) => extractRole(f.text));
  const contextFacts = facts.filter((f) =>
    /\b(primary|secondary|africa|country|region|school type)\b/i.test(f.text)
  );
  const keyFacts = facts.filter(
    (f) =>
      !overviewFacts.includes(f) &&
      !roleFacts.includes(f) &&
      !contextFacts.includes(f) &&
      f.relevanceScore >= 50
  );

  const introSource = overviewFacts[0]?.text ?? facts[0]?.text ?? "";
  const intro = ensureSentence(introSource);

  const roles: string[] = [];
  for (const fact of roleFacts) {
    const role = extractRole(fact.text);
    if (role && !roles.includes(role)) roles.push(role);
  }

  if (roles.length === 0) {
    for (const fact of facts) {
      const role = extractRole(fact.text);
      if (role && !roles.includes(role)) roles.push(role);
    }
  }

  const context =
    contextFacts.length > 0 ? ensureSentence(contextFacts[0]!.text) : "";

  return {
    intro,
    roles,
    context,
    keyFacts: keyFacts.slice(0, 4).map((f) => ensureSentence(f.text)),
  };
}

export function renderAudienceMarkdown(composition: AudienceComposition): string {
  const parts: string[] = [];

  if (composition.intro.trim()) {
    parts.push(`Overview\n\n${composition.intro}`);
  }

  if (composition.context.trim()) {
    parts.push(`Purpose\n\n${composition.context}`);
  }

  if (composition.roles.length > 0) {
    parts.push(`Suitable for\n\n${composition.roles.map((r) => `• ${r}`).join("\n")}`);
  }

  if (composition.keyFacts.length > 0) {
    parts.push(
      `Benefits\n\n${composition.keyFacts.map((f) => `• ${f.replace(/[.!?]$/, "")}`).join("\n")}`
    );
  }

  return parts.join("\n\n");
}
