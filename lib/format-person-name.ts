/**
 * Person / display-name title case — same rules as the admin “Add student” form.
 * Trims runs of spaces, capitalizes first letter of each word (including after
 * hyphens), handles apostrophes (e.g. O'Connor). Empty or whitespace-only input
 * is returned unchanged.
 */

/** Title-case one segment (handles O'Connor-style apostrophes). */
function capitalizeNameSegment(segment: string): string {
  if (!segment) return segment;
  const lower = segment.toLowerCase();
  if (lower.includes("'")) {
    return lower
      .split("'")
      .map((part) =>
        part ? part.charAt(0).toUpperCase() + part.slice(1) : ""
      )
      .join("'");
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Title-case a single whitespace-delimited word (handles hyphens). */
function capitalizeNameWord(word: string): string {
  if (!word) return word;
  if (word.includes("-")) {
    return word.split("-").map(capitalizeNameSegment).join("-");
  }
  return capitalizeNameSegment(word);
}

/**
 * Trim outer whitespace, collapse internal runs of spaces to single spaces,
 * and title-case each word (first letter upper, rest lower per segment).
 */
export function formatPersonName(str: string): string {
  if (!str.trim()) return str;
  return str
    .trim()
    .split(/\s+/)
    .map(capitalizeNameWord)
    .join(" ");
}
