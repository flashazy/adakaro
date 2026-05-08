"use client";

import { useEffect, useRef } from "react";

/**
 * Top-level mount that drives the offline-write queue.
 *
 * Triggers a drain pass on:
 *   1. **Mount** — picks up anything queued in a previous session.
 *   2. **`online` event** — the moment the network returns.
 *   3. **`visibilitychange` → visible** — user came back to the tab; cheap
 *      and useful when the tab was throttled in the background.
 *   4. **A precise wake-up timer** — set to the soonest due item per the
 *      retry schedule (5s, 30s, 60s, 2m, capped at 5m). After every drain
 *      pass we recompute and re-arm the timer.
 *   5. **Safety-net interval** — once a minute, regardless. Catches edge
 *      cases (system clock jumps, missed `online` events on iOS Safari
 *      after sleep, etc.).
 *
 * The wake-up timer is the main retry mechanism; the interval is just
 * insurance. Both stop while the tab is hidden to be polite to battery.
 *
 * **SSR:** Do not statically import `./sync-queue` (Dexie indexedDB). Lazy
 * `import()` runs only inside `useEffect` on the client.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const intervalRef = useRef<number | null>(null);
  const wakeupRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const aborted = { current: false };

    let removeOnline: (() => void) | null = null;
    let removeVisibility: (() => void) | null = null;

    function clearWakeup() {
      if (wakeupRef.current != null) {
        window.clearTimeout(wakeupRef.current);
        wakeupRef.current = null;
      }
    }

    function clearIntervalTimer() {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    void import("./sync-queue").then((sync) => {
      if (aborted.current) return;

      const { drainQueue, getMsUntilNextRetry, vacuumOfflineCaches } = sync;

      async function rescheduleWakeup() {
        if (aborted.current) return;
        clearWakeup();
        const wait = await getMsUntilNextRetry();
        if (aborted.current) return;
        if (wait == null) return; // queue empty
        if (wait <= 0) {
          void drainAndReschedule();
          return;
        }
        const capped = Math.min(wait, 5 * 60_000);
        wakeupRef.current = window.setTimeout(() => {
          wakeupRef.current = null;
          void drainAndReschedule();
        }, capped);
      }

      async function drainAndReschedule() {
        if (aborted.current) return;
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          return;
        }
        try {
          await drainQueue();
        } catch (err) {
          console.error("[sync] drain failed:", err);
        }
        void rescheduleWakeup();
      }

      function startInterval() {
        clearIntervalTimer();
        intervalRef.current = window.setInterval(() => {
          void drainAndReschedule();
        }, 60_000);
      }

      function handleOnline() {
        void drainAndReschedule();
      }

      function handleVisibility() {
        if (document.visibilityState === "visible") {
          void drainAndReschedule();
          startInterval();
        } else {
          clearIntervalTimer();
          clearWakeup();
        }
      }

      void drainAndReschedule();
      void vacuumOfflineCaches().catch((err) => {
        console.warn("[sync] vacuum failed:", err);
      });
      startInterval();
      window.addEventListener("online", handleOnline);
      document.addEventListener("visibilitychange", handleVisibility);
      removeOnline = () =>
        window.removeEventListener("online", handleOnline);
      removeVisibility = () =>
        document.removeEventListener("visibilitychange", handleVisibility);
    });

    return () => {
      aborted.current = true;
      clearIntervalTimer();
      clearWakeup();
      removeOnline?.();
      removeVisibility?.();
    };
  }, []);

  return <>{children}</>;
}
