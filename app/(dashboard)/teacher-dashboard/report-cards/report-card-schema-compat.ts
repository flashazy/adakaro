/** PostgREST / Postgres errors when the live DB is behind repo migrations. */
export function isMissingColumnSchemaError(err: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!err) return false;
  const c = err.code ?? "";
  const m = (err.message ?? "").toLowerCase();
  return (
    c === "PGRST204" ||
    c === "42703" ||
    m.includes("does not exist") ||
    m.includes("schema cache")
  );
}
