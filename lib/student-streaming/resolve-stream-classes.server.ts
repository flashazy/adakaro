import "server-only";

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
): Promise<{ id: string; name: string }[]> {
  const { data: linkedRaw } = await admin
    .from("classes")
    .select("id, name")
    .eq("parent_class_id", params.rootClassId)
    .order("name", { ascending: true });

  const linked = (linkedRaw ?? []) as { id: string; name: string }[];
  if (linked.length > 0) return linked;

  const parentPrefix = params.parentName.trim();
  if (!parentPrefix) return [];

  const { data: schoolClassesRaw } = await admin
    .from("classes")
    .select("id, name")
    .eq("school_id", params.schoolId)
    .neq("id", params.rootClassId)
    .order("name", { ascending: true });

  const prefixLower = parentPrefix.toLowerCase();
  const candidates = ((schoolClassesRaw ?? []) as { id: string; name: string }[])
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

  return candidates;
}
