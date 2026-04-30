/**
 * Per-kind payload rewriters that substitute `temp_…` ids with real
 * server ids before a queued mutation is dispatched.
 *
 * Two phases per item:
 *   1. `collectTempIds(kind, payload)` walks the payload, gathering
 *      every temp id it references.
 *   2. The dispatcher resolves them via `lookupManyIdMappings`. If any
 *      are still unresolved (the create-student is queued behind us),
 *      the item is deferred to the next drain pass with status `pending`.
 *      No retry-count bump.
 *   3. `rewritePayload(kind, payload, mapping)` produces a NEW payload
 *      object with substitutions applied; the dispatcher hands the
 *      rewritten payload to the action.
 *
 * The original `payload` in `pending_sync` is left untouched — if the
 * create-student gets discarded by the user before its dependents drain,
 * we want the dependent payloads to still show their original (temp) ids
 * in the conflict UI rather than half-rewritten state.
 *
 * Adding a new kind: extend the switch in both `collectTempIds` and
 * `rewritePayload`. If the payload has no studentId references, return
 * `[]` from collect and the payload unchanged from rewrite.
 */

import type { SyncItemKind } from "./db";
import { isTempId } from "./temp-ids";

/**
 * Collect every temp id referenced inside the payload. Order doesn't
 * matter — the dispatcher will dedupe.
 */
export function collectTempIds(kind: SyncItemKind, payload: unknown): string[] {
  if (payload == null || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  const out: string[] = [];

  switch (kind) {
    case "save-attendance": {
      const records = p["records"];
      if (Array.isArray(records)) {
        for (const r of records) {
          if (r && typeof r === "object") {
            const sid = (r as Record<string, unknown>)["studentId"];
            if (typeof sid === "string" && isTempId(sid)) out.push(sid);
          }
        }
      }
      return out;
    }
    case "save-scores": {
      const scores = p["scores"];
      if (Array.isArray(scores)) {
        for (const s of scores) {
          if (s && typeof s === "object") {
            const sid = (s as Record<string, unknown>)["studentId"];
            if (typeof sid === "string" && isTempId(sid)) out.push(sid);
          }
        }
      }
      return out;
    }
    case "record-payment": {
      // Payment payload is a serialized FormData record:
      // { student_id, fee_structure_id, amount, ... }
      const sid = p["student_id"];
      if (typeof sid === "string" && isTempId(sid)) out.push(sid);
      return out;
    }
    case "update-student":
    case "delete-student": {
      // The student CRUD payload carries the target id under a stable
      // metadata key — see `wire-students` for where this is set.
      const sid = p["_targetStudentId"];
      if (typeof sid === "string" && isTempId(sid)) out.push(sid);
      return out;
    }
    case "create-student":
    case "send-message":
    case "create-gradebook-assignment":
    case "delete-gradebook-assignment": {
      // No incoming temp id references — the create-student case ISSUES
      // a tempId mapping (handled in the dispatcher), it doesn't consume
      // one. send-message uses real conversation ids. Gradebook
      // assignment ids are all real (they don't depend on offline-created
      // students for their own existence).
      return out;
    }
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return out;
    }
  }
}

/**
 * Returns a new payload with every temp id substituted for the
 * corresponding real id from `mapping`. If a temp id is missing from
 * the map (which shouldn't happen — the caller must check
 * `collectTempIds` first), the original temp id is left in place;
 * the server will then reject the request, which is the correct failure
 * mode.
 */
export function rewritePayload(
  kind: SyncItemKind,
  payload: unknown,
  mapping: ReadonlyMap<string, string>
): unknown {
  if (payload == null || typeof payload !== "object") return payload;
  if (mapping.size === 0) return payload;
  const p = payload as Record<string, unknown>;

  const sub = (id: string): string => {
    if (!isTempId(id)) return id;
    return mapping.get(id) ?? id;
  };

  switch (kind) {
    case "save-attendance": {
      const records = p["records"];
      if (!Array.isArray(records)) return payload;
      return {
        ...p,
        records: records.map((r) =>
          r && typeof r === "object"
            ? {
                ...(r as Record<string, unknown>),
                studentId: sub((r as Record<string, unknown>)["studentId"] as string),
              }
            : r
        ),
      };
    }
    case "save-scores": {
      const scores = p["scores"];
      if (!Array.isArray(scores)) return payload;
      return {
        ...p,
        scores: scores.map((s) =>
          s && typeof s === "object"
            ? {
                ...(s as Record<string, unknown>),
                studentId: sub((s as Record<string, unknown>)["studentId"] as string),
              }
            : s
        ),
      };
    }
    case "record-payment": {
      const sid = p["student_id"];
      if (typeof sid !== "string") return payload;
      return { ...p, student_id: sub(sid) };
    }
    case "update-student":
    case "delete-student": {
      const sid = p["_targetStudentId"];
      if (typeof sid !== "string") return payload;
      return { ...p, _targetStudentId: sub(sid) };
    }
    case "create-student":
    case "send-message":
    case "create-gradebook-assignment":
    case "delete-gradebook-assignment":
      return payload;
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return payload;
    }
  }
}
