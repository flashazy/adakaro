/** Collapse whitespace for syllabus titles (trim + single spaces). */
export function collapseSyllabusWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Case-insensitive duplicate key — ignores extra spaces. */
export function syllabusTextKey(value: string): string {
  return collapseSyllabusWhitespace(value).toLowerCase();
}

/** Topic display/storage: UPPERCASE (e.g. "Sunna na Hadithi" → "SUNNA NA HADITHI"). */
export function formatSyllabusTopicTitle(value: string): string {
  return collapseSyllabusWhitespace(value).toUpperCase();
}

function capitalizeTitleCaseWord(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  const apostrophe = lower.match(/^([^'ʼ`´]*)(['ʼ`´])(.*)$/);
  if (apostrophe) {
    const [, before, sep, after] = apostrophe;
    const head = before
      ? before.charAt(0).toUpperCase() + before.slice(1)
      : "";
    return head + sep + after;
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Subtopic display/storage: Title Case per word (e.g. "umuhimu wa sunna" → "Umuhimu Wa Sunna").
 * Preserves apostrophes: "kushuka kwa qur'an" → "Kushuka Kwa Qur'an".
 */
export function formatSyllabusSubtopicTitle(value: string): string {
  const collapsed = collapseSyllabusWhitespace(value);
  if (!collapsed) return collapsed;
  return collapsed.split(" ").map(capitalizeTitleCaseWord).join(" ");
}
