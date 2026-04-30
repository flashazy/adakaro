/**
 * Dexie schema for the offline write queue (Phase 2 PWA).
 *
 * Four tables, but `pending_sync` is the source of truth — it drives the
 * drain loop and the indicator badge. The kind-specific tables
 * (`attendance_offline`, `grades_offline`, `payments_offline`) hold a
 * denormalized copy of each enqueued payload so the sync-status page can
 * render rich, per-feature summaries (e.g. "Class 4A — 12 marks") without
 * having to reach back into the queue for parsing.
 *
 * Module access pattern: the file is **client-only**. Importing it from a
 * server component will throw because Dexie touches `window.indexedDB`.
 * Always import from `"use client"` files (or guarded by `typeof window`).
 */

import Dexie, { type Table } from "dexie";

/**
 * The status a queue entry can be in.
 *   - `pending`  → waiting to be sent (or retried later)
 *   - `running`  → a drain pass is currently sending it
 *   - `conflict` → server returned 409 (or analogous); user must resolve
 *   - `failed`   → exceeded MAX_RETRIES with non-conflict error; user must
 *     manually retry or discard
 */
export type SyncItemStatus = "pending" | "running" | "conflict" | "failed";

/**
 * Stable identifiers for each offline-capable mutation. Add a new value
 * here AND register a handler in `sync-dispatcher.ts` to support a new
 * mutation kind.
 */
export type SyncItemKind =
  | "save-attendance"
  | "save-scores"
  | "create-gradebook-assignment"
  | "delete-gradebook-assignment";

export interface PendingSyncRow {
  /**
   * Auto-incremented numeric primary key. Dexie hands one back from
   * `db.pending_sync.add(...)`.
   */
  id?: number;
  /**
   * Stable opaque id used everywhere outside Dexie (URLs, retry buttons,
   * the kind-specific tables). Generated client-side via `crypto.randomUUID`.
   */
  uuid: string;
  kind: SyncItemKind;
  /**
   * Opaque payload — must be a structured-cloneable plain object.
   * Server actions receive this verbatim on replay.
   */
  payload: unknown;
  /** ms since epoch when the user originally clicked Save. */
  createdAt: number;
  /** ms since epoch of the most recent send attempt (0 = never tried). */
  lastAttemptAt: number;
  retryCount: number;
  status: SyncItemStatus;
  /** Human-readable error from the last failed attempt, if any. */
  lastError: string | null;
  /**
   * If the server returned data alongside an error / conflict, store it
   * verbatim so the conflict-resolution UI can surface "server version".
   */
  serverState?: unknown;
  /**
   * Short label used in the status page list (e.g. "Class 4A — 2026-04-30").
   * Optional; the dispatcher fills it in when it can.
   */
  label?: string;
}

export interface AttendanceOfflineRow {
  uuid: string;
  classId: string;
  date: string;
  recordCount: number;
  createdAt: number;
}

export interface GradesOfflineRow {
  uuid: string;
  /** "scores" | "create-assignment" | "delete-assignment" — keeps the same
   * row shape across slightly different gradebook mutations. */
  kind: "scores" | "create-assignment" | "delete-assignment";
  classId: string | null;
  assignmentId: string | null;
  studentCount: number;
  createdAt: number;
}

export interface PaymentsOfflineRow {
  uuid: string;
  studentId: string;
  amount: number;
  createdAt: number;
}

class AdakaroOfflineDB extends Dexie {
  pending_sync!: Table<PendingSyncRow, number>;
  attendance_offline!: Table<AttendanceOfflineRow, string>;
  grades_offline!: Table<GradesOfflineRow, string>;
  payments_offline!: Table<PaymentsOfflineRow, string>;

  constructor() {
    super("adakaro_offline_v1");

    // Indexes:
    //   pending_sync.uuid is unique so the dispatcher can locate by uuid
    //   without scanning. status + createdAt let us drain "pending first,
    //   oldest first" in one cursor.
    this.version(1).stores({
      pending_sync: "++id, &uuid, status, kind, createdAt, [status+createdAt]",
      attendance_offline: "&uuid, classId, date, createdAt",
      grades_offline: "&uuid, kind, classId, assignmentId, createdAt",
      payments_offline: "&uuid, studentId, createdAt",
    });
  }
}

let _db: AdakaroOfflineDB | null = null;

/**
 * Lazy singleton accessor. Throws when called server-side because Dexie
 * needs `indexedDB` from `window`. Catch sites should branch on
 * `typeof window` rather than wrapping in try/catch.
 */
export function getOfflineDB(): AdakaroOfflineDB {
  if (typeof window === "undefined") {
    throw new Error(
      "lib/offline/db: getOfflineDB() called in a non-browser context."
    );
  }
  if (!_db) {
    _db = new AdakaroOfflineDB();
  }
  return _db;
}

/** Best-effort UUID generator that works in older Safari too. */
export function generateUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
