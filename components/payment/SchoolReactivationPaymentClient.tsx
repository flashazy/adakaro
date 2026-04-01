"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { PLANS } from "@/lib/plans";
import type { SuspendedSchoolContext } from "@/lib/payment/school-reactivation";

type CreateOrderResponse = {
  orderReference?: string;
  controlNumber?: string | null;
  checkoutLink?: string | null;
  error?: string;
  billpayError?: string | null;
  checkoutError?: string | null;
  schoolCurrency?: string;
  clickPesaOrderCurrency?: string;
  clickpesaNote?: string;
  clickpesaCurrencyMismatch?: boolean;
};

interface SchoolReactivationPaymentClientProps {
  initial: SuspendedSchoolContext;
}

export default function SchoolReactivationPaymentClient({
  initial,
}: SchoolReactivationPaymentClientProps) {
  const router = useRouter();
  const planLabel = PLANS[initial.plan]?.name ?? initial.plan;

  const [amountInput, setAmountInput] = useState(
    String(Math.round(initial.defaultAmountTz))
  );
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const [controlNumber, setControlNumber] = useState("");
  const [checkoutLink, setCheckoutLink] = useState("");
  const [clickpesaNote, setClickpesaNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [polling, setPolling] = useState(false);
  const openedCheckoutRef = useRef(false);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    openedCheckoutRef.current = false;
    setClickpesaNote(null);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!orderReference || !polling || paid) return;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/payment/school-reactivation/status?orderReference=${encodeURIComponent(orderReference)}`
        );
        const data = (await res.json()) as {
          status?: string;
          schoolActive?: boolean;
          error?: string;
        };
        if (res.ok && data.status === "paid") {
          setPaid(true);
          setPolling(false);
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => window.clearInterval(id);
  }, [orderReference, polling, paid]);

  useEffect(() => {
    if (!modalOpen) return;
    const onVis = () => {
      if (document.visibilityState === "visible" && openedCheckoutRef.current) {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [modalOpen, router]);

  const parseAmount = (): number | null => {
    const n = Number(String(amountInput).replace(/,/g, "").trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  };

  const handlePay = async () => {
    const amount = parseAmount();
    if (amount == null) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/payment/school-reactivation/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, schoolId: initial.schoolId }),
      });
      const data = (await res.json()) as CreateOrderResponse;
      if (!res.ok) {
        throw new Error(
          data.error || "Unable to start payment. Please try again."
        );
      }
      if (!data.orderReference) {
        throw new Error("Invalid response from server.");
      }
      setOrderReference(data.orderReference);
      setControlNumber(data.controlNumber?.trim() || "");
      setCheckoutLink(data.checkoutLink?.trim() || "");
      setClickpesaNote(data.clickpesaNote?.trim() || null);
      setPaid(false);
      setPolling(true);
      setModalOpen(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyControlNumber = async () => {
    if (!controlNumber) return;
    try {
      await navigator.clipboard.writeText(controlNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      alert("Could not copy. Select the number and copy manually.");
    }
  };

  const onCheckoutNavStart = () => {
    openedCheckoutRef.current = true;
    router.refresh();
  };

  const amountNum = parseAmount();
  const displayAmount =
    amountNum != null
      ? formatCurrency(amountNum, initial.currency)
      : "—";

  const hasBillPay = Boolean(controlNumber);
  const hasCheckout = Boolean(checkoutLink);

  if (paid) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50/80 p-8 text-center shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Payment received
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          {initial.name} has been reactivated. You can continue to the dashboard
          or sign in again from the login page if needed.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            Go to dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
              Account status
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              Reactivate your school
            </h1>
          </div>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            Suspended
          </span>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-slate-500 dark:text-zinc-500">
              School
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">
              {initial.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 dark:text-zinc-500">
              Plan
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">
              {planLabel}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-slate-500 dark:text-zinc-500">
              Suspension reason
            </dt>
            <dd className="mt-0.5 text-slate-800 dark:text-zinc-200">
              {initial.suspensionReason?.trim()
                ? initial.suspensionReason
                : "No reason was provided. Contact support if you need details."}
            </dd>
          </div>
        </dl>

        <p className="mt-6 rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-100">
          Completing payment through ClickPesa will reactivate your school
          account so staff and families can use the platform again.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Payment amount
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Suggested amount for the <strong>{planLabel}</strong> plan:{" "}
          {formatCurrency(initial.defaultAmountTz, "TZS")} (configurable by your
          organization). You may enter a custom amount if agreed with support.
        </p>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
            Amount ({initial.currency}) <span className="text-red-600">*</span>
          </span>
          <input
            type="text"
            inputMode="decimal"
            required
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none ring-indigo-500 focus:border-indigo-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            placeholder="e.g. 50000"
            autoComplete="off"
          />
        </label>

        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6">
          <button
            type="button"
            onClick={handlePay}
            disabled={loading}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[200px]"
          >
            {loading ? (
              <>
                <span
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden
                />
                Preparing payment…
              </>
            ) : (
              `Pay ${displayAmount}`
            )}
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reactivation-pay-title"
        >
          <div className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl isolate [touch-action:manipulation] dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <h2
                  id="reactivation-pay-title"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                >
                  Pay {displayAmount}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
                  {initial.name} — reactivation
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-4">
                {clickpesaNote ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    {clickpesaNote}
                  </p>
                ) : null}

                <section
                  className={`rounded-xl border p-4 ${
                    hasBillPay
                      ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/20"
                      : "border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50"
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V9.75a2.25 2.25 0 0 0-.659-1.591l-5.25-5.25A2.25 2.25 0 0 0 10.5 1.5Z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 2.25V6a.75.75 0 0 0 .75.75h3.75"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Mobile money (BillPay)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Pay bill with this control number
                      </p>
                    </div>
                  </div>

                  {hasBillPay ? (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                        <code className="min-w-0 flex-1 break-all rounded-lg border border-indigo-200 bg-white px-3 py-2.5 text-center font-mono text-base font-semibold tracking-wide text-slate-900 dark:border-indigo-900/50 dark:bg-zinc-900 dark:text-white">
                          {controlNumber}
                        </code>
                        <button
                          type="button"
                          onClick={copyControlNumber}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-4 py-2.5 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-50 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                        >
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-slate-600 dark:text-zinc-400">
                        <li>Open M‑Pesa, Tigo Pesa, or Airtel Money.</li>
                        <li>Choose <strong>Pay bill</strong> or equivalent.</li>
                        <li>
                          Enter the control number above as the bill / reference
                          number.
                        </li>
                        <li>Confirm the amount and complete payment.</li>
                      </ol>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      We couldn’t create a payment number. Close and try again,
                      or contact support.
                    </p>
                  )}
                </section>

                {hasCheckout && (
                  <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          Bank transfer &amp; hosted checkout
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          Secure page on ClickPesa — cards and other methods
                          where enabled
                        </p>
                      </div>
                    </div>

                    <a
                      href={checkoutLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onCheckoutNavStart}
                      className="flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:bg-emerald-700"
                    >
                      Open ClickPesa payment page
                    </a>
                    <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">
                      After paying, return to this tab — we detect successful
                      payment automatically when ClickPesa confirms it.
                    </p>
                  </section>
                )}

                <p className="text-center text-xs text-slate-500 dark:text-zinc-500">
                  Order reference:{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-zinc-800">
                    {orderReference}
                  </code>
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={closeModal}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Done
              </button>
            </div>
          </div>

          {copied && (
            <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
              Control number copied
            </div>
          )}
        </div>
      )}
    </div>
  );
}
