"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/currency";

interface ClickPesaPayButtonProps {
  studentId: string;
  feeStructureId: string;
  feeName: string;
  amount: number;
  /** School display currency (TZS, KES, UGX, USD) */
  currencyCode: string;
}

type PayApiResponse = {
  controlNumber?: string | null;
  checkoutLink?: string | null;
  error?: string;
  clickpesaNote?: string;
};

export default function ClickPesaPayButton({
  studentId,
  feeStructureId,
  feeName,
  amount,
  currencyCode,
}: ClickPesaPayButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [controlNumber, setControlNumber] = useState("");
  const [checkoutLink, setCheckoutLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [clickpesaNote, setClickpesaNote] = useState<string | null>(null);
  const openedCheckoutRef = useRef(false);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    openedCheckoutRef.current = false;
    setClickpesaNote(null);
    router.refresh();
  }, [router]);

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

  const handlePay = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clickpesa/generate-control-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          feeStructureId,
          amount,
          feeName,
        }),
      });
      const data = (await res.json()) as PayApiResponse;
      if (!res.ok) {
        throw new Error(
          data.error || "Unable to start payment. Please try again."
        );
      }
      setControlNumber(data.controlNumber?.trim() || "");
      setCheckoutLink(data.checkoutLink?.trim() || "");
      setClickpesaNote(data.clickpesaNote?.trim() || null);
      setModalOpen(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      alert(msg);
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

  /** Prefer <a href> so mobile browsers open the page reliably (avoids popup blockers). */
  const onCheckoutNavStart = () => {
    openedCheckoutRef.current = true;
    router.refresh();
  };

  const hasBillPay = Boolean(controlNumber);
  const hasCheckout = Boolean(checkoutLink);

  return (
    <>
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-school-primary px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <span
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
              aria-hidden
            />
            Preparing…
          </>
        ) : (
          "Pay online"
        )}
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clickpesa-pay-title"
        >
          <div className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl isolate [touch-action:manipulation] dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <h2
                  id="clickpesa-pay-title"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                >
                  Pay {formatCurrency(amount, currencyCode)}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
                  {feeName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-4 sm:grid-cols-1">
                {clickpesaNote ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    {clickpesaNote}
                  </p>
                ) : null}
                {/* BillPay */}
                <section
                  className={`rounded-xl border p-4 ${
                    hasBillPay
                      ? "border-[rgb(var(--school-primary-rgb)/0.25)] bg-[rgb(var(--school-primary-rgb)/0.08)] dark:border-[rgb(var(--school-primary-rgb)/0.28)] dark:bg-[rgb(var(--school-primary-rgb)/0.12)]"
                      : "border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50"
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--school-primary-rgb)/0.16)] text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.16)] dark:text-school-primary">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V9.75a2.25 2.25 0 0 0-.659-1.591l-5.25-5.25A2.25 2.25 0 0 0 10.5 1.5Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 2.25V6a.75.75 0 0 0 .75.75h3.75" />
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
                        <code className="min-w-0 flex-1 break-all rounded-lg border border-[rgb(var(--school-primary-rgb)/0.25)] bg-white px-3 py-2.5 text-center font-mono text-base font-semibold tracking-wide text-slate-900 dark:border-[rgb(var(--school-primary-rgb)/0.32)] dark:bg-zinc-900 dark:text-white">
                          {controlNumber}
                        </code>
                        <button
                          type="button"
                          onClick={copyControlNumber}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[rgb(var(--school-primary-rgb)/0.35)] bg-white px-4 py-2.5 text-sm font-medium text-school-primary shadow-sm transition hover:bg-[rgb(var(--school-primary-rgb)/0.10)] dark:border-[rgb(var(--school-primary-rgb)/0.45)] dark:bg-zinc-900 dark:text-school-primary dark:hover:bg-[rgb(var(--school-primary-rgb)/0.18)]"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                          </svg>
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-slate-600 dark:text-zinc-400">
                        <li>Open M‑Pesa, Tigo Pesa, or Airtel Money.</li>
                        <li>Choose <strong>Pay bill</strong> or equivalent.</li>
                        <li>Enter the control number above as the bill / reference number.</li>
                        <li>Confirm the amount and complete payment.</li>
                      </ol>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      We couldn’t create a payment number. Please close and try
                      again, or contact the school if this keeps happening.
                    </p>
                  )}
                </section>

                {hasBillPay && !hasCheckout && (
                  <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-center text-xs text-slate-600 dark:bg-zinc-800/80 dark:text-zinc-400">
                    <span className="font-medium text-slate-700 dark:text-zinc-300">
                      Pay online (card / bank)
                    </span>
                    <span className="mt-0.5 block">
                      Coming soon — use mobile money above for now.
                    </span>
                  </p>
                )}

                {/* Hosted checkout — only when API returns a link */}
                {hasCheckout && (
                  <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          Pay online (hosted checkout)
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          Secure page on ClickPesa — cards &amp; wallets where enabled
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
                      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v9A2.25 2.25 0 0 0 5.25 19.5h13.5A2.25 2.25 0 0 0 21 17.25V9.75m-9-6v12m0 0 3-3m-3 3-3-3M12 3h7.5A2.25 2.25 0 0 1 21 5.25v.75" />
                      </svg>
                      Open ClickPesa payment page
                    </a>
                    <p className="mt-2 break-all text-center text-[11px] text-slate-500 dark:text-zinc-500">
                      If the button doesn’t respond, long-press and choose “Open link”.
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
                      After paying, return here — we refresh your balance when you switch back to this tab.
                    </p>
                  </section>
                )}
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
    </>
  );
}
