/**
 * Semantic answer structure detection — recognizes logical sections
 * without requiring fixed heading titles.
 */

export interface DetectedSection {
  title: string;
  format: "markdown-bold" | "markdown-heading" | "colon-title" | "plain-title";
}

const LOGICAL_SECTION_KEYWORDS = new Set([
  "overview",
  "purpose",
  "users",
  "capabilities",
  "modules",
  "deployment",
  "permissions",
  "notes",
  "examples",
  "additional information",
  "core facts",
  "key capabilities",
  "benefits",
  "limitations",
  "related features",
  "access",
  "configuration",
  "requirements",
  "summary",
  "background",
  "features",
  "workflow",
  "steps",
  "usage",
  "availability",
  "audience",
  "prerequisites",
  "related topics",
]);

function isTitleCaseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 50) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  if (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.startsWith("*")) return false;
  return /^[A-Z][A-Za-z0-9]+(?: [A-Z][A-Za-z0-9]+){0,5}$/.test(trimmed);
}

/** Extract logical sections from markdown, bold, colon, or plain titles. */
export function detectSemanticSections(answer: string): DetectedSection[] {
  const found: DetectedSection[] = [];
  const seen = new Set<string>();

  const add = (title: string, format: DetectedSection["format"]) => {
    const key = title.toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    found.push({ title: title.trim(), format });
  };

  for (const match of answer.matchAll(/^\*\*([^*]+)\*\*\s*$/gm)) {
    add(match[1], "markdown-bold");
  }

  for (const match of answer.matchAll(/^#{1,3}\s+(.+?)\s*$/gm)) {
    add(match[1], "markdown-heading");
  }

  for (const match of answer.matchAll(/^([A-Za-z][A-Za-z0-9 &/()-]{2,50}):\s*$/gm)) {
    add(match[1], "colon-title");
  }

  for (const line of answer.split("\n")) {
    const trimmed = line.trim();
    if (isTitleCaseLine(trimmed)) {
      add(trimmed, "plain-title");
    }
  }

  return found;
}

export function hasSemanticStructure(answer: string): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return false;
  if (trimmed.length < 120) return true;

  const sections = detectSemanticSections(trimmed);
  if (sections.length >= 2) return true;

  const hasBullets = /(^|\n)\s*[-•*]\s+\S/m.test(trimmed);
  if (sections.length >= 1 && hasBullets) return true;

  const logicalHeadings = sections.filter((s) =>
    LOGICAL_SECTION_KEYWORDS.has(s.title.toLowerCase())
  );
  if (logicalHeadings.length >= 1 && hasBullets) return true;

  const blocks = trimmed.split(/\n\n+/).filter((b) => b.trim().length > 30);
  if (blocks.length >= 3 && hasBullets) return true;

  return false;
}

export function describeStructureGap(answer: string): string {
  const sections = detectSemanticSections(answer);
  if (sections.length === 0) {
    return "Add logical sections (e.g. Overview, Purpose, Capabilities) using headings or bold titles.";
  }
  if (sections.length === 1) {
    return `Only one section detected ("${sections[0].title}"). Add at least one more (e.g. Capabilities, Permissions, Notes).`;
  }
  return "Organize content into multiple logical sections with headings or bullet lists.";
}
