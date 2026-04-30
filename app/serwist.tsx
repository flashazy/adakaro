"use client";

import { useEffect } from "react";

/**
 * Manual service worker registration.
 *
 * The official `SerwistProvider` from `@serwist/next/react` currently fails
 * to parse under Next.js 16 + Turbopack (see serwist/serwist issues), so we
 * register the worker via the standard browser API. This keeps Serwist's
 * caching/precaching features intact — those live inside `/public/sw.js`
 * itself; the provider only handled registration + a couple of optional
 * client-side helpers (cache-on-navigation, reload-on-online).
 *
 * Registration is gated to production builds. In development we proactively
 * unregister any worker (and wipe its caches) left behind by an earlier
 * `npm run build && npm start` session — otherwise the stale SW would keep
 * serving its precached HTML in dev and React would throw "Hydration failed
 * because the server rendered HTML didn't match the client".
 */
export function SerwistProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void cleanupLeftoverServiceWorker();
      return;
    }

    const controller = new AbortController();
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("Service worker registration failed:", err);
      });

    return () => controller.abort();
  }, []);

  return <>{children}</>;
}

/**
 * Unregister every controlling SW and delete every Cache Storage bucket
 * Serwist (or any other prior worker) created. Safe to call repeatedly.
 *
 * If a worker was actually still controlling this page we force a one-shot
 * reload so the next request goes straight to the dev server instead of the
 * killed worker's stale precache — that's the only way to clear a hydration
 * mismatch on the *current* navigation.
 */
async function cleanupLeftoverServiceWorker(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0 && !navigator.serviceWorker.controller) {
      return;
    }

    await Promise.all(registrations.map((reg) => reg.unregister()));

    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    if (navigator.serviceWorker.controller) {
      window.location.reload();
    }
  } catch (err) {
    console.warn("Service worker cleanup failed:", err);
  }
}
