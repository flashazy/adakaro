import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPaymentRecorderLine } from "@/lib/payment-recorder-label";
import type { ProfilePaymentRow } from "@/lib/student-profile-auto-data";
import type { Database, UserRole } from "@/types/supabase";

const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

function firstParam(
  v: string | string[] | undefined
): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function validYmd(s: string | undefined | null): string | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  if (!DATE_YMD.test(t)) return null;
  return t;
}

export const PROFILE_PMT_PER_OPTIONS = [10, 25, 50] as const;
export type ProfilePmtPerPage = (typeof PROFILE_PMT_PER_OPTIONS)[number];

export type ProfilePaymentListQuery = {
  q: string;
  from: string | null;
  to: string | null;
  page: number;
  per: ProfilePmtPerPage;
  offset: number;
};

/**
 * Read ?pmt_q= &pmt_from= &pmt_to= &pmt_page= &pmt_per= (student profile payment history).
 */
/** Rebuilds `?pmt_…=…` (stable ordering not guaranteed). */
export function serializeProfilePaymentListQuery(
  q: ProfilePaymentListQuery
): string {
  const p = new URLSearchParams();
  if (q.q) p.set("pmt_q", q.q);
  if (q.from) p.set("pmt_from", q.from);
  if (q.to) p.set("pmt_to", q.to);
  p.set("pmt_page", String(q.page));
  p.set("pmt_per", String(q.per));
  return p.toString();
}

export function parseProfilePaymentListQuery(
  searchParams: Readonly<URLSearchParams | Record<string, string | string[] | undefined>>
): ProfilePaymentListQuery {
  const get = (k: string) => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(k) ?? "";
    }
    const r = searchParams as Record<string, string | string[] | undefined>;
    return firstParam(r[k]) ?? "";
  };

  const q = get("pmt_q").trim();
  const from = validYmd(get("pmt_from"));
  const to = validYmd(get("pmt_to"));

  let page = Math.max(1, parseInt(get("pmt_page") || "1", 10) || 1);
  if (Number.isNaN(page) || !Number.isFinite(page)) page = 1;

  const rawPer = parseInt(get("pmt_per") || "10", 10) || 10;
  const per: ProfilePmtPerPage = PROFILE_PMT_PER_OPTIONS.includes(
    rawPer as ProfilePmtPerPage
  )
    ? (rawPer as ProfilePmtPerPage)
    : 10;

  return {
    q,
    from,
    to,
    page,
    per,
    offset: (page - 1) * per,
  };
}

/**
 * If any pmt_ query key is present, the profile can open the Finance tab by default
 * (payment filters in the URL).
 */
export function profilePaymentListUrlIsActive(
  searchParams: Readonly<URLSearchParams | Record<string, string | string[] | undefined>>
): boolean {
  if (searchParams instanceof URLSearchParams) {
    for (const k of searchParams.keys()) {
      if (k.startsWith("pmt_")) return true;
    }
    return false;
  }
  return Object.keys(searchParams).some((k) => k.startsWith("pmt_"));
}

type PgPaymentRow = {
  id: string;
  amount: number;
  recorded_at: string;
  recorded_by_name: string | null;
  recorded_by_role: string | null;
  reference_number: string | null;
  /** Present for UI; from joined receipts in SQL. */
  payment_date: string;
  receipt_number: string | null;
};

function paymentRowToProfile(
  r: PgPaymentRow
): ProfilePaymentRow {
  const line = formatPaymentRecorderLine(
    r.recorded_by_name,
    (r.recorded_by_role as UserRole) ?? null
  );
  return {
    id: r.id,
    amount: Number(r.amount),
    recorded_at: r.recorded_at,
    recorded_by_line: line,
    receipt_number: r.receipt_number,
    reference_number: r.reference_number,
  };
}

function toTotalCount(n: unknown): number {
  if (n == null) return 0;
  if (typeof n === "number" && Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  if (typeof n === "string" && n.trim() !== "") {
    const t = Math.trunc(Number(n));
    return Number.isFinite(t) && t >= 0 ? t : 0;
  }
  return 0;
}

const rpcBaseArgs = (studentId: string, query: ProfilePaymentListQuery, schoolTimezone: string) => ({
  p_student_id: studentId,
  p_q: query.q.length > 0 ? query.q : null,
  p_from: query.from,
  p_to: query.to,
  p_school_timezone: schoolTimezone,
});

/**
 * Paged, filtered student payments via set-returning `get_student_payments` + `get_student_payments_count`
 * (same search / date / pagination as before).
 */
export async function loadProfilePaymentHistoryPage(
  supabase: SupabaseClient<Database>,
  studentId: string,
  query: ProfilePaymentListQuery,
  schoolTimezone: string
): Promise<{ rows: ProfilePaymentRow[]; total: number; error: string | null }> {
  const base = rpcBaseArgs(studentId, query, schoolTimezone);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const [rowsRes, countRes] = await Promise.all([
    client.rpc("get_student_payments", {
      ...base,
      p_limit: query.per,
      p_offset: query.offset,
    }),
    client.rpc("get_student_payments_count", {
      p_student_id: base.p_student_id,
      p_q: base.p_q,
      p_from: base.p_from,
      p_to: base.p_to,
      p_school_timezone: base.p_school_timezone,
    }),
  ]);

  if (rowsRes.error) {
    return { rows: [], total: 0, error: String(rowsRes.error.message ?? rowsRes.error) };
  }
  if (countRes.error) {
    return { rows: [], total: 0, error: String(countRes.error.message ?? countRes.error) };
  }

  const raw = rowsRes.data as PgPaymentRow[] | null | undefined;
  const list = Array.isArray(raw) ? raw : [];
  const total = toTotalCount(countRes.data);

  return {
    rows: list.map((r) => paymentRowToProfile(r as PgPaymentRow)),
    total,
    error: null,
  };
}
