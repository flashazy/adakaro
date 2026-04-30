/**
 * Replay handlers for each `SyncItemKind`.
 *
 * The drain loop in `sync-queue.ts` calls `dispatchSyncItem(kind, payload)`
 * which forwards to the right server-action import. All actions used here
 * already exist in the codebase — we deliberately do not introduce new
 * REST endpoints; replay reuses the same code path the online flow uses.
 *
 * **Conflict detection**: actions that returned `{ ok: false, conflict:
 * true, ... }` are surfaced as `DispatchResult.conflict = true`. The
 * status-page UI then renders a per-kind resolution modal.
 *
 * **Server actions vs FormData**: gradebook + attendance actions take a
 * plain object. Payments + students take `FormData`. The dispatcher
 * reconstructs a `FormData` from the queued payload (a plain object of
 * `string | string[]` values) before invoking those actions.
 *
 * **Id mappings**: a successful `create-student` returns the new server
 * id, which the dispatcher persists via `recordIdMapping(tempId, realId)`
 * so subsequent dependent items (attendance/grades/payment referencing
 * the temp id) get rewritten on their next dispatch attempt.
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
  /**
   * Set by `create-student` only. Tells the queue layer to call
   * `recordIdMapping(tempId, realId)` so dependent items can be rewritten
   * before their own dispatch.
   */
  idMapping?: { tempId: string; realId: string };
  /**
   * Set by `record-payment` only. Tells the queue/UI layer the real
   * receipt number so the cached `payments_offline` row can be updated
   * (the receipt swap surfaces in the payments UI).
   */
  paymentReceipt?: { uuid: string; receiptNumber: string };
}

interface AnyActionResult {
  ok?: boolean;
  error?: string;
  conflict?: boolean;
  serverState?: unknown;
  // Various existing actions also return rich payloads — we read what
  // we need on a per-kind basis below; the drain loop only cares about
  // the standard success/failure surface.
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
 * Reconstruct a `FormData` instance from a serialized record. Server
 * actions that originally consumed `FormData` (payments, students) need
 * this because we can't structured-clone a `FormData` into IndexedDB.
 *
 * Convention: a value of type `string` becomes `formData.append(k, v)`;
 * a value of type `string[]` becomes one `append` call per entry; `null`
 * and `undefined` are skipped (matches the original "field omitted"
 * behavior).
 */
function buildFormData(record: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [key, val] of Object.entries(record)) {
    if (val == null) continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "string") fd.append(key, item);
      }
    } else if (typeof val === "string") {
      fd.append(key, val);
    } else if (typeof val === "number" || typeof val === "boolean") {
      fd.append(key, String(val));
    }
  }
  return fd;
}

/** Convert payload + uuid to a payment-replay outcome. Encapsulates the
 * dual-return shape (ok + paymentReceipt OR conflict OR error). */
async function dispatchRecordPayment(
  uuid: string,
  payload: unknown
): Promise<DispatchResult> {
  if (payload == null || typeof payload !== "object") {
    return { ok: false, error: "Invalid payment payload.", permanent: true };
  }
  const fd = buildFormData(payload as Record<string, unknown>);
  let raw: AnyActionResult;
  try {
    const mod = await import(
      "@/app/(dashboard)/dashboard/payments/actions"
    );
    raw = (await mod.recordPayment({}, fd)) as AnyActionResult;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error.",
    };
  }
  if (raw.conflict) {
    return {
      ok: false,
      conflict: true,
      serverState: raw.duplicateCandidates ?? null,
      error: raw.error || "Duplicate payment.",
    };
  }
  if (raw.error) {
    return {
      ok: false,
      error: raw.error,
      permanent: isPermanentError(raw.error),
    };
  }
  const receipt = typeof raw.receiptNumber === "string" ? raw.receiptNumber : null;
  return {
    ok: true,
    paymentReceipt: receipt ? { uuid, receiptNumber: receipt } : undefined,
  };
}

async function dispatchCreateStudent(
  payload: unknown
): Promise<DispatchResult> {
  if (payload == null || typeof payload !== "object") {
    return { ok: false, error: "Invalid student payload.", permanent: true };
  }
  const p = payload as Record<string, unknown>;
  const tempId = typeof p["_tempStudentId"] === "string" ? (p["_tempStudentId"] as string) : "";
  // The form field `_tempStudentId` is private to the offline layer and
  // must not be forwarded to the server. Strip it before building the FD.
  const { _tempStudentId, ...rest } = p;
  void _tempStudentId;
  const fd = buildFormData(rest as Record<string, unknown>);
  let raw: AnyActionResult;
  try {
    const mod = await import(
      "@/app/(dashboard)/dashboard/students/actions"
    );
    raw = (await mod.addStudent({}, fd)) as AnyActionResult;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error.",
    };
  }
  if (raw.conflict) {
    return {
      ok: false,
      conflict: true,
      serverState: raw.duplicateCandidates ?? null,
      error: raw.error || "Possible duplicate student.",
    };
  }
  if (raw.error) {
    return {
      ok: false,
      error: raw.error,
      permanent: isPermanentError(raw.error),
    };
  }
  const realId = typeof raw.studentId === "string" ? raw.studentId : null;
  if (!realId) {
    // The server accepted the insert but gave us no id back — we can't
    // resolve dependents. Treat as permanent error so the user notices.
    return {
      ok: false,
      error: "Server did not return the new student id.",
      permanent: true,
    };
  }
  return {
    ok: true,
    idMapping: tempId ? { tempId, realId } : undefined,
  };
}

