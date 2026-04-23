/** Grouping / filter key: trimmed `subject` text column, empty → "Subject". */
export function subjectTextKey(subject: string | null | undefined): string {
  const t = (subject ?? "").trim();
  return t || "Subject";
}
