/** True when `redirect()` was called inside a Server Action or Server Component. */
export function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest: unknown }).digest === "string" &&
    String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}
