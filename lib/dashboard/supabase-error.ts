/**
 * Human-readable Supabase / PostgREST errors for server UI and logs.
 */

export function describeSupabaseError(err: unknown): string | null {
  if (err == null) return null;
  if (typeof err === "string") return err;

  const o = err as Record<string, unknown>;
  const message = typeof o.message === "string" ? o.message : "";
  const code = o.code != null ? String(o.code) : "";
  const details = o.details != null ? String(o.details) : "";
  const hint = o.hint != null ? String(o.hint) : "";

  const parts = [message, code, details, hint].filter((x) => x.length > 0);
  if (parts.length > 0) {
    return parts.join(" — ");
  }

  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown database error (no message).";
  }
}

export function combineSupabaseErrors(errors: unknown[]): string | null {
  const lines = errors
    .map(describeSupabaseError)
    .filter((x): x is string => x != null && x.length > 0);
  if (lines.length === 0) return null;
  return lines.join("\n\n");
}
