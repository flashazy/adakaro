"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LandingScrollBehavior,
  SmartFloatingScrollButton,
} from "@/components/landing/landing-scroll";

/** Document order for smart scroll (matches section `id`s). */
const PRICING_SECTION_IDS = [
  "pricing-hero",
  "pricing-rates",
  "pricing-free",
  "pricing-examples",
  "pricing-included",
  "pricing-faq",
] as const;

const PAGE_WRAP =
  "mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8" as const;

function RevealSection({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -12px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      id={id}
      ref={ref}
      className={cn(
        className,
        "motion-reduce:translate-y-0 motion-reduce:opacity-100",
        visible
          ? "translate-y-0 opacity-100"
          : "opacity-0 motion-safe:translate-y-2.5",
        "motion-safe:transition-[opacity,transform] motion-safe:duration-[450ms] motion-safe:ease-out",
      )}
    >
      {children}
    </section>
  );
}

function FeatureLine({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-zinc-400">
      <Check
        className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400"
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}

function ExampleRow({
  label,
  monthlyTotal,
  yearlyTotal,
}: {
  label: string;
  monthlyTotal: string;
  yearlyTotal: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 py-4 last:border-b-0 dark:border-zinc-800">
      <span className="min-w-0 shrink font-semibold text-gray-900 dark:text-white">
        {label}
      </span>
      <span className="shrink-0 text-right text-sm tabular-nums text-gray-600 dark:text-zinc-400">
        {monthlyTotal}
        <span className="mx-2 text-gray-400 dark:text-zinc-500">•</span>
        {yearlyTotal}
      </span>
    </div>
  );
}

export default function PricingPage() {
  const [yearlyAccent, setYearlyAccent] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    setYearlyAccent(true);
    const id = window.setTimeout(() => setYearlyAccent(false), 300);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      <LandingScrollBehavior />
      <RevealSection
        id="pricing-hero"
        className="border-b border-gray-100 bg-gray-50 pt-14 pb-10 dark:border-zinc-800 dark:bg-zinc-900/30 md:pt-20 md:pb-12"
      >
        <div className={`${PAGE_WRAP} text-center`}>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Simple pricing that grows with your school
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-zinc-400">
            Start free with up to 20 students. Then pay only for the students you
            manage — no tiers, no hidden fees.
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/signup?role=admin"
              className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 active:translate-y-0 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:w-auto"
            >
              Start Free
            </Link>
            <Link
              href="/contact"
              className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-base font-semibold text-gray-900 transition hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 sm:w-auto"
            >
              Contact us
            </Link>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-zinc-500">
            No contracts. No setup fees. Cancel anytime.
          </p>
        </div>
      </RevealSection>

      <main className={PAGE_WRAP}>
        <RevealSection
          id="pricing-rates"
          aria-labelledby="rates-heading"
          className="scroll-mt-20 pt-6 pb-14 md:pt-8 md:pb-20"
        >
          <h2
            id="rates-heading"
            className="text-center text-xl font-semibold text-gray-900 dark:text-white"
          >
            Pay per student
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-gray-600 dark:text-zinc-400">
            Same full product on monthly or yearly billing — you choose how you
            pay.
          </p>
          <div className="mt-8 grid items-stretch gap-6 sm:grid-cols-2">
            <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-8 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div
                className="mb-2 flex h-10 shrink-0 items-center pt-1"
                aria-hidden
              />
              <p className="text-sm text-gray-500 dark:text-zinc-500">Monthly</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                TSh 500
                <span className="text-lg font-normal text-gray-500 dark:text-zinc-500">
                  {" "}
                  / student / month
                </span>
              </p>
              <div className="grow" aria-hidden />
            </div>
            <div
              className={cn(
                "flex h-full flex-col rounded-xl border-2 border-indigo-500 bg-white p-8 shadow-md motion-safe:origin-top motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md dark:border-indigo-500 dark:bg-zinc-900",
                yearlyAccent && "motion-safe:scale-[1.02]",
              )}
            >
              <div className="mb-2 flex h-10 shrink-0 items-center pt-1">
                <span className="mt-1 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                  Save TSh 1,000 per student
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-500">
                Yearly
                <span className="ml-2 font-medium text-indigo-600 dark:text-indigo-400">
                  — best value
                </span>
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                TSh 5,000
                <span className="text-lg font-normal text-gray-500 dark:text-zinc-500">
                  {" "}
                  / student / year
                </span>
              </p>
              <p className="mt-3 text-sm text-gray-500 dark:text-zinc-500">
                Compared to monthly, yearly saves TSh 1,000 per student per year.
              </p>
              <div className="grow" aria-hidden />
            </div>
          </div>
          <p className="mx-auto mt-6 max-w-xl text-center text-sm text-gray-500 dark:text-zinc-500">
            Your cost grows only with your number of students.
          </p>
        </RevealSection>

        <RevealSection
          id="pricing-free"
          aria-labelledby="free-heading"
          className="scroll-mt-20 border-t border-gray-100 py-12 dark:border-zinc-800 md:py-16"
        >
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 shadow-md ring-1 ring-gray-200/60 motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/40 dark:ring-zinc-700/50">
            <p className="text-xs text-gray-500 dark:text-zinc-500">
              Free to start
            </p>
            <h2
              id="free-heading"
              className="mt-2 text-xl font-semibold text-gray-900 dark:text-white"
            >
              Start free with up to 20 students
            </h2>
            <p className="mt-3 text-sm text-gray-600 dark:text-zinc-400">
              Set up your school, add students, and see everything working — before
              you pay anything.
            </p>
            <p className="mt-3 text-sm font-medium text-gray-900 dark:text-zinc-200">
              No payment required to start.
            </p>
            <Link
              href="/signup?role=admin"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 active:translate-y-0 hover:bg-indigo-600/90"
            >
              Start Free
            </Link>
          </div>
        </RevealSection>

        <RevealSection
          id="pricing-examples"
          aria-labelledby="examples-heading"
          className="scroll-mt-20 border-t border-gray-100 py-14 dark:border-zinc-800 md:py-20"
        >
          <h2
            id="examples-heading"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            Example costs
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
            Totals are before any separate payment-provider fees.
          </p>
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
            <ExampleRow
              label="Small school (100 students)"
              monthlyTotal="TSh 50,000 / month"
              yearlyTotal="TSh 500,000 / year"
            />
            <ExampleRow
              label="Growing school (200 students)"
              monthlyTotal="TSh 100,000 / month"
              yearlyTotal="TSh 1,000,000 / year"
            />
            <ExampleRow
              label="Large school (500 students)"
              monthlyTotal="TSh 250,000 / month"
              yearlyTotal="TSh 2,500,000 / year"
            />
          </div>
        </RevealSection>

        <RevealSection
          id="pricing-included"
          aria-labelledby="included-heading"
          className="scroll-mt-20 border-t border-gray-100 py-14 dark:border-zinc-800 md:py-20"
        >
          <h2
            id="included-heading"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            Everything included
          </h2>
          <p className="mt-3 text-sm font-medium text-gray-800 dark:text-zinc-200">
            No locked features. Every school gets the full system.
          </p>
          <ul className="mt-6 grid items-start gap-3 sm:grid-cols-2 sm:gap-x-14 sm:gap-y-3">
            <FeatureLine>Fees &amp; payment tracking</FeatureLine>
            <FeatureLine>Report cards</FeatureLine>
            <FeatureLine>Reports &amp; insights</FeatureLine>
            <FeatureLine>Admin dashboard</FeatureLine>
            <FeatureLine>Student management</FeatureLine>
            <FeatureLine>Parent access</FeatureLine>
            <FeatureLine>Bulk student import</FeatureLine>
            <FeatureLine>Support for school teams</FeatureLine>
          </ul>
        </RevealSection>

        <RevealSection
          id="pricing-faq"
          aria-labelledby="faq-heading"
          className="scroll-mt-20 space-y-6 border-t border-gray-100 py-14 dark:border-zinc-800 md:py-20"
        >
          <h2
            id="faq-heading"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            Common questions
          </h2>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm transition-shadow duration-200 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              When do I start paying?
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
              You only start paying when your school grows beyond 20 students.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm transition-shadow duration-200 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Do I lose features on monthly billing?
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
              No. Monthly and yearly schools get the same full features.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm transition-shadow duration-200 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Can I switch between monthly and yearly?
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
              Yes. You can switch your billing option anytime.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm transition-shadow duration-200 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              What happens when my school grows?
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
              Your price increases only with the number of students you manage.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm transition-shadow duration-200 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Are payment transaction fees included?
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
              Mobile money, bank, or provider transaction fees may apply
              separately.
            </p>
          </div>
        </RevealSection>

        <p className="border-t border-gray-100 py-8 text-center text-sm text-gray-500 dark:border-zinc-800 dark:text-zinc-500">
          <Link
            href="/"
            className="font-medium text-gray-500 underline-offset-4 hover:text-indigo-600 hover:underline dark:text-zinc-500 dark:hover:text-indigo-400"
          >
            ← Back to home
          </Link>
          <span className="text-gray-400 dark:text-zinc-600"> · </span>
          <Link
            href="/contact"
            className="font-medium text-gray-500 underline-offset-4 hover:text-indigo-600 hover:underline dark:text-zinc-500 dark:hover:text-indigo-400"
          >
            Contact
          </Link>
          <span className="text-gray-400 dark:text-zinc-600"> · </span>
          <Link
            href="/faq"
            className="font-medium text-gray-500 underline-offset-4 hover:text-indigo-600 hover:underline dark:text-zinc-500 dark:hover:text-indigo-400"
          >
            FAQ
          </Link>
        </p>
      </main>
      <SmartFloatingScrollButton sectionIds={PRICING_SECTION_IDS} />
    </div>
  );
}
