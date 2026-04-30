/**
 * Replay handlers for each `SyncItemKind`.
 *
 * The drain loop in `sync-queue.ts` calls `dispatchSyncItem(kind, payload)`
 * which forwards to the right server-action import. All actions used here
 * already exist in the codebase — we deliberately do not introduce new
 * REST endpoints; replay reuses the same code path the online flow uses.
 *
 * **Conflict detection (best-effort)**: every server action returns
 * `{ ok?: boolean, error?: string }`. We treat `ok === false` with an
 * explicit `conflict: true` flag as a conflict; everything else as a hard
 * error. None of the existing actions surface conflicts today, so the
 * conflict path stays dormant until a follow-up phase teaches the actions
 * to compare timestamps.
 */

import type { SyncItemKind } from "./db";

export interface DispatchResult {
  /** True when the server accepted the write. */
  ok: boolean;
  /** Human-readable error message (when !ok). */
  error?: string;
  /** True when the failure is a conflict that the user must resolve. */
  conflict?: boolean;
  /** Server-side state to surface in the conflict UI (when conflict). */
  serverState?: unknown;
  /**
   * True when the failure is permanent (don't retry). Auth errors and
   * "row not found" errors fall into this bucket — replaying them won't
   * help.
   */
  permanent?: boolean;
}

interface AnyActionResult {
  ok?: boolean;
  error?: string;
  conflict?: boolean;
  serverState?: unknown;
  // various existing actions also return rich payloads — we ignore them
  // here, the drain loop only cares about success/failure.
  [k: string]: unknown;
}

function isPermanentError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("not authenticated") ||
    m.includes("not authorized") ||
    m.includes("forbidden") ||
    m.includes("not found") ||
    m.includes("invalid") ||
    m.includes("rls")
  );
}

/**
 * Dynamic-import the right action module so the offline bundle stays
 * small (we don't pull every server action into the SyncProvider).
 */
async function loadAction(kind: SyncItemKind) {
  switch (kind) {
    case "save-attendance":
    case "save-scores":
    case "create-gradebook-assignment":
    case "delete-gradebook-assignment": {
      const mod = await import(
        "@/app/(dashboard)/teacher-dashboard/actions"
      );
      if (kind === "save-attendance") return mod.saveAttendanceAction;
      if (kind === "save-scores") return mod.saveScoresAction;
      if (kind === "create-gradebook-assignment")
        return mod.createGradebookAssignmentAction;
      return mod.deleteGradebookAssignmentAction;
    }
    default: {
      // Exhaustive check — TypeScript will flag a new kind that's missing.
      const _exhaustive: never = kind;
      void _exhaustive;
      throw new Error(`No dispatcher for kind: ${String(kind)}`);
    }
  }
}

export async function dispatchSyncItem(
  kind: SyncItemKind,
  payload: unknown
): Promise<DispatchResult> {
  let action: ((p: unknown) => Promise<AnyActionResult>) | undefined;
  try {
    action = (await loadAction(kind)) as unknown as (
      p: unknown
    ) => Promise<AnyActionResult>;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load action.",
      permanent: true,
    };
  }

  let raw: AnyActionResult;
  try {
    raw = await action(payload);
  } catch (e) {
    // Real network/transport failures throw `TypeError: Failed to fetch`.
    // Server-action runtime errors generally do not throw — they return
    // `{ ok: false, error }` — so a thrown error is almost always a
    // network blip and should be retried.
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error.",
    };
  }

  if (raw && raw.ok === true) {
    return { ok: true };
  }

  if (raw && raw.conflict === true) {
    return {
      ok: false,
      conflict: true,
      serverState: raw.serverState,
      error: raw.error || "Conflict — server has a newer version.",
    };
  }

  const errMsg =
    typeof raw?.error === "string" && raw.error.trim().length > 0
      ? raw.error
      : "Unknown error.";

  return {
    ok: false,
    error: errMsg,
    permanent: isPermanentError(errMsg),
  };
}
