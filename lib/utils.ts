/** Join class names; omit falsy entries. */
export function cn(
  ...parts: (string | undefined | null | false)[]
): string {
  return parts.filter(Boolean).join(" ");
}
