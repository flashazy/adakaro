import "server-only";

import { parseStreamCapacity } from "@/lib/student-streaming/evaluate-rules";
import type { StreamingStreamClass } from "@/lib/student-streaming/types";

/**
 * Stream sections for a parent class (e.g. FORM ONE → A, B, C).
 * Prefers explicit `parent_class_id` links; falls back to name-prefix
 * matching for schools that created streams without linking the parent.
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
  const mapRows = (
    rows: { id: string; name: string; description?: string | null }[]
  ): StreamingStreamClass[] =>
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      capacity: parseStreamCapacity(row.description ?? null),
    }));

  const { data: linkedRaw } = await admin
    .from("classes")
    .select("id, name, description")
    .eq("parent_class_id", params.rootClassId)
    .order("name", { ascending: true });

  const linked = (linkedRaw ?? []) as {
    id: string;
    name: string;
    description: string | null;
  }[];
  if (linked.length > 0) return mapRows(linked);

  const parentPrefix = params.parentName.trim();
  if (!parentPrefix) return [];

  const { data: schoolClassesRaw } = await admin
    .from("classes")
    .select("id, name, description")
    .eq("school_id", params.schoolId)
    .neq("id", params.rootClassId)
    .order("name", { ascending: true });

  const prefixLower = parentPrefix.toLowerCase();
  const candidates = (
    (schoolClassesRaw ?? []) as {
      id: string;
      name: string;
      description: string | null;
    }[]
  )
    .filter((c) => {
      const name = c.name.trim();
      const lower = name.toLowerCase();
      return (
        lower.startsWith(`${prefixLower} `) ||
        lower.startsWith(`${prefixLower}-`) ||
        lower.startsWith(`${prefixLower}/`)
      );
    })
    .filter((c) => c.id !== params.rootClassId);

  return mapRows(candidates);
}
