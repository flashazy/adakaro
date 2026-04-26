"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_POLL_MS = 15_000;

/**
 * Polls unread class-teacher ↔ parent messages via GET (avoids stale Server
 * Action IDs after dev server restarts).
 */
export function useChatInboxUnreadCount(enabled: boolean, pollMs = DEFAULT_POLL_MS) {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      return () => {
        mountedRef.current = false;
      };
    }

    let intervalId: number | null = null;
    let abort: AbortController | null = null;
    let pollRunning = false;

    const clearTimers = () => {
      if (intervalId != null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      abort?.abort();
      abort = null;
    };

    const tick = async () => {
      if (!mountedRef.current || document.visibilityState !== "visible") return;
      if (pollRunning) return;
      pollRunning = true;
      abort?.abort();
      abort = new AbortController();
      const signal = abort.signal;
      try {
        const res = await fetch("/api/chat/inbox-unread", {
          credentials: "include",
          signal,
        });
        if (!mountedRef.current || signal.aborted) return;
        if (!res.ok) return;
        const body = (await res.json()) as { count?: number };
        if (typeof body.count === "number") {
          setCount(body.count);
        }
      } catch (e: unknown) {
        if (
          e &&
          typeof e === "object" &&
          (e as { name?: string }).name === "AbortError"
        ) {
          return;
        }
      } finally {
        pollRunning = false;
      }
    };

    const onVisibility = () => {
      if (!mountedRef.current || !enabled) return;
      if (document.visibilityState === "visible") {
        void tick();
        if (intervalId == null) {
          intervalId = window.setInterval(() => void tick(), pollMs);
        }
      } else {
        clearTimers();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState === "visible") {
      void tick();
      intervalId = window.setInterval(() => void tick(), pollMs);
    }

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimers();
    };
  }, [enabled, pollMs]);

  return enabled ? count : 0;
}
