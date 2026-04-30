"use client";

import { useEffect, useRef } from "react";
import { drainQueue, getMsUntilNextRetry } from "./sync-queue";

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
 * Renders nothing — pure side-effect provider.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const intervalRef = useRef<number | null>(null);
  const wakeupRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    cancelledRef.current = false;

    function clearWakeup() {
      if (wakeupRef.current != null) {
        window.clearTimeout(wakeupRef.current);
        wakeupRef.current = null;
      }
    }

    function clearInterval() {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    /**
     * Look up the soonest-due item and arm a `setTimeout` for it. If
     * everything is already due (wait === 0) we trigger a drain right
     * away instead of recursing — drainAndReschedule will arm the next
     * timer when it finishes.
     */
    async function rescheduleWakeup() {
      if (cancelledRef.current) return;
      clearWakeup();
      const wait = await getMsUntilNextRetry();
      if (wait == null) return; // queue empty
      if (wait <= 0) {
        void drainAndReschedule();
        return;
      }
      // Cap the wake-up at 5 minutes to avoid setTimeout drift on long
      // sleeps; the safety interval covers the rest.
      const capped = Math.min(wait, 5 * 60_000);
      wakeupRef.current = window.setTimeout(() => {
        wakeupRef.current = null;
        void drainAndReschedule();
      }, capped);
    }

    async function drainAndReschedule() {
      if (cancelledRef.current) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        // Don't drain while offline — it would just bump every retry
        // counter for no reason. The `online` listener will rerun us.
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
      clearInterval();
      intervalRef.current = window.setInterval(() => {
        void drainAndReschedule();
      }, 60_000);
    }

    function handleOnline() {
      // When the network comes back we want to retry every item now —
      // not whatever they were waiting on individually. The drain pass
      // itself handles that (lastAttemptAt is reset implicitly by the
      // wake-up math: now - lastAttemptAt >= 0 for items just enqueued).
      // But we explicitly reschedule so a 5-minute-old "rescheduled"
      // item gets attempted immediately.
      void drainAndReschedule();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void drainAndReschedule();
        startInterval();
      } else {
        clearInterval();
        clearWakeup();
      }
    }

    void drainAndReschedule();
    startInterval();
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelledRef.current = true;
      clearInterval();
      clearWakeup();
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return <>{children}</>;
}
