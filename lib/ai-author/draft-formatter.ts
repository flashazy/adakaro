/**
 * Documentation draft formatter — preserves structure, spacing, and vertical lists.
 * Presentation-only; does not alter fact selection or scoring.
 */

import {
  autoFixProfessionalLanguage,
  autoFixTimelessWording,
} from "@/lib/ai-training/knowledge-language-improver";

const HEADING_LINE = /^(?:\*\*([^*]+)\*\*|#{1,6}\s+(.+)|([A-Z][A-Za-z0-9 &/-]{1,48}))$/;
const LIST_ITEM = /^(\s*)([-•*]|\d+\.)\s+/;

export interface DocumentationFormattingIssue {
  code: string;
  message: string;
}

export interface DocumentationFormattingResult {
  valid: boolean;
  issues: DocumentationFormattingIssue[];
}

/** Strip trailing whitespace per line; cap 3+ consecutive newlines to 2. */
export function normalizeDocumentationDraft(text: string): string {
  if (!text) return "";

  const lines = text.replace(/\r\n/g, "\n").split("\n").map((line) => line.replace(/[ \t]+$/g, ""));

  const normalized: string[] = [];
  let blankRun = 0;

  for (const line of lines) {
    if (!line.trim()) {
      blankRun += 1;
      if (blankRun <= 2) normalized.push("");
      continue;
    }
    blankRun = 0;
    normalized.push(line);
  }

  return normalized.join("\n").trim();
}

/** Compose one documentation section with heading spacing. */
export function composeSectionBlock(title: string, content: string): string {
  const heading = title.trim();
  const body = normalizeListLines(content.trim());
  if (!heading || !body) return body || heading;
  return `${heading}\n\n${body}`;
}

/** Ensure each list item occupies its own line. */
export function normalizeListLines(content: string): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push("");
      continue;
    }

    if (LIST_ITEM.test(line)) {
      result.push(line.replace(/[ \t]+$/g, ""));
      continue;
    }

    const inlineBullets = trimmed.match(/(?:^|[\s])•\s+/g);
    if (inlineBullets && inlineBullets.length > 1) {
      const parts = trimmed.split(/\s•\s+/);
      const first = parts.shift() ?? "";
      if (first.trim()) result.push(first.trim());
      for (const part of parts) {
        if (part.trim()) result.push(`• ${part.trim()}`);
      }
      continue;
    }

    result.push(line.replace(/[ \t]+$/g, ""));
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\*\*[^*]+\*\*$/.test(trimmed)) return true;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  return HEADING_LINE.test(trimmed) && !LIST_ITEM.test(trimmed);
}

function polishLine(line: string): string {
  const listMatch = line.match(/^(\s*)([-•*]|\d+\.)\s+(.*)$/);
  if (listMatch) {
    const [, indent = "", marker, body] = listMatch;
    const polished = autoFixTimelessWording(autoFixProfessionalLanguage(body ?? ""));
    return `${indent}${marker} ${polished}`.replace(/[ \t]+$/g, "");
  }

  if (isHeadingLine(line)) {
    return line.replace(/[ \t]+$/g, "");
  }

  return autoFixTimelessWording(autoFixProfessionalLanguage(line)).replace(/[ \t]+$/g, "");
}

/** Apply language polish block-by-block without collapsing newlines. */
export function polishDocumentationDraft(draft: string): string {
  const normalized = normalizeDocumentationDraft(draft);
  if (!normalized) return "";

  const blocks = normalized.split(/\n\n/);
  const polishedBlocks = blocks.map((block) => {
    const lines = block.split("\n");
    return lines.map((line) => (line.trim() ? polishLine(line) : "")).join("\n");
  });

  return ensureSectionSpacing(polishedBlocks.filter((b) => b.trim()).join("\n\n"));
}

/** Ensure blank line after headings and between sections. */
export function ensureSectionSpacing(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    result.push(line.replace(/[ \t]+$/g, ""));

    if (!isHeadingLine(line)) continue;

    const next = lines[i + 1];
    if (next !== undefined && next.trim() !== "") {
      result.push("");
    }
  }

  return normalizeDocumentationDraft(result.join("\n"));
}

export function validateDocumentationFormatting(text: string): DocumentationFormattingResult {
  const issues: DocumentationFormattingIssue[] = [];
  const normalized = text.replace(/\r\n/g, "\n");

  if (!normalized.trim()) {
    return { valid: true, issues };
  }

  const inlineBulletWall = /\.\s+•\s+\S/.test(normalized);
  if (inlineBulletWall) {
    issues.push({
      code: "inline_bullets",
      message: "List items appear inline instead of on separate lines.",
    });
  }

  const sections = normalized.split(/\n\n+/).filter((b) => b.trim());
  let previousWasHeadingBlock = false;

  for (const block of sections) {
    const firstLine = block.split("\n")[0]?.trim() ?? "";
    const isHeadingBlock = isHeadingLine(firstLine);

    if (isHeadingBlock) {
      const rest = block.split("\n").slice(1).join("\n").trim();
      if (previousWasHeadingBlock && !rest) {
        issues.push({
          code: "adjacent_headings",
          message: "Adjacent section headings without body content.",
        });
      }
      if (rest && !block.includes("\n\n") && rest.includes("•") && rest.includes(". •")) {
        issues.push({
          code: "collapsed_list",
          message: "Section list may be collapsed into a single paragraph.",
        });
      }
      previousWasHeadingBlock = true;
    } else {
      previousWasHeadingBlock = false;
    }
  }

  const headingMatches = [...normalized.matchAll(/^(?:\*\*([^*]+)\*\*|([A-Z][A-Za-z0-9 &/-]{2,}))$/gm)];
  for (let i = 1; i < headingMatches.length; i++) {
    const prevEnd = (headingMatches[i - 1]?.index ?? 0) + (headingMatches[i - 1]?.[0]?.length ?? 0);
    const gap = normalized.slice(prevEnd, headingMatches[i]?.index ?? 0);
    if (!/\n\n/.test(gap) && gap.trim().length > 0) {
      issues.push({
        code: "missing_section_gap",
        message: "Sections should be separated by a blank line.",
      });
      break;
    }
  }

  return { valid: issues.length === 0, issues };
}

/** Final pass before displaying or saving a generated draft. */
export function formatGeneratedDraft(draft: string): string {
  const spaced = ensureSectionSpacing(normalizeListLines(draft));
  const polished = polishDocumentationDraft(spaced);
  return normalizeDocumentationDraft(polished);
}
