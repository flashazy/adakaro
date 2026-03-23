import { headers } from "next/headers";
import type {
  LoadSuperAdminDashboardResult,
  SuperAdminSchoolRow,
  SuperAdminStats,
} from "@/lib/super-admin/load-dashboard-data";

function resolveAppOrigin(h: Headers): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (envUrl) {
    return envUrl;
  }
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Server-only: call GET /api/super-admin/dashboard-data with the incoming Cookie header.
 * Use this from Server Components so dashboard reads run in a Route Handler context.
 */
export async function fetchSuperAdminDashboardFromApi(): Promise<LoadSuperAdminDashboardResult> {
  try {
    const h = await headers();
    const cookie = h.get("cookie");
    if (!cookie) {
      return {
        ok: false,
        message: "Missing Cookie header — cannot load super admin dashboard via API.",
      };
    }

    const base = resolveAppOrigin(h);
    const url = `${base}/api/super-admin/dashboard-data`;

    if (process.env.NODE_ENV === "development") {
      console.info("[super-admin/dashboard] fetching", url);
    }

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { cookie },
    });

    const body = (await res.json()) as {
      error?: string;
      stats?: SuperAdminStats;
      schools?: SuperAdminSchoolRow[];
    };

    if (!res.ok) {
      return {
        ok: false,
        message: body.error ?? `Dashboard API HTTP ${res.status}`,
      };
    }

    if (!body.stats || !Array.isArray(body.schools)) {
      return {
        ok: false,
        message: "Dashboard API returned an unexpected JSON shape.",
      };
    }

    return {
      ok: true,
      stats: body.stats,
      schools: body.schools,
    };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? `fetchSuperAdminDashboardFromApi: ${e.message}`
          : String(e),
    };
  }
}
