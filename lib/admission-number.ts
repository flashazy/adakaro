import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export const ADMISSION_PREFIX_PATTERN = /^[A-Z]{3,4}$/;

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Letters-only stem from a school name (UI hint; not guaranteed unique). */
export function deriveLocalPrefixStem(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (letters.length < 3) {
    return (letters + "XXX").slice(0, 3);
  }
  return letters.slice(0, 4);
}

export function normalizeAdmissionPrefixInput(raw: string): string {
  return raw.trim().toUpperCase();
}

export async function generateAdmissionNumber(
  schoolId: string
): Promise<string> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  return generateAdmissionNumberWithClient(supabase, schoolId);
}

export async function generateAdmissionNumberWithClient(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("get_next_admission_number", {
    p_school_id: schoolId,
  } as never);
  if (error) {
    throw new Error(error.message);
  }
  const text = data as string | null | undefined;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Could not generate admission number.");
  }
  return text.trim();
}

export async function peekNextAdmissionNumber(
  schoolId: string
): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  return peekNextAdmissionNumberWithClient(supabase, schoolId);
}

export async function peekNextAdmissionNumberWithClient(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("peek_next_admission_number", {
    p_school_id: schoolId,
  } as never);
  if (error) {
    console.error("[peekNextAdmissionNumber]", error.message);
    return null;
  }
  const text = data as string | null | undefined;
  if (typeof text !== "string" || !text.trim()) {
    return null;
  }
  return text.trim();
}

export async function suggestPrefix(schoolName: string): Promise<string> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_unique_prefix", {
    p_school_name: schoolName.trim(),
  } as never);
  if (error) {
    throw new Error(error.message);
  }
  const text = data as string | null | undefined;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Could not suggest a prefix.");
  }
  return text.trim();
}

export async function checkPrefixAvailable(
  prefix: string,
  excludeSchoolId?: string | null
): Promise<boolean> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  return checkPrefixAvailableWithClient(
    supabase,
    prefix,
    excludeSchoolId ?? null
  );
}

export async function checkPrefixAvailableWithClient(
  supabase: SupabaseClient<Database>,
  prefix: string,
  excludeSchoolId: string | null
): Promise<boolean> {
  const p = normalizeAdmissionPrefixInput(prefix);
  if (!ADMISSION_PREFIX_PATTERN.test(p)) {
    return false;
  }
  let qb = supabase
    .from("schools")
    .select("id")
    .eq("admission_prefix", p);
  if (excludeSchoolId) {
    qb = qb.neq("id", excludeSchoolId);
  }
  const { data, error } = await qb.maybeSingle();
  if (error) {
    console.error("[checkPrefixAvailable]", error.message);
    return false;
  }
  return data == null;
}

export async function proposeAlternativePrefixes(
  supabase: SupabaseClient<Database>,
  takenPrefix: string,
  excludeSchoolId: string | null
): Promise<string[]> {
  const base = normalizeAdmissionPrefixInput(takenPrefix).slice(0, 3);
  if (base.length < 3) {
    return [];
  }
  const out: string[] = [];
  for (let n = 1; n <= 9 && out.length < 5; n++) {
    const c = `${base}${n}`;
    if (c.length <= 4 && ADMISSION_PREFIX_PATTERN.test(c)) {
      if (
        await checkPrefixAvailableWithClient(supabase, c, excludeSchoolId)
      ) {
        out.push(c);
      }
    }
  }
  for (let n = 0; n < 26 && out.length < 5; n++) {
    const letter = String.fromCharCode(65 + n);
    const c = (base.slice(0, 2) + letter).slice(0, 4);
    if (
      ADMISSION_PREFIX_PATTERN.test(c) &&
      (await checkPrefixAvailableWithClient(supabase, c, excludeSchoolId))
    ) {
      if (!out.includes(c)) {
        out.push(c);
      }
    }
  }
  return out;
}

export async function setSchoolPrefix(
  schoolId: string,
  prefix: string
): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await setSchoolPrefixWithClient(supabase, schoolId, prefix);
}

export async function setSchoolPrefixWithClient(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  prefix: string
): Promise<void> {
  const p = normalizeAdmissionPrefixInput(prefix);
  if (!ADMISSION_PREFIX_PATTERN.test(p)) {
    throw new Error("Admission prefix must be 3 to 4 letters (A–Z).");
  }
  const free = await checkPrefixAvailableWithClient(supabase, p, schoolId);
  if (!free) {
    throw new Error("That admission prefix is already in use.");
  }
  const { error } = await supabase
    .from("schools")
    .update({ admission_prefix: p } as never)
    .eq("id", schoolId);
  if (error) {
    throw new Error(error.message);
  }
}
