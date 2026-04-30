"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getOfflineDB, type PendingSyncRow } from "./db";

/**
 * Reactive online/offline state. Reads `navigator.onLine` once on mount
 * and subscribes to `online` / `offline` window events.
 *
 * SSR-safe: returns `true` while rendering server-side so links and
 * buttons aren't pre-disabled in the SSR HTML.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine !== false);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

/**
 * Live count of items in the queue. Returns null until Dexie has resolved
 * (avoids "0 → 5" flash on initial mount when the queue is non-empty).
 */
export function usePendingSyncCount(): number | null {
  const count = useLiveQuery(async () => {
    if (typeof window === "undefined") return 0;
    return getOfflineDB().pending_sync.count();
  }, []);
  return count ?? null;
}

/**
 * Live list of every queued item, oldest first. Useful for the
 * /sync-status page; do NOT use this in tight render paths if the queue
 * could grow large (>1k entries).
 */
export function usePendingSyncItems(): PendingSyncRow[] | null {
  const items = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return getOfflineDB()
      .pending_sync.orderBy("createdAt")
      .reverse()
      .toArray();
  }, []);
  return items ?? null;
}

/** Live count of items in `conflict` status — surfaced as a different
 * badge color in the indicator. */
export function useConflictCount(): number {
  const count = useLiveQuery(async () => {
    if (typeof window === "undefined") return 0;
    return getOfflineDB().pending_sync.where("status").equals("conflict").count();
  }, []);
  return count ?? 0;
}
