import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClassCluster } from "@/lib/class-cluster";
import { resolveStreamClassesForParent } from "@/lib/student-streaming/resolve-stream-classes.server";
import type { StreamingParentClassOption } from "@/lib/student-streaming/types";

export async function assertCoordinatorForParentClass(
  userId: string,
  parentClassId: string
): Promise<{ ok: true; schoolId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const cluster = await resolveClassCluster(admin, parentClassId);
  const { data: coordRows, error } = await admin
    .from("teacher_coordinators")
    .select("school_id, class_id")
    .eq("teacher_id", userId)
    .in("class_id", cluster.classIds);

  if (error) return { ok: false, error: error.message };
  if (!coordRows?.length) {
    return {
      ok: false,
      error: "You are not a coordinator for this class.",
    };
  }

  const schoolId = (coordRows[0] as { school_id: string }).school_id;
  return { ok: true, schoolId };
}

export async function loadStreamingParentClassesForUser(
  userId: string
): Promise<StreamingParentClassOption[]> {
  const admin = createAdminClient();
  const { data: coordRows } = await admin
    .from("teacher_coordinators")
    .select("class_id, school_id")
    .eq("teacher_id", userId);

  const assignments = (coordRows ?? []) as {
    class_id: string;
    school_id: string;
  }[];
  if (assignments.length === 0) return [];

  const rootIds = new Set<string>();
  const schoolByRoot = new Map<string, string>();

  for (const row of assignments) {
    const cluster = await resolveClassCluster(admin, row.class_id);
    rootIds.add(cluster.rootClassId);
    schoolByRoot.set(cluster.rootClassId, row.school_id);
  }

  if (rootIds.size === 0) return [];

  const { data: rootRowsRaw } = await admin
    .from("classes")
    .select("id, name, school_id")
    .in("id", [...rootIds]);

  const rootRows = (rootRowsRaw ?? []) as {
    id: string;
    name: string;
    school_id: string;
  }[];

  const { data: streamRowsRaw } = await admin
    .from("classes")
    .select("id, name, parent_class_id")
    .in("parent_class_id", [...rootIds])
    .order("name", { ascending: true });

  const streamRows = (streamRowsRaw ?? []) as {
    id: string;
    name: string;
    parent_class_id: string;
  }[];

  const streamsByParent = new Map<string, { id: string; name: string }[]>();
  for (const s of streamRows) {
    const list = streamsByParent.get(s.parent_class_id) ?? [];
    list.push({ id: s.id, name: s.name });
    streamsByParent.set(s.parent_class_id, list);
  }

  const results: StreamingParentClassOption[] = [];
  for (const root of rootRows) {
    const linked = streamsByParent.get(root.id) ?? [];
    const streams =
      linked.length > 0
        ? linked
        : await resolveStreamClassesForParent(admin, {
            rootClassId: root.id,
            schoolId: schoolByRoot.get(root.id) ?? root.school_id,
            parentName: root.name,
          });
    results.push({
      id: root.id,
      name: root.name,
      schoolId: schoolByRoot.get(root.id) ?? root.school_id,
      streamClasses: streams,
    });
  }

  return results.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export async function requireStreamingUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." as const, user: null };
  return { user, error: null as null };
}
