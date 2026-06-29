/**
 * Documentation composition writer — turns clustered facts into enterprise prose.
 * Never invents facts; only reorganizes and merges accepted content.
 */

import { composeSectionBlock } from "./draft-formatter";
import {
  classifyFact,
  clusterFacts,
  collectAudienceRoles,
  extractAudienceRole,
  tokenSimilarity,
  type FactCluster,
} from "./fact-cluster";
import { containsPlaceholderContent, isPlaceholderLine } from "./placeholder-guard";
import type { AuthorIntent, ExpectedAnswerType, ScoredFact } from "./types";

export interface ComposedDocumentation {
  sections: Array<{ title: string; content: string; factIds: string[] }>;
  draft: string;
  issues: string[];
}

function cleanText(text: string): string {
  return text.trim().replace(/^[-•*]\s+/, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

function ensureSentence(text: string): string {
  const trimmed = cleanText(text);
  if (!trimmed || isPlaceholderLine(trimmed) || containsPlaceholderContent(trimmed)) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function dropProductPrefix(text: string): string {
  return text
    .replace(/^Adakaro (includes|supports|provides|has|offers|enables|manages)\s+/i, "")
    .replace(/^Adakaro is\s+/i, "")
    .trim();
}

function mergeSimilarFacts(facts: ScoredFact[]): ScoredFact[] {
  const sorted = [...facts].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const groups: ScoredFact[][] = [];

  for (const fact of sorted) {
    const group = groups.find(
      (g) => tokenSimilarity(g[0]!.tokens, fact.tokens) >= 0.55
    );
    if (group) group.push(fact);
    else groups.push([fact]);
  }

  return groups.map((group) => {
    if (group.length === 1) return group[0]!;
    return {
      ...group[0]!,
      text: combineSentences(group.map((f) => f.text)),
      relevanceScore: Math.max(...group.map((f) => f.relevanceScore)),
    };
  });
}

function combineSentences(sentences: string[]): string {
  const cleaned = sentences.map(cleanText).filter(Boolean);
  if (cleaned.length === 1) return cleaned[0]!;

  const sorted = [...cleaned].sort((a, b) => b.length - a.length);
  let result = sorted[0]!.replace(/\.\s*$/, "");

  for (const other of sorted.slice(1)) {
    const otherLower = other.toLowerCase();
    const resultLower = result.toLowerCase();
    if (resultLower.includes(otherLower.replace(/\.$/, "").slice(0, 18))) continue;

    if (/\bcloud[- ]based\b/i.test(result) && /\bonline\b/i.test(other)) {
      if (!/\bonline\b/i.test(result)) result = `${result} that runs online`;
      continue;
    }

    if (/\b(is a|is an)\b/i.test(result)) {
      const clause = dropProductPrefix(other).replace(/\.\s*$/, "");
      if (clause.length > 8 && !resultLower.includes(clause.toLowerCase().slice(0, 14))) {
        result = `${result} ${clause}`.replace(/\s+/g, " ");
      }
      continue;
    }

    if (!resultLower.includes(otherLower.slice(0, 16))) {
      const addition = dropProductPrefix(other).replace(/\.\s*$/, "");
      if (addition.length > 6) {
        result = `${result}, and ${addition.charAt(0).toLowerCase()}${addition.slice(1)}`;
      }
    }
  }

  return ensureSentence(result);
}

function writeParagraph(facts: ScoredFact[]): string {
  const merged = mergeSimilarFacts(facts);
  if (merged.length === 0) return "";
  if (merged.length === 1) return ensureSentence(merged[0]!.text);

  const sentences = merged.map((f, index) => {
    let text = ensureSentence(f.text);
    if (index > 0) {
      text = text.replace(/^Adakaro\b/, "It");
    }
    return text;
  });

  return sentences.join(" ");
}

function formatCapabilityBullet(text: string): string {
  let line = cleanText(text);
  line = dropProductPrefix(line);
  line = line.replace(
    /^(teachers?|parents?|students?|administrators?|principals?|finance officers?|school owners?)\s+/i,
    ""
  );
  line = line.replace(/^(includes|supports|provides|has|offers|enables|manages)\s+/i, "");
  line = line.replace(/\.$/, "");
  if (!line) return "";
  return line.charAt(0).toUpperCase() + line.slice(1);
}

function formatBenefitBullet(text: string): string {
  let line = cleanText(text);
  line = dropProductPrefix(line);
  line = line.replace(/\.$/, "");
  if (!line) return "";
  if (!/^(saves|reduces|improves|streamlines|centralizes|enables|provides)/i.test(line)) {
    if (/\b(time|accuracy|communication|operations|administration)\b/i.test(line)) {
      return line.charAt(0).toUpperCase() + line.slice(1);
    }
  }
  return line.charAt(0).toUpperCase() + line.slice(1);
}

function writeBulletList(
  facts: ScoredFact[],
  formatter: (text: string) => string
): string[] {
  const merged = mergeSimilarFacts(facts);
  const lines: string[] = [];

  for (const fact of merged) {
    const formatted = formatter(fact.text);
    if (!formatted) continue;
    const bullet = `• ${formatted}`;
    if (!lines.some((l) => l.toLowerCase() === bullet.toLowerCase())) {
      lines.push(bullet);
    }
  }

  return lines;
}

function reassignMisplacedFacts(
  clusters: Map<FactCluster, ScoredFact[]>
): Map<FactCluster, ScoredFact[]> {
  const result = new Map(clusters);

  const benefits = result.get("benefits") ?? [];
  const keptBenefits: ScoredFact[] = [];
  const movedToCapabilities: ScoredFact[] = [];

  for (const fact of benefits) {
    const text = cleanText(fact.text);
    if (extractAudienceRole(text)) {
      const audience = result.get("audience") ?? [];
      audience.push(fact);
      result.set("audience", audience);
    } else if (/\b(includes|finance|attendance|module|portal|assistant)\b/i.test(text)) {
      movedToCapabilities.push(fact);
    } else {
      keptBenefits.push(fact);
    }
  }
  result.set("benefits", keptBenefits);

  if (movedToCapabilities.length > 0) {
    const capabilities = result.get("capabilities") ?? [];
    result.set("capabilities", [...capabilities, ...movedToCapabilities]);
  }

  const audienceFacts = result.get("audience") ?? [];
  const keptAudience: ScoredFact[] = [];
  for (const fact of audienceFacts) {
    const text = cleanText(fact.text);
    if (/\b(includes|finance|attendance|module|feature|supports)\b/i.test(text)) {
      const capabilities = result.get("capabilities") ?? [];
      capabilities.push(fact);
      result.set("capabilities", capabilities);
    } else {
      keptAudience.push(fact);
    }
  }
  result.set("audience", keptAudience);

  const identity = result.get("identity") ?? [];
  const keptIdentity: ScoredFact[] = [];
  for (const fact of identity) {
    const text = cleanText(fact.text);
    if (/\b(helps|designed to|simplify|digitize|solve)\b/i.test(text) && !/\bis a\b/i.test(text)) {
      const purpose = result.get("purpose") ?? [];
      purpose.push(fact);
      result.set("purpose", purpose);
    } else {
      keptIdentity.push(fact);
    }
  }
  result.set("identity", keptIdentity);

  return result;
}

function assignOrphans(
  clusters: Map<FactCluster, ScoredFact[]>,
  allFacts: ScoredFact[]
): Map<FactCluster, ScoredFact[]> {
  const assigned = new Set<string>();
  for (const facts of clusters.values()) {
    for (const fact of facts) assigned.add(fact.id);
  }

  const orphans = allFacts.filter((f) => !assigned.has(f.id));
  if (orphans.length === 0) return clusters;

  const result = new Map(clusters);
  const notes = result.get("notes") ?? [];

  for (const fact of orphans) {
    const cluster = classifyFact(fact);
    const list = result.get(cluster) ?? [];
    list.push(fact);
    result.set(cluster, list);
    assigned.add(fact.id);
  }

  const stillOrphan = allFacts.filter((f) => !assigned.has(f.id));
  if (stillOrphan.length > 0) {
    result.set("notes", [...notes, ...stillOrphan]);
  }

  return result;
}

function validateComposition(sections: Array<{ title: string; content: string }>): string[] {
  const issues: string[] = [];

  for (const section of sections) {
    const content = section.content.toLowerCase();

    if (section.title === "Suitable for") {
      if (/\b(finance|attendance|module|includes|supports|feature)\b/.test(content)) {
        issues.push("Audience section contains capability language.");
      }
    }

    if (section.title === "Benefits") {
      if (/\b(includes|module|portal|assistant|finance|attendance)\b/.test(content)) {
        issues.push("Benefits section contains product features instead of outcomes.");
      }
      if (/\banswer questions\b/.test(content)) {
        issues.push("Benefits section contains AI behavior instead of user outcomes.");
      }
    }

    if (section.title === "Overview") {
      if (/\b(helps|designed to|simplify)\b/.test(content) && !/\b(is a|is an|platform|system)\b/.test(content)) {
        issues.push("Overview section contains purpose language without product definition.");
      }
    }
  }

  return issues;
}

const SECTION_ORDER = [
  "Overview",
  "Purpose",
  "Suitable for",
  "Key capabilities",
  "Benefits",
  "Notes",
] as const;

export function composeDocumentation(input: {
  facts: ScoredFact[];
  expectedAnswerType: ExpectedAnswerType;
  intent: AuthorIntent;
}): ComposedDocumentation {
  const sortedFacts = [...input.facts].sort((a, b) => b.relevanceScore - a.relevanceScore);
  let clusters = clusterFacts(sortedFacts);
  clusters = reassignMisplacedFacts(clusters);
  clusters = assignOrphans(clusters, sortedFacts);

  const sections: Array<{ title: string; content: string; factIds: string[] }> = [];

  const identityFacts = [
    ...(clusters.get("identity") ?? []),
    ...(clusters.get("deployment") ?? []).filter((f) =>
      /\b(online|cloud|hosted)\b/i.test(f.text)
    ),
  ];
  if (identityFacts.length > 0) {
    const content = writeParagraph(identityFacts);
    if (content) {
      sections.push({
        title: "Overview",
        content,
        factIds: identityFacts.map((f) => f.id),
      });
    }
  }

  const purposeFacts = clusters.get("purpose") ?? [];
  if (purposeFacts.length > 0) {
    const content = writeParagraph(purposeFacts);
    if (content) {
      sections.push({
        title: "Purpose",
        content,
        factIds: purposeFacts.map((f) => f.id),
      });
    }
  }

  const audienceRoles = collectAudienceRoles(sortedFacts);
  const audienceFacts = clusters.get("audience") ?? [];
  if (audienceRoles.length > 0) {
    sections.push({
      title: "Suitable for",
      content: audienceRoles.map((r) => `• ${r}`).join("\n"),
      factIds: audienceFacts.map((f) => f.id),
    });
  }

  const capabilityFacts = [
    ...(clusters.get("capabilities") ?? []),
    ...(input.intent === "capabilities" ? clusters.get("deployment") ?? [] : []),
  ];
  if (capabilityFacts.length > 0) {
    const bullets = writeBulletList(capabilityFacts, formatCapabilityBullet);
    if (bullets.length > 0) {
      sections.push({
        title: "Key capabilities",
        content: bullets.join("\n"),
        factIds: capabilityFacts.map((f) => f.id),
      });
    }
  }

  const benefitFacts = clusters.get("benefits") ?? [];
  if (benefitFacts.length > 0) {
    const bullets = writeBulletList(benefitFacts, formatBenefitBullet);
    if (bullets.length > 0) {
      sections.push({
        title: "Benefits",
        content: bullets.join("\n"),
        factIds: benefitFacts.map((f) => f.id),
      });
    }
  }

  const noteFacts = [
    ...(clusters.get("notes") ?? []),
    ...(clusters.get("permissions") ?? []),
    ...(clusters.get("security") ?? []),
    ...(input.intent === "pricing" ? clusters.get("pricing") ?? [] : []),
  ].filter(
    (fact, index, list) => list.findIndex((f) => f.id === fact.id) === index
  );

  const usedIds = new Set(sections.flatMap((s) => s.factIds));
  const remainingNotes = noteFacts.filter((f) => !usedIds.has(f.id));
  if (remainingNotes.length > 0) {
    const bullets = writeBulletList(remainingNotes, (text) => formatCapabilityBullet(text));
    if (bullets.length > 0) {
      sections.push({
        title: "Notes",
        content: bullets.join("\n"),
        factIds: remainingNotes.map((f) => f.id),
      });
    }
  }

  if (sections.length === 0 && sortedFacts.length > 0) {
    const overview = writeParagraph(sortedFacts.slice(0, 2));
    const rest = sortedFacts.slice(2);
    if (overview) {
      sections.push({
        title: "Overview",
        content: overview,
        factIds: sortedFacts.slice(0, 2).map((f) => f.id),
      });
    }
    if (rest.length > 0) {
      const bullets = writeBulletList(rest, formatCapabilityBullet);
      sections.push({
        title: "Notes",
        content: bullets.join("\n"),
        factIds: rest.map((f) => f.id),
      });
    }
  }

  const ordered = SECTION_ORDER.flatMap((title) =>
    sections.filter((s) => s.title === title)
  );
  const extras = sections.filter((s) => !SECTION_ORDER.includes(s.title as (typeof SECTION_ORDER)[number]));
  const finalSections = [...ordered, ...extras];

  const draft = finalSections
    .filter((s) => s.content.trim())
    .map((s) => composeSectionBlock(s.title, s.content))
    .join("\n\n");

  const issues = validateComposition(finalSections);

  return { sections: finalSections, draft, issues };
}
