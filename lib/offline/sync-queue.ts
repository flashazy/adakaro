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
  type PaymentsOfflineRow,
  type PendingSyncRow,
  type SyncItemKind,
  generateUuid,
  getOfflineDB,
} from "./db";
import { dispatchSyncItem } from "./sync-dispatcher";

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
  payments?: { studentId: string; amount: number };
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
          createdAt: now,
        };
        await db.payments_offline.put(pr);
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

    // Pull pending + failed (manual retry) items oldest-first.
    const candidates = await db.pending_sync
      .where("status")
      .anyOf("pending")
      .toArray();

    for (const item of candidates) {
      if (!opts.force && !isDue(item, now)) continue;
      if (item.id == null) continue;

      result.attempted += 1;

      // Mark as running so a parallel drain (shouldn't happen given the
      // mutex above, but defensive) skips it.
      await db.pending_sync.update(item.id, {
        status: "running",
        lastAttemptAt: Date.now(),
      });

      const dispatch = await dispatchSyncItem(item.kind, item.payload);

      if (dispatch.ok) {
        await db.transaction(
          "rw",
          [
            db.pending_sync,
            db.attendance_offline,
            db.grades_offline,
            db.payments_offline,
          ],
          async () => {
            await db.pending_sync.delete(item.id!);
            await db.attendance_offline.delete(item.uuid);
            await db.grades_offline.delete(item.uuid);
            await db.payments_offline.delete(item.uuid);
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
    ],
    async () => {
      const row = await db.pending_sync.where("uuid").equals(uuid).first();
      if (row?.id != null) await db.pending_sync.delete(row.id);
      await db.attendance_offline.delete(uuid);
      await db.grades_offline.delete(uuid);
      await db.payments_offline.delete(uuid);
    }
  );
}

/**
 * Conflict resolution: user chooses to push their local version anyway.
 * Re-queues the item with retry counters reset; the next drain pass will
 * send it again (server may still reject, in which case the conflict flag
 * comes back).
 */
export async function keepLocalOverServer(uuid: string): Promise<void> {
  await forceRetry(uuid);
}

/**
 * Conflict resolution: user accepts the server version. The local payload
 * is discarded entirely.
 */
export async function acceptServerVersion(uuid: string): Promise<void> {
  await discardItem(uuid);
}
