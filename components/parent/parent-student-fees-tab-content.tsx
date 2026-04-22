import Link from "next/link";
import ClickPesaPayButton from "@/components/ClickPesaPayButton";
import { formatCurrency } from "@/lib/currency";

/** Matches `student_fee_balances` / parent dashboard fee rows. */
export type ParentFeeBalanceRow = {
  student_id: string;
  fee_structure_id: string;
  fee_name: string;
  total_fee: number;
  total_paid: number;
  balance: number;
  due_date: string | null;
};

export type ParentFeePaymentRow = {
  id: string;
  student_id: string;
  amount: number;
  payment_method: string | null;
  payment_date: string;
  reference_number: string | null;
  fee_structure: { name: string } | null;
  receipt: { id: string; receipt_number: string } | null;
};

/**
 * Full per-student fee layout (summary, outstanding lines, payment history) — same
 * structure as the admin Record payment / payments UI, adapted for parents
 * (ClickPesa + parent receipt links).
 * Single root `div` so the parent dashboard tab panel receives one child.
 */
export function ParentStudentFeesTabContent({
  studentId,
  currencyCode,
  balances,
  payments,
}: {
  studentId: string;
  currencyCode: string;
  balances: ParentFeeBalanceRow[];
  payments: ParentFeePaymentRow[];
}) {
  const sc = currencyCode;
  const money = (n: number) => formatCurrency(n, sc);
  const sTotalFee = balances.reduce((sum, b) => sum + Number(b.total_fee), 0);
  const sTotalPaid = balances.reduce(
    (sum, b) => sum + Number(b.total_paid),
    0
  );
  const sBalance = balances.reduce((sum, b) => sum + Number(b.balance), 0);
  const outstandingFees = balances.filter((b) => b.balance > 0);
  const sCollectionPct =
    sTotalFee > 0 ? Math.round((sTotalPaid / sTotalFee) * 100) : 0;

  return (
    <div className="min-w-0">
      {/* Summary — matches parent card MiniStat row */}
      <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/40">
        <MiniStat
          label="Total Fees"
          value={money(sTotalFee)}
          icon={
            <svg
              className="h-3.5 w-3.5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          }
        />
        <MiniStat
          label="Paid"
          value={money(sTotalPaid)}
          color="emerald"
          subtitle={sTotalFee > 0 ? `${sCollectionPct}% of fees` : undefined}
          icon={
            <svg
              className="h-3.5 w-3.5 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          }
        />
        <MiniStat
          label="Balance"
          value={money(sBalance)}
          color={sBalance > 0 ? "amber" : undefined}
          icon={
            <svg
              className="h-3.5 w-3.5 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          }
        />
      </div>

      {/* Outstanding — aligned with admin `payment-client` fee rows + parent pay */}
      {outstandingFees.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50/40 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2 border-b border-slate-200/80 px-6 py-3 dark:border-zinc-800">
            <svg
              className="h-4 w-4 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Outstanding fees
            </p>
          </div>
          <div className="divide-y divide-slate-200/80 dark:divide-zinc-800/50">
            {outstandingFees.map((b) => (
              <div
                key={b.fee_structure_id}
                className="flex flex-col gap-2 px-6 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-900 dark:text-white">
                    {b.fee_name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {money(Number(b.total_paid))} of {money(Number(b.total_fee))}{" "}
                    paid
                    {b.due_date ? ` · Due ${b.due_date}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ClickPesaPayButton
                    studentId={studentId}
                    feeStructureId={b.fee_structure_id}
                    feeName={b.fee_name}
                    amount={Number(b.balance)}
                    currencyCode={sc}
                  />
                  <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {money(Number(b.balance))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent payments — same information density as `PaymentClient` */}
      {payments.length > 0 ? (
        <div className="bg-white dark:bg-zinc-900/40">
          <div className="flex items-center gap-2 border-b border-slate-200/80 px-6 py-3 dark:border-zinc-800">
            <svg
              className="h-4 w-4 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
              />
            </svg>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400/90">
              Recent payments
            </p>
          </div>

          <div className="divide-y divide-slate-200/80 dark:divide-zinc-800/50">
            {payments.map((p) => {
              const feeStructure = p.fee_structure as { name: string } | null;
              const receipt = p.receipt as {
                id: string;
                receipt_number: string;
              } | null;

              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-6 py-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/20">
                    <svg
                      className="h-4 w-4 text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {money(Number(p.amount))}
                      <span className="ml-2 text-xs font-normal text-slate-500 dark:text-zinc-400">
                        {feeStructure?.name ?? "Payment"}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {p.payment_date}
                      {p.payment_method
                        ? ` · ${p.payment_method.replace(/_/g, " ")}`
                        : ""}
                    </p>
                    {p.reference_number ? (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">
                        Ref: {p.reference_number}
                      </p>
                    ) : null}
                  </div>

                  {receipt ? (
                    <Link
                      href={`/parent-dashboard/receipts/${p.id}`}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                        />
                      </svg>
                      <span className="hidden sm:inline">
                        {receipt.receipt_number}
                      </span>
                      <span className="sm:hidden">Receipt</span>
                    </Link>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-400 dark:text-zinc-500">
                      No receipt
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-6 py-8 text-center">
          <svg
            className="mx-auto h-8 w-8 text-slate-300 dark:text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
            />
          </svg>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            No payments recorded yet.
          </p>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
  subtitle,
  icon,
}: {
  label: string;
  value: string;
  color?: "emerald" | "amber";
  subtitle?: string;
  icon: React.ReactNode;
}) {
  const valueColor =
    color === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : color === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-900 dark:text-white";

  return (
    <div className="px-3 py-3 text-center sm:px-4">
      <div className="mb-1 flex items-center justify-center gap-1">
        {icon}
        <p className="text-xs text-slate-500 dark:text-zinc-400">{label}</p>
      </div>
      <p className={`text-sm font-semibold ${valueColor}`}>{value}</p>
      {subtitle ? (
        <p className="mt-0.5 text-[11px] leading-tight text-slate-500 dark:text-zinc-500">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
