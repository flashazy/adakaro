/**
 * Convenience wrapper used by feature code (TeacherAttendanceForm,
 * TeacherGradebook, …) to make a mutation "offline-friendly".
 *
 * Behavior:
 *   - When `navigator.onLine === true`: call `run()` and return its result.
 *     If `run()` throws (network blip mid-flight), enqueue and report
 *     `{ ok: true, queued: true }` so the UI shows "saved locally".
 *   - When `navigator.onLine === false`: skip `run()` entirely, enqueue,
 *     return `{ ok: true, queued: true }`.
 *
 * The wrapper *only* queues on transport failures — server-side
 * validation errors (auth, RLS, "not found") still bubble up so the user
 * sees the real problem instead of a misleading "Saved locally" toast.
 *
 * Importantly: this lives client-side. Calling it from a server context
 * will not work because `navigator` is undefined.
 */

import {
  enqueueSyncItem,
  type EnqueueHint,
} from "./sync-queue";
import type { SyncItemKind } from "./db";

export interface EnqueueOrRunArgs<Result> {
  kind: SyncItemKind;
  payload: unknown;
  /** The actual server-action call (or fetch) the component would have
   * made. Must accept zero args; close over the payload at the call site. */
  run: () => Promise<Result>;
  /** Optional metadata used to populate the kind-specific offline table
   * for the sync-status page. */
  hint?: EnqueueHint;
}

export type EnqueueOrRunResult<Result> =
  | { ok: true; queued: false; result: Result }
  | { ok: true; queued: true; uuid: string }
  | { ok: false; error: string };

/**
 * True when the thrown error looks like a transport failure rather than
 * a server-rejection. We're conservative: only `TypeError: Failed to
 * fetch`-shaped errors qualify.
 */
function isLikelyNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    if (m.includes("failed to fetch")) return true;
    if (m.includes("network")) return true;
    if (m.includes("load failed")) return true; // Safari
  }
  return false;
}

export async function enqueueOrRun<Result>({
  kind,
  payload,
  run,
  hint,
}: EnqueueOrRunArgs<Result>): Promise<EnqueueOrRunResult<Result>> {
  // Branch 1 — known offline. Skip the round-trip.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    try {
      const uuid = await enqueueSyncItem(kind, payload, hint);
      return { ok: true, queued: true, uuid };
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof Error
            ? `Could not save locally: ${e.message}`
            : "Could not save locally.",
      };
    }
  }

  // Branch 2 — online; try the real call first.
  try {
    const result = await run();
    return { ok: true, queued: false, result };
  } catch (err) {
    if (!isLikelyNetworkError(err)) {
      // Re-throw so the caller's existing try/catch + UI handles it as
      // before. We do NOT silently queue server-side errors.
      throw err;
    }
    try {
      const uuid = await enqueueSyncItem(kind, payload, hint);
      return { ok: true, queued: true, uuid };
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof Error
            ? `Could not save locally: ${e.message}`
            : "Could not save locally.",
      };
    }
  }
}
