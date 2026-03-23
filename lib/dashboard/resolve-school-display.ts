import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { parseSchoolDashboardRpc } from "@/lib/dashboard/parse-school-dashboard-rpc";

export interface ResolvedSchoolDisplay {
  schoolId: string;
  name: string;
  currency: string | null;
}

/**
 * Load school id + name + currency for dashboard UI using service role when
 * available (bypasses RLS). Otherwise uses RPC + user-scoped queries (works
 * with migration 00031 membership policy on public.schools).
 */
async function fetchSchoolDisplayViaAdmin(
  userId: string
): Promise<ResolvedSchoolDisplay | null> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data: mem } = await admin
    .from("school_members")
    .select("school_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let schoolId =
    (mem as { school_id: string } | null)?.school_id ?? null;

  if (!schoolId) {
    const { data: created } = await admin
      .from("schools")
      .select("id")
      .eq("created_by", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    schoolId = (created as { id: string } | null)?.id ?? null;
  }

  if (!schoolId) return null;

  const { data: school } = await admin
    .from("schools")
    .select("name, currency")
    .eq("id", schoolId)
    .maybeSingle();

  const row = school as { name: string; currency: string | null } | null;
  const name = row?.name?.trim() ?? "";
  return {
    schoolId,
    name,
    currency: row?.currency ?? null,
  };
}

/**
 * Resolves the authenticated user's primary school for headers, currency, etc.
 * Call only from server code with `user.id` from `getUser()` — never pass client input.
 */
export async function resolveSchoolDisplay(
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<ResolvedSchoolDisplay | null> {
  const adminFirst = await fetchSchoolDisplayViaAdmin(userId);
  if (adminFirst && adminFirst.name.length > 0) {
    return adminFirst;
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "get_my_school_for_dashboard",
    {} as never
  );

  if (!rpcErr) {
    const parsed = parseSchoolDashboardRpc(rpcData as unknown);
    if (parsed?.school_id) {
      let name = parsed.name.trim();
      let currency = parsed.currency;
      if (!name) {
        const { data: row } = await supabase
          .from("schools")
          .select("name, currency")
          .eq("id", parsed.school_id)
          .maybeSingle();
        const r = row as { name: string; currency: string | null } | null;
        name = r?.name?.trim() ?? "";
        currency = r?.currency ?? currency;
      }
      if (name.length > 0) {
        return {
          schoolId: parsed.school_id,
          name,
          currency,
        };
      }
    }
  }

  const schoolId = await getSchoolIdForUser(supabase, userId);
  if (!schoolId) {
    return null;
  }

  const { data: row } = await supabase
    .from("schools")
    .select("name, currency")
    .eq("id", schoolId)
    .maybeSingle();

  const r = row as { name: string; currency: string | null } | null;
  let name = r?.name?.trim() ?? "";
  let currency = r?.currency ?? null;

  if (!name && adminFirst?.schoolId === schoolId) {
    name = adminFirst.name;
    currency = adminFirst.currency ?? currency;
  }

  if (!name) {
    const again = await fetchSchoolDisplayViaAdmin(userId);
    if (again?.name) {
      return again;
    }
  }

  if (!name) {
    return { schoolId, name: "", currency };
  }

  return { schoolId, name, currency };
}

/**
 * Read `schools.currency` by id using service role when set (e.g. receipt page
 * where RLS may block direct `schools` select). Falls back to null.
 */
export async function getSchoolCurrencyById(
  schoolId: string
): Promise<string | null> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("schools")
      .select("currency")
      .eq("id", schoolId)
      .maybeSingle();
    return (data as { currency: string | null } | null)?.currency ?? null;
  } catch {
    return null;
  }
}
