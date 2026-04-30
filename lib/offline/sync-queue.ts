/**
 * Offline-write queue manager.
 *
 * Public API:
 *   - `enqueueSyncItem(kind, payload, hint?)`  → add to pending_sync
 *   - `drainQueue(opts?)`                       → process all due items
 *   - `forceRetry(uuid)`                        → reset retry+attempt time
 *   - `discardItem(uuid)`                       → remove permanently
 *   - `keepLocalOverServer(uuid)`               → re-queue with server-clobber intent
 *   - `acceptServerVersion(uuid)`               → discard local, log decision
 *
 * Concurrency: a single in-flight `drainQueue()` at a time. Calls while
 * a drain is running short-circuit and return immediately so the user can
 * spam the indicator's Retry button without piling up parallel passes.
 */

import {
  type AttendanceOfflineRow,
  type GradesOfflineRow,
  type MessagesOfflineRow,
  type PaymentsOfflineRow,
  type PendingSyncRow,
  type StudentsOfflineRow,
  KIND_PRIORITY,
  type SyncItemKind,
  generateUuid,
  getOfflineDB,
} from "./db";
import { dispatchSyncItem } from "./sync-dispatcher";
import { recordIdMapping, lookupManyIdMappings } from "./id-map";
import { collectTempIds, rewritePayload } from "./rewrite-ids";

const MAX_RETRIES = 8;
/** Cap the retry interval at 5 minutes so failed items still get a try
 * every time the user re-opens the app. */
