import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

export const metadata: Metadata = {
  title: "Pricing — Adakaro",
  description:
    "Simple, transparent pricing for schools. Start free, upgrade as you grow.",
};

/** Rough TZS→USD for display only (approximate). */
function usdApprox(tzs: number): string {
  if (tzs <= 0) return "";
  const usd = tzs / 2650;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(usd);
}

interface FeatureLineProps {
  children: ReactNode;
}

function FeatureLine({ children }: FeatureLineProps) {
  return (
    <li className="flex gap-2.5 text-sm text-slate-600 dark:text-zinc-400">
      <Check
        className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400"
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}

export default function PricingPage() {
  const freePrice = formatCurrency(0, "TZS");
  const basicPrice = formatCurrency(49_000, "TZS");
  const proPrice = formatCurrency(79_000, "TZS");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Simple, transparent pricing for schools of all sizes
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-zinc-400">
            Start free, upgrade as you grow. No hidden fees.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {/* Free */}
          <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Free
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Up to 50 students
            </p>
            <p className="mt-4">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {freePrice}
              </span>
              <span className="text-sm text-slate-500 dark:text-zinc-400">
                {" "}
                / month
              </span>
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3">
              <FeatureLine>ClickPesa payments</FeatureLine>
              <FeatureLine>Basic dashboard &amp; fee tracking</FeatureLine>
              <FeatureLine>Classes, students, fee types &amp; structures</FeatureLine>
              <FeatureLine>Parent linking &amp; approval workflow</FeatureLine>
              <FeatureLine>1 admin account</FeatureLine>
            </ul>
            <Link
              href="/signup?role=admin"
              className="mt-8 block w-full rounded-lg border-2 border-slate-200 bg-white py-3 text-center text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:border-indigo-500/50"
            >
              Get started
            </Link>
          </section>

          {/* Basic — popular */}
          <section className="relative flex flex-col rounded-2xl border-2 border-indigo-600 bg-white p-6 shadow-lg shadow-indigo-900/10 dark:border-indigo-500 dark:bg-zinc-900">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
              Popular
            </span>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Basic
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              51–200 students
            </p>
            <p className="mt-4">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {basicPrice}
              </span>
              <span className="text-sm text-slate-500 dark:text-zinc-400">
                {" "}
                / month
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
              ≈ {usdApprox(49_000)} USD / mo, approximate
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3">
              <FeatureLine>Everything in Free</FeatureLine>
              <FeatureLine>
                Advanced reports (CSV export, class summaries)
              </FeatureLine>
              <FeatureLine>Up to 2 admin accounts</FeatureLine>
            </ul>
            <Link
              href="/signup?role=admin"
              className="mt-8 block w-full rounded-lg bg-indigo-600 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Choose plan
            </Link>
          </section>

          {/* Pro */}
          <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Pro
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              201–500 students
            </p>
            <p className="mt-4">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {proPrice}
              </span>
              <span className="text-sm text-slate-500 dark:text-zinc-400">
                {" "}
                / month
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
              ≈ {usdApprox(79_000)} USD / mo, approximate
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3">
              <FeatureLine>Everything in Basic</FeatureLine>
              <FeatureLine>Up to 5 admin accounts</FeatureLine>
              <FeatureLine>Bulk student import</FeatureLine>
              <FeatureLine>Priority support</FeatureLine>
            </ul>
            <Link
              href="/signup?role=admin"
              className="mt-8 block w-full rounded-lg bg-indigo-600 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Choose plan
            </Link>
          </section>

          {/* Enterprise */}
          <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Enterprise
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              500+ students
            </p>
            <p className="mt-4">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                Custom
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Tailored to your institution
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3">
              <FeatureLine>Everything in Pro</FeatureLine>
              <FeatureLine>Dedicated account support</FeatureLine>
              <FeatureLine>Custom features &amp; integrations</FeatureLine>
              <FeatureLine>Priority support</FeatureLine>
            </ul>
            <Link
              href="/contact"
              className="mt-8 block w-full rounded-lg border-2 border-slate-200 bg-white py-3 text-center text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:border-indigo-500/50"
            >
              Contact us
            </Link>
          </section>
        </div>

        <p className="mx-auto mt-12 max-w-3xl rounded-xl border border-slate-200 bg-white px-4 py-4 text-center text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 sm:px-6">
          <strong className="text-slate-800 dark:text-zinc-200">Note:</strong>{" "}
          All plans include ClickPesa for fee payments. Transaction fees from
          mobile networks and ClickPesa apply separately according to their
          pricing — not included in the subscription prices above.
        </p>

        <p className="mt-8 text-center text-sm text-slate-500 dark:text-zinc-500">
          <Link
            href="/"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            ← Back to home
          </Link>
          {" · "}
          <Link
            href="/contact"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Contact
          </Link>
          {" · "}
          <Link
            href="/faq"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            FAQ
          </Link>
        </p>
      </main>
    </div>
  );
}
