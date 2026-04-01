import type { NextRequest } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/supabase";

export type AdminActivityLogRole = "admin" | "super_admin";

const SENSITIVE_DETAIL_KEYS = new Set([
  "password",
  "password_hash",
  "token",
  "secret",
  "api_key",
  "apikey",
  "authorization",
  "parent_email",
  "parent_phone",
  "parent_name",
  "full_name",
  "invited_email",
  "email",
  "phone",
  "student_name",
  "notes",
]);

function sanitizeDetailsValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > 500) return `${value.slice(0, 500)}…`;
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeDetailsValue(v));
  }
  if (typeof value === "object") {
    return sanitizeDetailsObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeDetailsObject(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = k.toLowerCase();
    if (SENSITIVE_DETAIL_KEYS.has(keyLower)) continue;
    if (keyLower.includes("password") || keyLower.includes("token")) continue;
    out[k] = sanitizeDetailsValue(v);
  }
  return out;
}

export function sanitizeActionDetails(
  details: Record<string, unknown>
): Json {
  return sanitizeDetailsObject(details) as Json;
}

function getClientIp(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip");
}

function mapProfileRoleToLogRole(
  role: string | null | undefined
): AdminActivityLogRole {
  return role === "super_admin" ? "super_admin" : "admin";
}

export interface LogAdminActionParams {
  userId: string;
  action: string;
  details?: Record<string, unknown>;
  schoolId?: string | null;
  /** Next.js API route request */
  request?: NextRequest;
  /** `headers()` from next/headers (server actions / server components) */
  headerList?: Headers;
}

/**
 * Writes an append-only audit row via service role. Swallows errors so callers never fail.
 */
export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  const { userId, action, schoolId } = params;
  const rawDetails = params.details ?? {};
  const h =
    params.request?.headers ?? params.headerList ?? null;

  try {
    let headerSource: Headers;
    if (h) {
      headerSource = h;
    } else {
      try {
        headerSource = await headers();
      } catch {
        headerSource = new Headers();
      }
    }

    const admin = createAdminClient();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("email, role")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[admin-activity-log] profile fetch:", profileErr.message);
      }
    }

    const prof = profile as { email: string | null; role: string } | null;
    const userEmail = prof?.email?.trim() ?? "";
    const userRole = mapProfileRoleToLogRole(prof?.role);

    const ip = getClientIp(headerSource);
    const ua = headerSource.get("user-agent");

    const { error: insErr } = await admin.from("admin_activity_logs").insert({
      user_id: userId,
      user_email: userEmail,
      user_role: userRole,
      school_id: schoolId ?? null,
      action,
      action_details: sanitizeActionDetails(rawDetails),
      ip_address: ip,
      user_agent: ua,
    } as never);

    if (insErr) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[admin-activity-log] insert:", insErr.message);
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[admin-activity-log]",
        e instanceof Error ? e.message : e
      );
    }
  }
}

/**
 * For server actions that don't have a `Request` — uses `headers()` from Next.js.
 */
export async function logAdminActionFromServerAction(
  userId: string,
  action: string,
  details: Record<string, unknown>,
  schoolId?: string | null
): Promise<void> {
  let headerList: Headers | undefined;
  try {
    headerList = await headers();
  } catch {
    headerList = undefined;
  }
  await logAdminAction({
    userId,
    action,
    details,
    schoolId,
    headerList,
  });
}
