/**
 * School subject codes: PREFIX-NUM with PREFIX = first 3 letters of the name
 * (non-letters stripped), uppercase. Shared by dashboard subject forms and
 * server actions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** First 3 letters of the subject name (non-letters stripped), uppercased. */
export function subjectCodePrefixFromName(name: string): string {
  const letters = name.trim().replace(/[^a-zA-Z]/g, "");
  if (!letters) return "SUB";
  return letters.slice(0, 3).toUpperCase();
}

/** Trailing numeric segment after the last hyphen (e.g. ENG-101 → "101"). */
export function parseSubjectCodeNumericSuffix(code: string): string {
  const m = code.trim().match(/-(\d+)\s*$/);
  return m ? m[1] : "101";
}

/** Client preview / default before server resolves collisions (always ends with -101). */
export function generateSubjectCodeDisplay(name: string): string {
  return `${subjectCodePrefixFromName(name)}-101`;
}

/**
 * Reserves a unique `PREFIX-N` code for this school. If `preferredCode` matches
 * `PREFIX-\\d+`, starts from that number; otherwise if `preferredCode` looks like
 * a manual code (different prefix), it is returned unchanged.
 */
export async function resolveSubjectCodeForSave(
  admin: SupabaseClient<Database>,
  schoolId: string,
  name: string,
  preferredCode: string | null,
  reservedFullCodes: Set<string> = new Set(),
  /** When updating a row, ignore that row’s code so the same PREFIX-N can stay. */
  excludeSubjectId?: string
): Promise<string> {
  const prefix = subjectCodePrefixFromName(name);
  const trimmed = (preferredCode ?? "").trim();
  const matchesAuto = new RegExp(`^${escapeRegex(prefix)}-\\d+$`, "i").test(
    trimmed
  );
  if (trimmed && !matchesAuto) {
    return trimmed;
  }

  let startNum = 101;
  if (matchesAuto) {
    const m = trimmed.match(/-(\d+)\s*$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n)) startNum = n;
    }
  }

  const { data } = await admin
    .from("subjects")
    .select("id, code")
    .eq("school_id", schoolId);

  const usedNums = new Set<number>();
  for (const row of data ?? []) {
    const rid = (row as { id: string; code: string | null }).id;
    if (excludeSubjectId && rid === excludeSubjectId) continue;
    const c = (row as { code: string | null }).code?.trim();
    if (!c) continue;
    const m = c.match(new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`, "i"));
    if (m) usedNums.add(parseInt(m[1], 10));
  }
  for (const c of reservedFullCodes) {
    const m = c.trim().match(new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`, "i"));
    if (m) usedNums.add(parseInt(m[1], 10));
  }

  let n = startNum;
  while (usedNums.has(n)) n += 1;
  return `${prefix}-${n}`;
}
