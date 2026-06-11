import "server-only";

import {
  compareStreamClassNames,
  parseStreamCapacity,
} from "@/lib/student-streaming/evaluate-rules";
import type { StreamingStreamClass } from "@/lib/student-streaming/types";

type ClassRow = {
  id: string;
  name: string;
  description: string | null;
  school_id?: string;
};

function mapRows(
  rows: { id: string; name: string; description?: string | null }[]
): StreamingStreamClass[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    capacity: parseStreamCapacity(row.description ?? null),
  }));
}

/**
 * True when `className` looks like a stream section of `parentName`
 * (e.g. FORM 2 → FORM 2A, FORM 2 B, FORM 2-A).
 */
export function isStreamNameForParent(
  parentName: string,
  className: string
): boolean {
  const parent = parentName.trim().toLowerCase();
  const name = className.trim().toLowerCase();
  if (!parent || !name || name === parent) return false;

  if (
    name.startsWith(`${parent} `) ||
    name.startsWith(`${parent}-`) ||
    name.startsWith(`${parent}/`)
  ) {
    return true;
  }

  if (!name.startsWith(parent)) return false;

  const suffix = name.slice(parent.length);
  if (!suffix) return false;

  // Compact stream suffix: FORM 2 + A → FORM 2A (letter stream label).
  // Avoid FORM 2 matching FORM 20 (suffix starts with a digit).
  return /^[a-z]/i.test(suffix);
}

function mergeStreamRows(
  linked: ClassRow[],
  candidates: ClassRow[],
  rootClassId: string
): ClassRow[] {
  const byId = new Map<string, ClassRow>();
  for (const row of [...linked, ...candidates]) {
    if (row.id === rootClassId) continue;
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) =>
    compareStreamClassNames(a.name, b.name)
  );
}

/**
 * Stream sections for a parent class (e.g. FORM 2 → 2A, 2B, 2Q).
 * Merges explicit `parent_class_id` links with same-school name-prefix
 * matches so coordinators see every valid destination stream.
 */
export async function resolveStreamClassesForParent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  params: {
    rootClassId: string;
    schoolId: string;
    parentName: string;
  }
): Promise<StreamingStreamClass[]> {
  const { data: linkedRaw } = await admin
    .from("classes")
    .select("id, name, description, school_id")
    .eq("school_id", params.schoolId)
    .eq("parent_class_id", params.rootClassId)
    .order("name", { ascending: true });

  const linked = (linkedRaw ?? []) as ClassRow[];

  const parentPrefix = params.parentName.trim();
  let prefixCandidates: ClassRow[] = [];

  if (parentPrefix) {
    const { data: schoolClassesRaw } = await admin
      .from("classes")
      .select("id, name, description, school_id")
      .eq("school_id", params.schoolId)
      .neq("id", params.rootClassId)
      .order("name", { ascending: true });

    prefixCandidates = ((schoolClassesRaw ?? []) as ClassRow[]).filter((c) =>
      isStreamNameForParent(parentPrefix, c.name)
    );
  }

  const merged = mergeStreamRows(linked, prefixCandidates, params.rootClassId);
  if (merged.length > 0) return mapRows(merged);

  // Schools without streams: allow placing into the parent class itself.
  const { data: rootRow } = await admin
    .from("classes")
    .select("id, name, description, school_id")
    .eq("id", params.rootClassId)
    .eq("school_id", params.schoolId)
    .maybeSingle();

  if (rootRow) {
    return mapRows([rootRow as ClassRow]);
  }

  return [];
}