const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * Explicit retry schedule (in milliseconds) keyed by `retryCount`.
 *
 *   retry 1 → wait 5s   (catches transient blips fast)
 *   retry 2 → wait 30s  (medium back-off, lets a flaky tower recover)
 *   retry 3 → wait 60s  (matches the SyncProvider's polling interval)
 *   retry 4 → wait 2m
 *   retry 5+ → 5m       (capped — see MAX_BACKOFF_MS)
 *
 * `MAX_RETRIES` controls when an item gets parked as `failed` (manual
 * retry only). Indexed by attempt number, NOT zero-indexed: index 0 is
 * unused because retry-count 0 is the very first send (no wait at all).
 */
const RETRY_SCHEDULE_MS: readonly number[] = [
  0,
  5_000,
  30_000,
  60_000,
  2 * 60_000,
  MAX_BACKOFF_MS,
];

/**
 * Optional hints the caller can attach so the status page can show useful
 * per-feature summaries (e.g. attendance: class + date + record count).
 */
export interface EnqueueHint {
  label?: string;
  attendance?: { classId: string; date: string; recordCount: number };
  grades?: {
    kind: GradesOfflineRow["kind"];
    classId: string | null;
    assignmentId: string | null;
    studentCount: number;
  };
  payments?: {
    studentId: string;
    amount: number;
    /** Pre-generated `OFFLINE-…` receipt to display in the UI. */
    tempReceipt: string;
  };
  messages?: {
    conversationId: string;
    senderId: string;
    body: string;
  };
  students?: {
    tempStudentId: string;
    fullName: string;
    classId: string | null;
    parentPhone: string | null;
    op: StudentsOfflineRow["op"];
  };
}

export async function enqueueSyncItem(
  kind: SyncItemKind,
  payload: unknown,
  hint: EnqueueHint = {}
): Promise<string> {
  const db = getOfflineDB();
  const uuid = generateUuid();
  const now = Date.now();

  const row: PendingSyncRow = {
    uuid,
    kind,
    payload,
    createdAt: now,
    lastAttemptAt: 0,
    retryCount: 0,
    status: "pending",
    lastError: null,
    label: hint.label,
  };

  await db.transaction(
    "rw",
    [
      db.pending_sync,
      db.attendance_offline,
      db.grades_offline,
      db.payments_offline,
      db.messages_offline,
      db.students_offline,
    ],
    async () => {
      await db.pending_sync.add(row);
      if (hint.attendance) {
        const ar: AttendanceOfflineRow = {
          uuid,
          classId: hint.attendance.classId,
          date: hint.attendance.date,
          recordCount: hint.attendance.recordCount,
          createdAt: now,
        };
        await db.attendance_offline.put(ar);
      }
      if (hint.grades) {
        const gr: GradesOfflineRow = {
          uuid,
          kind: hint.grades.kind,
          classId: hint.grades.classId,
          assignmentId: hint.grades.assignmentId,
          studentCount: hint.grades.studentCount,
          createdAt: now,
        };
        await db.grades_offline.put(gr);
      }
      if (hint.payments) {
        const pr: PaymentsOfflineRow = {
          uuid,
          studentId: hint.payments.studentId,
          amount: hint.payments.amount,
          tempReceipt: hint.payments.tempReceipt,
          createdAt: now,
        };
        await db.payments_offline.put(pr);
      }
      if (hint.messages) {
        const mr: MessagesOfflineRow = {
          uuid,
          conversationId: hint.messages.conversationId,
          senderId: hint.messages.senderId,
          body: hint.messages.body,
          createdAt: now,
        };
        await db.messages_offline.put(mr);
      }
      if (hint.students) {
        const sr: StudentsOfflineRow = {
          uuid,
          tempStudentId: hint.students.tempStudentId,
          fullName: hint.students.fullName,
          classId: hint.students.classId,
          parentPhone: hint.students.parentPhone,
          op: hint.students.op,
          createdAt: now,
        };
        await db.students_offline.put(sr);
      }
    }
  );

  return uuid;
}

/**
 * How long to wait after the most recent attempt before retrying.
 * Reads `RETRY_SCHEDULE_MS` and clamps to the last (capped) entry once
 * we run off the end.
 */
export function nextRetryDelayMs(retryCount: number): number {
  if (retryCount <= 0) return 0;
  const idx = Math.min(retryCount, RETRY_SCHEDULE_MS.length - 1);
  return RETRY_SCHEDULE_MS[idx]!;
}

/** True when the item is past its next-retry timestamp. */
function isDue(item: PendingSyncRow, now: number): boolean {
  if (item.lastAttemptAt === 0) return true;
  const wait = nextRetryDelayMs(item.retryCount);
  return now - item.lastAttemptAt >= wait;
}

/**
 * Returns ms until the next pending item is due, or `null` if nothing is
 * pending. Callers (the provider) use this to schedule a precise wake-up
 * timer instead of polling every 60s.
 */
export async function getMsUntilNextRetry(): Promise<number | null> {
  const db = getOfflineDB();
  const pending = await db.pending_sync
    .where("status")
    .equals("pending")
    .toArray();
  if (pending.length === 0) return null;

  const now = Date.now();
  let soonest = Number.POSITIVE_INFINITY;
  for (const item of pending) {
    if (item.lastAttemptAt === 0) return 0;
    const due = item.lastAttemptAt + nextRetryDelayMs(item.retryCount);
    const wait = Math.max(0, due - now);
    if (wait < soonest) soonest = wait;
  }
  return Number.isFinite(soonest) ? soonest : null;
}

let drainInFlight: Promise<DrainResult> | null = null;

export interface DrainResult {
  /** Items the drain attempted in this pass. */
  attempted: number;
  /** Successfully sent (deleted from queue). */
  succeeded: number;
  /** Will be retried later (still in queue, retry_count incremented). */
  rescheduled: number;
  /** Conflict items (status='conflict'). */
  conflicted: number;
  /** Hit MAX_RETRIES or got a permanent error (status='failed'). */
  failed: number;
  /** True when the caller asked to drain while another pass was running. */
  skippedDueToInFlight: boolean;
}

export interface DrainOptions {
  /** When true, ignore backoff and try every pending item immediately. */
  force?: boolean;
}

export async function drainQueue(
  opts: DrainOptions = {}
): Promise<DrainResult> {
  if (drainInFlight) {
    // Wait for the in-flight pass to finish, then report it as "skipped"
    // so the caller knows their drain request was coalesced into the
    // existing one rather than running fresh.
    await drainInFlight.catch(() => undefined);
    return {
      attempted: 0,
      succeeded: 0,
      rescheduled: 0,
      conflicted: 0,
      failed: 0,
      skippedDueToInFlight: true,
    };
  }

  drainInFlight = (async (): Promise<DrainResult> => {
    const db = getOfflineDB();
    const now = Date.now();
    const result: DrainResult = {
      attempted: 0,
      succeeded: 0,
      rescheduled: 0,
      conflicted: 0,
      failed: 0,
      skippedDueToInFlight: false,
    };

    // Pull pending items, then sort by [kind priority, createdAt]. The
    // priority puts `create-student` ahead of every dependent kind so its
    // id mapping is recorded before downstream items dispatch. Within
    // the same priority, oldest-first matches user intent (the order
    // they actually saved).
    const candidates = await db.pending_sync
      .where("status")
      .equals("pending")
      .toArray();
    candidates.sort((a, b) => {
      const pa = KIND_PRIORITY[a.kind] ?? 10;
      const pb = KIND_PRIORITY[b.kind] ?? 10;
      if (pa !== pb) return pa - pb;
      return a.createdAt - b.createdAt;
    });

    for (const item of candidates) {
      if (!opts.force && !isDue(item, now)) continue;
      if (item.id == null) continue;

      // Phase 3: rewrite temp ids → real ids. Items whose payload
      // references an unresolved temp id are deferred — left as
      // `pending` with no retry-count bump — so they get a fresh attempt
      // after the create-student that produces the mapping drains.
      const tempRefs = collectTempIds(item.kind, item.payload);
      let rewrittenPayload = item.payload;
      if (tempRefs.length > 0) {
        const uniqueRefs = Array.from(new Set(tempRefs));
        const mapping = await lookupManyIdMappings(uniqueRefs);
        const unresolved = uniqueRefs.filter((id) => !mapping.has(id));
        if (unresolved.length > 0) {
          // Defer — but only if at least one create-student is still
          // pending. If no create-student is queued the temp id will
          // never resolve; skip on this pass and let the user resolve
          // manually (the status page already shows the stuck item).
          continue;
        }
        rewrittenPayload = rewritePayload(item.kind, item.payload, mapping);
      }

      result.attempted += 1;

      // Mark as running so a parallel drain (shouldn't happen given the
      // mutex above, but defensive) skips it.
      await db.pending_sync.update(item.id, {
        status: "running",
        lastAttemptAt: Date.now(),
      });

      const dispatch = await dispatchSyncItem(
        item.kind,
        rewrittenPayload,
        item.uuid
      );

      if (dispatch.ok) {
        // Side effects of a successful dispatch:
        //   - create-student → record id mapping so dependent items can
        //     rewrite their payloads on the next pass of THIS drain.
        //   - record-payment → swap the temp receipt for the real one
        //     in `payments_offline`. We *keep* the row so the UI can show
        //     "synced — receipt RCP-…" briefly before the next page load.
        if (dispatch.idMapping) {
          await recordIdMapping(
            dispatch.idMapping.tempId,
            dispatch.idMapping.realId
          );
          // Update the students_offline row with the real id so the UI
          // badge can flip from "pending" to the real student row.
          await db.students_offline
            .where("uuid")
            .equals(item.uuid)
            .modify({ realStudentId: dispatch.idMapping.realId });
        }
        if (dispatch.paymentReceipt) {
          await db.payments_offline
            .where("uuid")
            .equals(item.uuid)
            .modify({ realReceipt: dispatch.paymentReceipt.receiptNumber });
        }
        await db.transaction(
          "rw",
          [
            db.pending_sync,
            db.attendance_offline,
            db.grades_offline,
            db.payments_offline,
            db.messages_offline,
            db.students_offline,
          ],
          async () => {
            await db.pending_sync.delete(item.id!);
            await db.attendance_offline.delete(item.uuid);
            await db.grades_offline.delete(item.uuid);
            // Payments + students keep their offline rows around briefly
            // so the UI can render the "just synced" state. They're
            // garbage-collected by `vacuumOfflineCaches()`. Messages are
            // deleted immediately because the chat client merges from
            // both server polls and `messages_offline` — leaving the
            // row would cause a duplicate.
            await db.messages_offline.delete(item.uuid);
          }
        );
        result.succeeded += 1;
        continue;
      }

      if (dispatch.conflict) {
        await db.pending_sync.update(item.id, {
          status: "conflict",
          lastError: dispatch.error ?? null,
          serverState: dispatch.serverState,
        });
        result.conflicted += 1;
        continue;
      }

      const nextRetry = item.retryCount + 1;
      if (dispatch.permanent || nextRetry >= MAX_RETRIES) {
        await db.pending_sync.update(item.id, {
          status: "failed",
          retryCount: nextRetry,
          lastError: dispatch.error ?? null,
        });
        result.failed += 1;
      } else {
        await db.pending_sync.update(item.id, {
          status: "pending",
          retryCount: nextRetry,
          lastError: dispatch.error ?? null,
        });
        result.rescheduled += 1;
      }
    }

    return result;
  })();

  try {
    return await drainInFlight;
  } finally {
    drainInFlight = null;
  }
}

/** Reset a failed/conflict item back to pending so the next drain picks
 * it up immediately. */
export async function forceRetry(uuid: string): Promise<void> {
  const db = getOfflineDB();
  const row = await db.pending_sync.where("uuid").equals(uuid).first();
  if (!row || row.id == null) return;
  await db.pending_sync.update(row.id, {
    status: "pending",
    retryCount: 0,
    lastAttemptAt: 0,
    lastError: null,
  });
}

/** Permanently remove an item from every offline table. */
export async function discardItem(uuid: string): Promise<void> {
  const db = getOfflineDB();
  await db.transaction(
    "rw",
    [
      db.pending_sync,
      db.attendance_offline,
      db.grades_offline,
      db.payments_offline,
      db.messages_offline,
      db.students_offline,
    ],
    async () => {
      const row = await db.pending_sync.where("uuid").equals(uuid).first();
      if (row?.id != null) await db.pending_sync.delete(row.id);
      await db.attendance_offline.delete(uuid);
      await db.grades_offline.delete(uuid);
      await db.payments_offline.delete(uuid);
      await db.messages_offline.delete(uuid);
      await db.students_offline.delete(uuid);
    }
  );
}

/**
 * Conflict resolution: user chooses to push their local version anyway.
 *
 * For payment + student create/update conflicts the server detects
 * duplicates by content. To override, we re-queue with `force_duplicate=1`
 * appended to the FormData payload — the server actions look for this
 * flag and skip the duplicate check on the second pass.
 */
export async function keepLocalOverServer(uuid: string): Promise<void> {
  const db = getOfflineDB();
  const row = await db.pending_sync.where("uuid").equals(uuid).first();
  if (!row || row.id == null) return;

  // Patch the payload: only payment + student create/update use
  // `force_duplicate`. Other kinds reset and retry as-is.
  let nextPayload = row.payload;
  if (
    row.kind === "record-payment" ||
    row.kind === "create-student" ||
    row.kind === "update-student"
  ) {
    if (nextPayload && typeof nextPayload === "object") {
      nextPayload = {
        ...(nextPayload as Record<string, unknown>),
        force_duplicate: "1",
      };
    }
  }

  await db.pending_sync.update(row.id, {
    payload: nextPayload,
    status: "pending",
    retryCount: 0,
    lastAttemptAt: 0,
    lastError: null,
    serverState: undefined,
  });
}

/**
 * Conflict resolution: user accepts the server version.
 *
 * For student-create conflicts there's a special path: we don't just
 * discard, we record an id mapping pointing the temp id at the existing
 * server student. That way any queued attendance/grades/payment items
 * referencing the temp id will rewrite to the existing student instead
 * of waiting forever for a create that won't happen.
 *
 * Caller passes `existingRealId` for this case; pass `null` (or omit)
 * for the simple discard.
 */
export async function acceptServerVersion(
  uuid: string,
  existingRealId?: string | null
): Promise<void> {
  const db = getOfflineDB();
  const row = await db.pending_sync.where("uuid").equals(uuid).first();
  if (row && row.kind === "create-student" && existingRealId) {
    const studentRow = await db.students_offline.where("uuid").equals(uuid).first();
    if (studentRow?.tempStudentId) {
      await recordIdMapping(studentRow.tempStudentId, existingRealId);
      // Update the students_offline row so badges flip immediately.
      await db.students_offline
        .where("uuid")
        .equals(uuid)
        .modify({ realStudentId: existingRealId });
    }
  }
  await discardItem(uuid);
}

/**
 * Vacuum old "completed" offline rows. The drain loop keeps payments +
 * students rows around briefly so the UI can render the "just synced"
 * state without flickering. This runs them out after 24h.
 *
 * Safe to call from anywhere; idempotent. The `SyncProvider` calls it
 * once per mount.
 */
export async function vacuumOfflineCaches(): Promise<void> {
  const db = getOfflineDB();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  await db.transaction(
    "rw",
    [db.payments_offline, db.students_offline, db.id_mappings],
    async () => {
      // Only delete payments rows that have a `realReceipt` (i.e. the
      // sync succeeded) — otherwise a long-pending offline payment would
      // get nuked just because the user took a day to come back online.
      await db.payments_offline
        .where("createdAt")
        .below(cutoff)
        .filter((row) => typeof row.realReceipt === "string" && row.realReceipt.length > 0)
        .delete();
      await db.students_offline
        .where("createdAt")
        .below(cutoff)
        .filter(
          (row) =>
            typeof row.realStudentId === "string" && row.realStudentId.length > 0
        )
        .delete();
      // Keep id_mappings forever — they're tiny, and a reinstall could
      // still find queued items in another db. Vacuum nothing here.
    }
  );
}
