import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type ClusterDb = SupabaseClient<Database>;

export interface ClassClusterInfo {
  /**
   * Every class id in the same "family" as the requested class: the class
   * itself, its parent (if any), and every sibling / child stream. Deduped.
   */
  classIds: string[];
  /** The umbrella/root class id — parent if one exists, otherwise the class itself. */
  rootClassId: string;
  /** Child-stream class ids hanging off `rootClassId` (may be empty). */
  childClassIds: string[];
  /** True when the requested class is itself the parent of at least one stream. */
  isParent: boolean;
}

/**
 * Resolve a `class_id` into its multi-stream cluster. Uses the admin client
 * because this runs inside server actions that already bypass RLS for
 * teacher/coordinator lookups, and keeps one query path for both the
 * "requested class is parent" and "requested class is a child stream" cases.
 *
 * Mirrors the `public.class_cluster_ids(uuid)` Postgres helper shipped in
 * migration 00087. We duplicate the logic in TypeScript so we can reuse the
 * resulting ids for ordering / joins without round-tripping through an RPC.
 */
export async function resolveClassCluster(
  admin: ClusterDb,
  classId: string
): Promise<ClassClusterInfo> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: selfRow } = await db
    .from("classes")
    .select("id, parent_class_id")
    .eq("id", classId)
    .maybeSingle();

  const self = selfRow as { id: string; parent_class_id: string | null } | null;
  if (!self) {
    return {
      classIds: [classId],
      rootClassId: classId,
      childClassIds: [],
      isParent: false,
    };
  }

  const rootClassId = self.parent_class_id ?? self.id;

  const { data: childRowsRaw } = await db
    .from("classes")
    .select("id")
    .eq("parent_class_id", rootClassId);

  const childClassIds = ((childRowsRaw ?? []) as { id: string }[]).map(
    (r) => r.id
  );

  const ids = new Set<string>([classId, rootClassId, ...childClassIds]);

  return {
    classIds: [...ids],
    rootClassId,
    childClassIds,
    isParent: self.id === rootClassId,
  };
}
