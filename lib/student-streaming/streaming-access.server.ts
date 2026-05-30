import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClassCluster } from "@/lib/class-cluster";
import { collectParentClassIds } from "@/lib/class-options";
import type {
  StreamingParentClassOption,
  StreamingStreamClass,
} from "@/lib/student-streaming/types";

export async function getCoordinatorSchoolIdsForUser(
  userId: string
): Promise<string[]> {
  const admin = createAdminClient();
  const { data: coordRows } = await admin
    .from("teacher_coordinators")
    .select("school_id")
    .eq("teacher_id", userId);

  const ids = new Set<string>();
  for (const row of (coordRows ?? []) as { school_id: string }[]) {
    if (row.school_id) ids.add(row.school_id);
  }
  return [...ids];
}

async function loadEligibleParentClassesForSchool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  schoolId: string
): Promise<StreamingParentClassOption[]> {
  const { data: classRowsRaw } = await admin
    .from("classes")
    .select("id, name, parent_class_id, school_id")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  const classRows = (classRowsRaw ?? []) as {
    id: string;
    name: string;
    parent_class_id: string | null;
    school_id: string;
  }[];

  const parentIds = collectParentClassIds(classRows);
  const streamsByParent = new Map<string, StreamingStreamClass[]>();

  for (const row of classRows) {
    const parentId = row.parent_class_id;
    if (!parentId || !parentIds.has(parentId)) continue;
    const list = streamsByParent.get(parentId) ?? [];
    list.push({ id: row.id, name: row.name, capacity: null });
    streamsByParent.set(parentId, list);
  }

  for (const list of streamsByParent.values()) {
    list.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }

  return classRows
    .filter((row) => parentIds.has(row.id))
    .filter((row) => (streamsByParent.get(row.id)?.length ?? 0) > 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      schoolId: row.school_id,
      streamClasses: streamsByParent.get(row.id) ?? [],
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
}

/**
 * All parent classes in the coordinator's school(s) that have at least one
 * linked stream child. Not restricted to the coordinator's assigned class.
 */
export async function loadStreamingParentClassesForUser(
  userId: string
): Promise<StreamingParentClassOption[]> {
  const admin = createAdminClient();
  const schoolIds = await getCoordinatorSchoolIdsForUser(userId);
  if (schoolIds.length === 0) return [];

  const byParentId = new Map<string, StreamingParentClassOption>();
  for (const schoolId of schoolIds) {
    const parents = await loadEligibleParentClassesForSchool(admin, schoolId);
    for (const parent of parents) {
      byParentId.set(parent.id, parent);
    }
  }

  return [...byParentId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export async function assertCoordinatorForParentClass(
  userId: string,
  parentClassId: string
): Promise<{ ok: true; schoolId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const cluster = await resolveClassCluster(admin, parentClassId);

  const { data: parentRow } = await admin
    .from("classes")
    .select("school_id")
    .eq("id", cluster.rootClassId)
    .maybeSingle();

  if (!parentRow) {
    return { ok: false, error: "Class not found." };
  }

  const schoolId = (parentRow as { school_id: string }).school_id;

  const { data: coordRows, error } = await admin
    .from("teacher_coordinators")
    .select("id")
    .eq("teacher_id", userId)
    .eq("school_id", schoolId)
    .limit(1);

  if (error) return { ok: false, error: error.message };
  if (!coordRows?.length) {
    return {
      ok: false,
      error: "You must be a class coordinator to use student streaming.",
    };
  }

  return { ok: true, schoolId };
}

export async function requireStreamingUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." as const, user: null };
  return { user, error: null as null };
}
