import { normalizeServiceRoleKey } from "@/lib/supabase/admin";

export interface SupabaseEnvDiagnostics {
  ok: boolean;
  missing: string[];
  urlSet: boolean;
  anonKeySet: boolean;
  serviceRoleKeySet: boolean;
}

/** Server-only check for required Supabase env vars (Vercel / production debugging). */
export function getSupabaseEnvDiagnostics(): SupabaseEnvDiagnostics {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceRole = normalizeServiceRoleKey(
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!serviceRole) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  return {
    ok: missing.length === 0,
    missing,
    urlSet: Boolean(url),
    anonKeySet: Boolean(anon),
    serviceRoleKeySet: Boolean(serviceRole),
  };
}

export function formatSupabaseEnvError(diag: SupabaseEnvDiagnostics): string {
  if (diag.ok) return "";
  return `Missing server configuration: ${diag.missing.join(", ")}. Add these in Vercel → Project → Settings → Environment Variables, then redeploy.`;
}
