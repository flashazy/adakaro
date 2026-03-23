/**
 * Supabase RPC returning `jsonb` sometimes arrives as a parsed object and
 * sometimes as a JSON string. Normalize so we always read school_id / name / currency.
 */
export function parseSchoolDashboardRpc(raw: unknown): {
  school_id: string;
  name: string;
  currency: string | null;
} | null {
  if (raw == null) return null;

  let value: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "null") return null;
    try {
      value = JSON.parse(t) as unknown;
    } catch {
      return null;
    }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const o = value as Record<string, unknown>;
  const schoolIdRaw = o.school_id;
  const nameRaw = o.name;
  const currencyRaw = o.currency;

  const school_id =
    typeof schoolIdRaw === "string"
      ? schoolIdRaw
      : schoolIdRaw != null
        ? String(schoolIdRaw)
        : "";
  const name =
    typeof nameRaw === "string" ? nameRaw.trim() : String(nameRaw ?? "").trim();

  if (!school_id) return null;

  let currency: string | null = null;
  if (currencyRaw != null && String(currencyRaw).trim() !== "") {
    currency = String(currencyRaw).trim();
  }

  return { school_id, name, currency };
}
