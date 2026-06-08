import "server-only";

import { resolveClassCluster, type ClusterDb } from "@/lib/class-cluster";

/**
 * Leaf stream ids that share the same form offering as `classId`.
 * Standalone classes (no parent, no children) return only themselves.
 */
export function siblingLeafClassIds(
  cluster: Awaited<ReturnType<typeof resolveClassCluster>>,
  classId: string
): string[] {
  if (cluster.childClassIds.length > 0) {
    return cluster.childClassIds;
  }
  return [classId];
}

/**
 * Expand admin-selected class ids so every sibling stream under the same form
 * parent is included. Used when writing `subject_classes` so all streams in a
 * form share the same offered subject set.
 */
export async function expandClassIdsToSiblingLeafStreams(
  admin: ClusterDb,
  classIds: string[]
): Promise<string[]> {
  const uniqueInput = [...new Set(classIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueInput.length === 0) return [];

  const expanded = new Set<string>();
  for (const classId of uniqueInput) {
    const cluster = await resolveClassCluster(admin, classId);
    for (const leafId of siblingLeafClassIds(cluster, classId)) {
      expanded.add(leafId);
    }
  }
  return [...expanded];
}

/**
 * When a new stream is created under a form parent, copy the union of
 * `subject_classes` from existing sibling streams onto the new stream.
 */
export async function inheritSubjectClassesForNewStream(
  admin: ClusterDb,
  newStreamClassId: string,
  parentClassId: string
): Promise<{ ok: true; linkedCount: number } | { ok: false; error: string }> {
  const cluster = await resolveClassCluster(admin, parentClassId);
  const siblingIds = cluster.childClassIds.filter((id) => id !== newStreamClassId);

  if (siblingIds.length === 0) {
    return { ok: true, linkedCount: 0 };
  }

  const { data: scRows, error: fetchErr } = await admin
    .from("subject_classes")
    .select("subject_id")
    .in("class_id", siblingIds);

  if (fetchErr) {
    return { ok: false, error: fetchErr.message || "Could not load sibling subjects." };
  }

  const subjectIds = [
    ...new Set(
      ((scRows ?? []) as { subject_id: string }[]).map((r) => r.subject_id)
    ),
  ];

  if (subjectIds.length === 0) {
    return { ok: true, linkedCount: 0 };
  }

  const { data: existingRows } = await admin
    .from("subject_classes")
    .select("subject_id")
    .eq("class_id", newStreamClassId)
    .in("subject_id", subjectIds);

  const existing = new Set(
    ((existingRows ?? []) as { subject_id: string }[]).map((r) => r.subject_id)
  );

  const toInsert = subjectIds
    .filter((subject_id) => !existing.has(subject_id))
    .map((subject_id) => ({ subject_id, class_id: newStreamClassId }));

  if (toInsert.length === 0) {
    return { ok: true, linkedCount: 0 };
  }

  const { error: insErr } = await admin.from("subject_classes").insert(toInsert as never);

  if (insErr) {
    const code = (insErr as { code?: string }).code;
    if (code === "23505") {
      return { ok: true, linkedCount: 0 };
    }
    return {
      ok: false,
      error: insErr.message || "Could not inherit subjects for the new stream.",
    };
  }

  return { ok: true, linkedCount: toInsert.length };
}
