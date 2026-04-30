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
 * Registration is gated to production builds so the SW never installs in
 * `next dev` (matches the `disable={NODE_ENV === "development"}` semantic
 * the official provider uses).
 */
export function SerwistProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
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
