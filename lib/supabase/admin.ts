/**
 * Supabase admin client with service role key.
 * Use only in server-side code (API routes, Server Components, server actions).
 * Never expose the service role key to the browser.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/** Strip whitespace and optional wrapping quotes from .env values. */
export function normalizeServiceRoleKey(
  raw: string | undefined | null
): string | undefined {
  if (raw == null) return undefined;
  let k = String(raw).trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  return k.length > 0 ? k : undefined;
}

/**
 * In development, warn if the key is not a service_role JWT (common mistake: anon key).
 */
function warnIfKeyIsNotServiceRole(serviceRoleKey: string): void {
  if (process.env.NODE_ENV !== "development") return;
  const parts = serviceRoleKey.split(".");
  if (parts.length < 2) {
    console.warn(
      "[supabase/admin] SUPABASE_SERVICE_ROLE_KEY does not look like a JWT. Supabase service_role keys are normally three dot-separated segments."
    );
    return;
  }
  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as { role?: string };
    if (payload.role && payload.role !== "service_role") {
      console.warn(
        `[supabase/admin] JWT "role" is "${payload.role}" (expected "service_role"). You may have pasted the anon/public key — use Project Settings → API → service_role secret.`
      );
    }
  } catch {
    console.warn("[supabase/admin] Could not decode JWT payload from key.");
  }
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = normalizeServiceRoleKey(
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (check .env.local — no duplicate/conflicting lines)."
    );
  }

  warnIfKeyIsNotServiceRole(serviceRoleKey);

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
