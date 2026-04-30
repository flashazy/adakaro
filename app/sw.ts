/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import {
  ExpirationPlugin,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import {
  OFFLINE_PAGES_CACHE,
  OFFLINE_ROUTE_LOOKUP,
} from "../lib/offline/offline-routes";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    /** Replaced by the Serwist build with the actual precache manifest. */
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Runtime cache for "offline-capable" dashboard pages.
 *
 * Strategy: StaleWhileRevalidate — first visit fills the cache from the
 * network; subsequent visits return the cached HTML immediately and
 * refresh it in the background. When offline the cached HTML is served.
 *
 * Why this isn't real precaching: see the comment block at the top of
 * `lib/offline/offline-routes.ts`. Auth-gated, per-user pages cannot be
 * fetched at SW install time.
 *
 * The match function does an exact pathname check, so deep links don't
 * pollute the cache with one entry per query-param permutation. We
 * additionally guard `request.mode === "navigate"` (top-level page loads)
 * to avoid caching `<link rel="prefetch">` or RSC payloads under the
 * same key — those have different response shapes.
 */
const offlinePagesRuntimeCaching: RuntimeCaching = {
  matcher({ request, url, sameOrigin }) {
    if (!sameOrigin) return false;
    if (request.mode !== "navigate") return false;
    return OFFLINE_ROUTE_LOOKUP[url.pathname] === true;
  },
  handler: new StaleWhileRevalidate({
    cacheName: OFFLINE_PAGES_CACHE,
    plugins: [
      new ExpirationPlugin({
        // 7 days — long enough to cover a school week without a re-fetch,
        // short enough that role/permission changes propagate within a
        // reasonable window. The user can also force-refresh by clearing
        // site data.
        maxAgeSeconds: 7 * 24 * 60 * 60,
        maxEntries: 32,
        // We never cache login redirects; if Next ever returned a 3xx
        // here, the SW would skip caching automatically.
      }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  /**
   * Order matters: our offline-pages rule runs before `defaultCache`'s
   * generic page rule so the matched routes get StaleWhileRevalidate
   * (offline-friendly) rather than NetworkFirst (offline-blank).
   */
  runtimeCaching: [offlinePagesRuntimeCaching, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
