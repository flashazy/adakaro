import "server-only";

import {
  collectParentClassIds,
  type ClassOptionRow,
} from "@/lib/class-options";

/** Manual widen — admin client typing without full Relationships. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

/**
 * Class ids that have at least one child stream in the given school(s).
 * Teacher-facing dropdowns should exclude these (containers, not teaching classes).
 */
export async function fetchParentClassIdsWithChildrenForSchools(
  admin: AdminClient,
  schoolIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>();
  const uniq = [...new Set(schoolIds.filter(Boolean))];
  for (const sid of uniq) {
    const { data } = await admin
      .from("classes")
      .select("id, parent_class_id")
      .eq("school_id", sid);
    for (const id of collectParentClassIds(
      (data ?? []) as ClassOptionRow[]
    )) {
      out.add(id);
    }
  }
  return out;
}
