"use client";

import { formatCurrency } from "@/lib/currency";
import { formatPaymentRecordedAtInSchoolZone } from "@/lib/school-timezone";
import type { ProfilePaymentRow } from "@/lib/student-profile-auto-data";
import type { ProfilePmtPerPage } from "@/lib/student-profile-payments-list";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const inputClass =
  "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white";
const labelClass = "text-xs font-medium text-slate-600 dark:text-zinc-400";

type Props = {
  payments: ProfilePaymentRow[];
  total: number;
  page: number;
  per: ProfilePmtPerPage;
  q: string;
  from: string | null;
  to: string | null;
  displayTimezone: string;
  currencyCode: string;
};

function pmtQueryString(refs: {
  q: string;
  from: string | null;
  to: string | null;
  page: number;
  per: number;
}): string {
  const p = new URLSearchParams();
  if (refs.q) p.set("pmt_q", refs.q);
  if (refs.from) p.set("pmt_from", refs.from);
  if (refs.to) p.set("pmt_to", refs.to);
  p.set("pmt_page", String(refs.page));
  p.set("pmt_per", String(refs.per));
  return p.toString();
}

export function ProfilePaymentHistory({
  payments,
  total,
  page,
  per,
  q,
  from,
  to,
  displayTimezone,
  currencyCode,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const money = (n: number) => formatCurrency(n, currencyCode);

  const filterActive = Boolean((q && q.length > 0) || from || to);
  const fromIdx = total === 0 ? 0 : (page - 1) * per + 1;
  const toIdx = Math.min(page * per, total);
  const hasPrev = page > 1;
  const hasNext = page * per < total;

  const prevQuery = pmtQueryString({ q, from, to, page: page - 1, per });
  const nextQuery = pmtQueryString({ q, from, to, page: page + 1, per });

  function onPerChange(nextPer: string) {
    const n = Number(nextPer) || 10;
    if (![10, 25, 50].includes(n)) return;
    const qs = pmtQueryString({ q, from, to, page: 1, per: n });
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
        Payment history
      </h3>

      <form
        key={[q, from ?? "", to ?? "", per, page].join("|")}
        method="get"
        action={pathname}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/40"
      >
        <div>
          <label className={labelClass} htmlFor="pmt_q_in">
            Search
          </label>
          <input
            id="pmt_q_in"
            name="pmt_q"
            type="search"
            defaultValue={q}
            autoComplete="off"
            placeholder="Search by recorded by, amount, or reference"
            className={inputClass + " mt-0.5"}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="pmt_from_in">
              From
            </label>
            <input
              id="pmt_from_in"
              name="pmt_from"
              type="date"
              defaultValue={from ?? ""}
              className={inputClass + " mt-0.5 tabular-nums"}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="pmt_to_in">
              To
            </label>
            <input
              id="pmt_to_in"
              name="pmt_to"
              type="date"
              defaultValue={to ?? ""}
              className={inputClass + " mt-0.5 tabular-nums"}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-zinc-500">
          Date range is interpreted in the school&apos;s local time zone
          ({displayTimezone}).
        </p>
        <input type="hidden" name="pmt_page" value="1" />
        <input type="hidden" name="pmt_per" value={per} />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-lg bg-school-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-105"
          >
            Apply filters
          </button>
          <Link
            href={pathname}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Clear filters
          </Link>
        </div>
      </form>

      {total === 0 && !filterActive ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400" role="status">
          No payments recorded yet.
        </p>
      ) : null}

      {total === 0 && filterActive ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400" role="status">
          No payments match the current filters.
        </p>
      ) : null}

      {total > 0 && payments.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400" role="status">
          No results on this page. Try a previous page or clear filters.
        </p>
      ) : null}

      {total > 0 && payments.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-zinc-800">
              <thead className="bg-slate-50 dark:bg-zinc-800/80">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                    Date &amp; time
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                    Recorded by
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                    Receipt
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                    Reference
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-800 dark:text-zinc-200">
                      {formatPaymentRecordedAtInSchoolZone(
                        p.recorded_at,
                        displayTimezone
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-900 dark:text-zinc-100">
                      {money(p.amount)}
                    </td>
                    <td className="min-w-[10rem] max-w-[200px] px-3 py-2 text-slate-800 dark:text-zinc-200">
                      {p.recorded_by_line}
                    </td>
                    <td className="px-3 py-2">
                      {p.receipt_number ? (
                        <Link
                          href={`/dashboard/receipts/${p.id}`}
                          className="font-mono text-sm text-school-primary hover:opacity-90 dark:text-school-primary"
                        >
                          {p.receipt_number}
                        </Link>
                      ) : (
                        <Link
                          href={`/dashboard/receipts/${p.id}`}
                          className="text-sm text-school-primary hover:opacity-90 dark:text-school-primary"
                        >
                          View
                        </Link>
                      )}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-slate-600 dark:text-zinc-400">
                      {p.reference_number ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Showing {fromIdx}–{toIdx} of {total} payment{total === 1 ? "" : "s"}
            </p>
            <label
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400"
              htmlFor="pmt_per_sel"
            >
              Rows per page
              <select
                id="pmt_per_sel"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                value={per}
                onChange={(e) => onPerChange(e.target.value)}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              {hasPrev ? (
                <Link
                  href={
                    prevQuery && prevQuery.length > 0
                      ? `${pathname}?${prevQuery}`
                      : pathname
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Previous
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-400 opacity-60 dark:border-zinc-700">
                  Previous
                </span>
              )}
              {hasNext ? (
                <Link
                  href={
                    nextQuery && nextQuery.length > 0
                      ? `${pathname}?${nextQuery}`
                      : pathname
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Next
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-400 opacity-60 dark:border-zinc-700">
                  Next
                </span>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
