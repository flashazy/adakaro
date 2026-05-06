/** Remove trailing `/` from a URL or path (no regex — safe for any origin string). */
export function stripTrailingSlash(url: string): string {
  let s = url;
  while (s.endsWith("/")) {
    s = s.slice(0, -1);
  }
  return s;
}

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
