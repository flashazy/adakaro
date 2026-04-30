/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    /** Replaced by the Serwist build with the actual precache manifest. */
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  /**
   * Defaults already cover the requested strategies:
   *   - API routes (`/api/*`) → NetworkFirst
   *   - Same-origin navigations (HTML pages) → NetworkFirst
   *   - Static fonts/images → CacheFirst
   *   - Static JS/CSS / Next data → StaleWhileRevalidate
   * See `@serwist/next/worker` `defaultCache` for the full rule set.
   */
  runtimeCaching: defaultCache,
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