async function dispatchUpdateStudent(
  payload: unknown
): Promise<DispatchResult> {
  if (payload == null || typeof payload !== "object") {
    return { ok: false, error: "Invalid update payload.", permanent: true };
  }
  const p = payload as Record<string, unknown>;
  const studentId = typeof p["_targetStudentId"] === "string" ? (p["_targetStudentId"] as string) : "";
  if (!studentId) {
    return { ok: false, error: "Missing target student id.", permanent: true };
  }
  const { _targetStudentId, ...rest } = p;
  void _targetStudentId;
  const fd = buildFormData(rest as Record<string, unknown>);
  let raw: AnyActionResult;
  try {
    const mod = await import(
      "@/app/(dashboard)/dashboard/students/actions"
    );
    raw = (await mod.updateStudent(studentId, fd)) as AnyActionResult;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error.",
    };
  }
  if (raw.error) {
    return {
      ok: false,
      error: raw.error,
      permanent: isPermanentError(raw.error),
    };
  }
  return { ok: true };
}

async function dispatchDeleteStudent(
  payload: unknown
): Promise<DispatchResult> {
  if (payload == null || typeof payload !== "object") {
    return { ok: false, error: "Invalid delete payload.", permanent: true };
  }
  const p = payload as Record<string, unknown>;
  const studentId = typeof p["_targetStudentId"] === "string" ? (p["_targetStudentId"] as string) : "";
  if (!studentId) {
    return { ok: false, error: "Missing target student id.", permanent: true };
  }
  let raw: AnyActionResult;
  try {
    const mod = await import(
      "@/app/(dashboard)/dashboard/students/actions"
    );
    raw = (await mod.deleteStudent(studentId)) as AnyActionResult;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error.",
    };
  }
  if (raw.error) {
    return {
      ok: false,
      error: raw.error,
      permanent: isPermanentError(raw.error),
    };
  }
  return { ok: true };
}

async function dispatchSendMessage(
  payload: unknown
): Promise<DispatchResult> {
  if (payload == null || typeof payload !== "object") {
    return { ok: false, error: "Invalid message payload.", permanent: true };
  }
  const p = payload as Record<string, unknown>;
  const conversationId = typeof p["conversationId"] === "string" ? (p["conversationId"] as string) : "";
  const message = typeof p["message"] === "string" ? (p["message"] as string) : "";
  if (!conversationId || !message) {
    return { ok: false, error: "Invalid message payload.", permanent: true };
  }
  let raw: AnyActionResult;
  try {
    const mod = await import("@/lib/chat/chat-server-actions");
    raw = (await mod.insertChatMessageAction(conversationId, message)) as AnyActionResult;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error.",
    };
  }
  if (raw.ok === true) return { ok: true };
  return {
    ok: false,
    error: typeof raw.error === "string" ? raw.error : "Could not send message.",
    permanent: isPermanentError(typeof raw.error === "string" ? raw.error : null),
  };
}

/**
 * Plain-object replay path for the original Phase 2 actions (attendance,
 * scores, gradebook). They take JSON payloads directly.
 */
async function dispatchPlainAction(
  kind:
    | "save-attendance"
    | "save-scores"
    | "create-gradebook-assignment"
    | "delete-gradebook-assignment",
  payload: unknown
): Promise<DispatchResult> {
  type PlainAction = (p: unknown) => Promise<AnyActionResult>;
  let action: PlainAction | undefined;
  try {
    const mod = await import(
      "@/app/(dashboard)/teacher-dashboard/actions"
    );
    if (kind === "save-attendance")
      action = mod.saveAttendanceAction as unknown as PlainAction;
    else if (kind === "save-scores")
      action = mod.saveScoresAction as unknown as PlainAction;
    else if (kind === "create-gradebook-assignment")
      action = mod.createGradebookAssignmentAction as unknown as PlainAction;
    else action = mod.deleteGradebookAssignmentAction as unknown as PlainAction;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load action.",
      permanent: true,
    };
  }

  let raw: AnyActionResult;
  try {
    raw = await action!(payload);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error.",
    };
  }

  if (raw && raw.ok === true) return { ok: true };
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

export async function dispatchSyncItem(
  kind: SyncItemKind,
  payload: unknown,
  uuid: string
): Promise<DispatchResult> {
  switch (kind) {
    case "save-attendance":
    case "save-scores":
    case "create-gradebook-assignment":
    case "delete-gradebook-assignment":
      return dispatchPlainAction(kind, payload);
    case "record-payment":
      return dispatchRecordPayment(uuid, payload);
    case "create-student":
      return dispatchCreateStudent(payload);
    case "update-student":
      return dispatchUpdateStudent(payload);
    case "delete-student":
      return dispatchDeleteStudent(payload);
    case "send-message":
      return dispatchSendMessage(payload);
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return {
        ok: false,
        error: `No dispatcher for kind: ${String(kind)}`,
        permanent: true,
      };
    }
  }
}
