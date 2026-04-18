/** Join class names; omit falsy entries. */
export function cn(
  ...parts: (string | undefined | null | false)[]
): string {
  return parts.filter(Boolean).join(" ");
}

/** Trim and convert to uppercase for stored display names (e.g. subjects, classes). */
export function toUppercase(str: string): string {
  return str.trim().toUpperCase();
}
