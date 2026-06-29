/**
 * Placeholder Guard — detects and strips template placeholder content from drafts.
 */

export const PLACEHOLDER_LINE_PATTERNS: RegExp[] = [
  /^-?\s*fact one\.?$/i,
  /^-?\s*fact two\.?$/i,
  /^-?\s*fact three\.?$/i,
  /^-?\s*capability one\.?$/i,
  /^-?\s*capability two\.?$/i,
  /^-?\s*example text\.?$/i,
  /^-?\s*example one\.?$/i,
  /^-?\s*insert here\.?$/i,
  /^-?\s*lorem ipsum/i,
  /^-?\s*todo\b/i,
  /^-?\s*tbd\b/i,
  /^-?\s*placeholder\b/i,
  /^-?\s*key fact about\b/i,
  /direct summary\.?$/i,
  /^.+ — direct summary\.?$/i,
];

export const PLACEHOLDER_CONTENT_PATTERNS: RegExp[] = [
  /\bfact one\b/i,
  /\bfact two\b/i,
  /\bcapability one\b/i,
  /\bexample text\b/i,
  /\blorem ipsum\b/i,
  /\bkey fact about\b/i,
  /\bdirect summary\b/i,
  /\binsert here\b/i,
  /\[\.\.\.\]/i,
  /\btodo\b/i,
  /\btbd\b/i,
  /\bplaceholder\b/i,
];

export function isPlaceholderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return PLACEHOLDER_LINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function containsPlaceholderContent(text: string): boolean {
  if (!text.trim()) return false;

  for (const line of text.split("\n")) {
    if (isPlaceholderLine(line)) return true;
  }

  return PLACEHOLDER_CONTENT_PATTERNS.some((pattern) => pattern.test(text));
}

export function stripPlaceholderLines(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  let previousWasHeading = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading = isSectionHeadingLine(trimmed);

    if (isPlaceholderLine(trimmed)) {
      previousWasHeading = false;
      continue;
    }

    if (isHeading) {
      kept.push(line);
      previousWasHeading = true;
      continue;
    }

    if (previousWasHeading && !trimmed) {
      kept.push(line);
      continue;
    }

    if (containsPlaceholderContent(trimmed) && trimmed.length < 80) {
      continue;
    }

    kept.push(line);
    previousWasHeading = false;
  }

  return removeEmptySections(
    kept
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function isSectionHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\*\*[^*]+\*\*$/.test(trimmed)) return true;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  return /^[A-Z][A-Za-z0-9 &/-]{2,48}$/.test(trimmed) && !/^[-•*]/.test(trimmed);
}

function normalizeHeadingLine(line: string): string {
  const trimmed = line.trim();
  const markdown = trimmed.match(/^\*\*([^*]+)\*\*$/);
  if (markdown) return markdown[1]!.trim();
  const hash = trimmed.match(/^#{1,6}\s+(.+)$/);
  if (hash) return hash[1]!.trim();
  return trimmed;
}

export function removeEmptySections(draft: string): string {
  const lines = draft.replace(/\r\n/g, "\n").split("\n");
  const kept: Array<{ heading: string | null; body: string[] }> = [];
  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  const flush = () => {
    const bodyText = currentBody.join("\n").trim();
    if (currentHeading) {
      if (bodyText && !containsPlaceholderContent(bodyText)) {
        kept.push({ heading: currentHeading, body: currentBody });
      }
    } else if (bodyText && !containsPlaceholderContent(bodyText)) {
      kept.push({ heading: null, body: currentBody });
    }
    currentHeading = null;
    currentBody = [];
  };

  for (const line of lines) {
    if (isSectionHeadingLine(line)) {
      flush();
      currentHeading = normalizeHeadingLine(line);
      continue;
    }
    currentBody.push(line);
  }
  flush();

  return kept
    .map(({ heading, body }) => {
      const bodyText = body.join("\n").trim();
      if (heading) return `${heading}\n\n${bodyText}`;
      return bodyText;
    })
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
