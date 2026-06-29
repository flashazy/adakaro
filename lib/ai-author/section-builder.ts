/**
 * Draft Assembler — builds sections from scored facts with deduplication.
 */

import type { QuestionContext } from "./context-engine";
import { getSectionPlan } from "./intent-router";
import type { DraftSection, ScoredFact } from "./types";

const SECTION_KEYWORDS: Record<string, string[]> = {
  Overview: ["overview", "platform", "adakaro is", "summary", "purpose", "cloud"],
  Audience: ["school", "administrator", "teacher", "parent", "built for", "audience", "users", "principal"],
  Purpose: ["purpose", "mission", "helps", "addresses", "designed"],
  "Key Facts": ["includes", "supports", "provides", "manages", "contains", "fact"],
  Capabilities: ["capability", "feature", "module", "supports", "provides", "includes", "enables"],
  Modules: ["module", "attendance", "finance", "portal", "enrollment", "report"],
  Benefits: ["benefit", "reduces", "improves", "enables", "helps", "streamline"],
  Requirements: ["require", "access", "permission", "role", "before", "prerequisite", "administrator"],
  Steps: ["step", "click", "open", "navigate", "configure", "import", "upload", "select", "create"],
  "Expected Result": ["result", "after", "will", "completed", "success", "outcome"],
  Plans: ["plan", "pricing", "tier", "subscription", "cost", "free", "paid"],
  Limits: ["limit", "quota", "maximum", "up to", "cap"],
  Billing: ["billing", "invoice", "payment", "cycle", "charge"],
  Configuration: ["configure", "setting", "option", "setup", "parameter"],
  Examples: ["example", "such as", "for instance", "sample"],
  "Related Features": ["related", "see also", "module", "feature", "portal"],
  "Related Topics": ["related", "see also", "topic", "lesson"],
  "Related Tasks": ["related", "next", "also", "task"],
  "Related Lessons": ["related", "lesson", "see also"],
  "How it Works": ["works", "process", "workflow", "flow", "operates"],
  "Important Notes": ["note", "important", "constraint", "limitation", "caution"],
};

function sectionMatchScore(sectionTitle: string, fact: ScoredFact): number {
  const keywords = SECTION_KEYWORDS[sectionTitle] ?? [];
  const hint = fact.sectionHint?.toLowerCase() ?? "";
  const title = sectionTitle.toLowerCase();

  if (hint && (hint.includes(title) || title.includes(hint))) return 100;

  let score = 0;
  const text = fact.normalizedText;
  for (const kw of keywords) {
    if (text.includes(kw)) score += 20;
  }
  return Math.min(100, score);
}

function tokenSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const matches = a.filter((t) => setB.has(t)).length;
  return matches / Math.max(a.length, b.length);
}

function mergeFactTexts(a: string, b: string): string {
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.toLowerCase().includes(shorter.toLowerCase().slice(0, 20))) return longer;
  return longer;
}

export function deduplicateFacts(facts: ScoredFact[]): {
  facts: ScoredFact[];
  duplicatesRemoved: number;
} {
  const sorted = [...facts].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const kept: ScoredFact[] = [];
  let duplicatesRemoved = 0;

  for (const fact of sorted) {
    const similarIndex = kept.findIndex(
      (existing) => tokenSimilarity(existing.tokens, fact.tokens) >= 0.65
    );

    if (similarIndex >= 0) {
      kept[similarIndex] = {
        ...kept[similarIndex],
        text: mergeFactTexts(kept[similarIndex].text, fact.text),
        relevanceScore: Math.max(kept[similarIndex].relevanceScore, fact.relevanceScore),
      };
      duplicatesRemoved += 1;
    } else {
      kept.push(fact);
    }
  }

  return { facts: kept, duplicatesRemoved };
}

export function assignFactsToSections(
  sectionPlan: string[],
  facts: ScoredFact[]
): Map<string, ScoredFact[]> {
  const assignments = new Map<string, ScoredFact[]>();
  for (const title of sectionPlan) {
    assignments.set(title, []);
  }

  const used = new Set<string>();

  for (const title of sectionPlan) {
    const candidates = facts
      .filter((f) => !used.has(f.id))
      .map((f) => ({ fact: f, score: sectionMatchScore(title, f) + f.relevanceScore * 0.35 }))
      .sort((a, b) => b.score - a.score);

    const sectionFacts = candidates
      .filter((c) => c.score >= 35 || title === "Overview")
      .slice(0, title === "Steps" ? 6 : 4)
      .map((c) => c.fact);

    for (const fact of sectionFacts) {
      used.add(fact.id);
      assignments.get(title)!.push(fact);
    }
  }

  const remaining = facts.filter((f) => !used.has(f.id));
  if (remaining.length > 0) {
    const keyFacts = assignments.get("Key Facts") ?? assignments.get("Overview");
    if (keyFacts) {
      keyFacts.push(...remaining.slice(0, 3));
    }
  }

  return assignments;
}

export function assembleDraftSections(
  questionContext: QuestionContext,
  facts: ScoredFact[],
  structure?: string
): { sections: DraftSection[]; factsUsed: ScoredFact[]; duplicatesRemoved: number } {
  const sectionPlan = getSectionPlan(questionContext.route.intent, structure);
  const { facts: dedupedFacts, duplicatesRemoved } = deduplicateFacts(facts);
  const assignments = assignFactsToSections(sectionPlan, dedupedFacts);

  const sections: DraftSection[] = [];
  const factsUsed: ScoredFact[] = [];

  for (const title of sectionPlan) {
    const sectionFacts = assignments.get(title) ?? [];
    if (sectionFacts.length === 0) continue;

    const lines = sectionFacts.map((f) => {
      factsUsed.push(f);
      const line = f.text.trim();
      return title === "Steps" || questionContext.route.expectedAnswerType === "step_by_step"
        ? line.match(/^\d+\./)
          ? line
          : `- ${line}`
        : line.startsWith("-")
          ? line
          : `- ${line}`;
    });

    const uniqueLines = [...new Set(lines)];
    const content =
      title === "Overview" && uniqueLines.length === 1
        ? uniqueLines[0]!.replace(/^- /, "")
        : uniqueLines.join("\n");

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
  }

  return { sections, factsUsed, duplicatesRemoved };
}

export function renderDraftMarkdown(sections: DraftSection[]): string {
  return sections
    .map((section) => `**${section.title}**\n\n${section.content}`)
    .join("\n\n");
}
