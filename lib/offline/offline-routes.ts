/**
 * Offline-capable dashboard routes.
 *
 * IMPORTANT — what "offline-capable" means here.
 *
 * These routes are **runtime-cached** by the service worker on first
 * visit (StaleWhileRevalidate). They are *not* truly precached at SW
 * install time — that's not possible because:
 *
 *   1. The pages are server-rendered behind auth. Fetching them from a
 *      service worker without the user's session cookies would either
 *      redirect to /login or render a logged-out shell.
 *   2. The HTML is per-user (school colors, class options, role-aware
 *      navigation, etc.), so a shared install-time copy would be wrong
 *      for almost everyone.
 *
 * In practice this means: the very first visit must happen online; from
 * then on the route is available offline until the cache entry is evicted
 * (or the user explicitly clears site data).
 *
 * This file is the single source of truth — both `app/sw.ts` and the
 * `/offline` fallback page import it. Adding a new offline-capable route
 * is a one-line change here.
 */

export interface OfflineRoute {
  /** Absolute URL path (no query string). */
  path: string;
  /** Human-readable label shown in the offline fallback list. */
  label: string;
  /** One-sentence description for the offline fallback list. */
  description: string;
  /** Audience the route is meant for — used to pick the right icon. */
  audience: "teacher" | "school-admin";
}

export const OFFLINE_ROUTES: readonly OfflineRoute[] = [
  {
    path: "/teacher-dashboard/attendance",
    label: "Attendance",
    description: "Record daily attendance for your classes.",
    audience: "teacher",
  },
  {
    path: "/teacher-dashboard/grades",
    label: "Grades",
    description: "Enter and review marks for assignments.",
    audience: "teacher",
  },
  {
    path: "/teacher-dashboard/students",
    label: "My students",
    description: "Look up students you teach.",
    audience: "teacher",
  },
  {
    path: "/teacher-dashboard/sync-status",
    label: "Sync status",
    description: "Manage offline saves waiting to sync.",
    audience: "teacher",
  },
  {
    path: "/dashboard/students",
    label: "Students (school)",
    description: "Browse the school student roster.",
    audience: "school-admin",
  },
  {
    path: "/dashboard/classes",
    label: "Classes",
    description: "Browse classes and streams.",
    audience: "school-admin",
  },
];

/** Map used inside the SW: { "/teacher-dashboard/attendance": true, ... } */
export const OFFLINE_ROUTE_LOOKUP: Readonly<Record<string, true>> =
  Object.freeze(
    Object.fromEntries(OFFLINE_ROUTES.map((r) => [r.path, true as const]))
  );

/**
 * The SW matches navigation requests by URL pathname. Returns true when
 * the given URL should be runtime-cached as an offline-capable page.
 *
 * We match on exact pathname only — not prefix — so deep links like
 * `/teacher-dashboard/attendance/some-class` don't accidentally pollute
 * the cache. Most listed pages take query params instead of route params.
 */
export function isOfflineCapableRoute(pathname: string): boolean {
  return OFFLINE_ROUTE_LOOKUP[pathname] === true;
}

/** Cache name used by the SW; bump the version to invalidate all entries. */
export const OFFLINE_PAGES_CACHE = "adakaro-offline-pages-v1";
