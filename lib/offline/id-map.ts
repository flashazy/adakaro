/**
 * Persistent mapping of `temp_…` client ids to real server ids.
 *
 * Population: a successful `create-student` dispatch records the mapping
 * via `recordIdMapping(tempId, realId)`.
 *
 * Consumption: every other dispatch first runs its payload through
 * `rewrite-ids.ts`, which calls `lookupIdMapping(tempId)` for each
 * tempId reference and substitutes the real id. If a referenced tempId
 * is unresolved (e.g. the create-student is still queued because the
 * user hasn't reconnected long enough), the dispatcher defers the item
 * to the next drain pass instead of failing.
 *
 * Mappings are kept indefinitely so re-installs of the app on the same
 * device don't lose context. (`students_offline` separately holds the
 * `realStudentId` so the UI can display badges without scanning every
 * mapping; this table is the substrate the rewrite layer consults.)
 */

import type { IdMappingRow } from "./db";
import { getOfflineDB } from "./db";

/** Persist a tempId → realId mapping. Idempotent: re-recording the same
 * pair is a no-op. */
export async function recordIdMapping(
  tempId: string,
  realId: string,
  entity: IdMappingRow["entity"] = "student"
): Promise<void> {
  if (!tempId || !realId) return;
  if (tempId === realId) return;
  const db = getOfflineDB();
  await db.id_mappings.put({
    tempId,
    realId,
    entity,
    createdAt: Date.now(),
  });
}

/** Returns the real id for a temp id, or `null` if not yet resolved. */
export async function lookupIdMapping(tempId: string): Promise<string | null> {
  if (!tempId) return null;
  const db = getOfflineDB();
  const row = await db.id_mappings.get(tempId);
  return row?.realId ?? null;
}

/**
 * Bulk lookup for the rewrite hook. Returns a `Map<tempId, realId>` for
 * all of the requested temp ids that have been resolved. Missing keys
 * mean "still pending" — the caller defers the item.
 */
export async function lookupManyIdMappings(
  tempIds: readonly string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (tempIds.length === 0) return out;
  const db = getOfflineDB();
  // dexie's `bulkGet` preserves order and returns `undefined` for misses.
  const rows = await db.id_mappings.bulkGet(tempIds as string[]);
  rows.forEach((row, i) => {
    if (row && row.realId) out.set(tempIds[i]!, row.realId);
  });
  return out;
}

/**
 * Remove a stale mapping. Called when the user accepts an existing
 * server-side duplicate via the conflict UI — the temp id is repointed
 * at the existing real id directly via `recordIdMapping`, so we don't
 * actually delete in that case. This helper exists for tests / cleanup.
 */
export async function deleteIdMapping(tempId: string): Promise<void> {
  if (!tempId) return;
  const db = getOfflineDB();
  await db.id_mappings.delete(tempId);
}
