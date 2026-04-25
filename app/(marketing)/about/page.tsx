"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LandingScrollBehavior,
  SmartFloatingScrollButton,
} from "@/components/landing/landing-scroll";

/** Document order for smart scroll (matches RevealSection `id`s). */
const ABOUT_SECTION_IDS = [
  "about-hero",
  "about-why",
  "about-mission",
  "about-helps",
  "about-believe",
  "about-teams",
  "about-region",
  "about-cta",
] as const;

const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:w-auto";

const secondaryBtn =
  "inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-base font-semibold text-gray-900 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out hover:shadow-md hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 sm:w-auto";

const bodyText =
  "text-base leading-relaxed text-gray-600 dark:text-zinc-400" as const;

/** Shared marketing cards: equal-height rows, subtle hover. */
const cardClass =
  "flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-1 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900";

/** Role tiles: same shell as cards; single-line content stays vertically centered. */
const roleCardClass =
  "flex h-full flex-col justify-center rounded-xl border border-gray-200 bg-white p-6 text-center text-sm font-medium text-gray-900 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-1 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:text-white md:text-base";

function RevealSection({
  id,
  children,
  className,
  "aria-labelledby": ariaLabelledBy,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  "aria-labelledby"?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
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
    <div
      id={id}
      ref={ref}
      role={ariaLabelledBy ? "region" : undefined}
      aria-labelledby={ariaLabelledBy}
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
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      <LandingScrollBehavior />
      <RevealSection
        id="about-hero"
        className="bg-gray-50 py-16 dark:bg-zinc-900/30 md:py-20"
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Built to make school management simpler for real schools
          </h1>
          <p className={cn("mt-4 text-lg", bodyText)}>
            Adakaro helps schools manage fees, students, reports, and parent updates
            in one clear system — without paperwork, confusion, or complicated
            tools.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/signup?role=admin" className={primaryBtn}>
              Start Free
            </Link>
            <Link href="/contact" className={secondaryBtn}>
              Contact us
            </Link>
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-zinc-500">
            No setup fees. Cancel anytime.
          </p>
        </div>
      </RevealSection>

      <main>
        <RevealSection
          id="about-why"
          className="border-b border-gray-100 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-950 md:py-20"
          aria-labelledby="why-built-heading"
        >
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2
              id="why-built-heading"
              className="text-2xl font-semibold text-gray-900 dark:text-white"
            >
              Why we built Adakaro
            </h2>
            <div className="mx-auto mt-6 max-w-3xl">
              <div className="space-y-4">
                <p className={bodyText}>
                  Many schools still depend on notebooks, spreadsheets, WhatsApp
                  messages, and manual follow-ups. That creates confusion for bursars,
                  delays for school leaders, and unnecessary pressure on parents.
                </p>
                <p className={bodyText}>
                  Adakaro was created to bring fees, students, reports, and parent
                  updates into one simple place — so everyone works from the same
                  clear picture.
                </p>
              </div>
              <ul className="mt-6 space-y-2 border-t border-gray-100 pt-6 text-sm text-gray-600 dark:border-zinc-800 dark:text-zinc-400">
                <li className="flex gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      Manual fee tracking
                    </span>{" "}
                    — easy to lose track of who paid and what is still owed.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      Confusing parent communication
                    </span>{" "}
                    — messages scattered across channels and hard to follow up.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      Time wasted on reports
                    </span>{" "}
                    — copying grades and comments instead of focusing on teaching.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </RevealSection>

        <RevealSection
          id="about-mission"
          className="border-b border-gray-100 bg-gray-50 py-12 dark:border-zinc-800 dark:bg-zinc-900/30 md:py-16"
          aria-labelledby="mission-heading"
        >
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2
              id="mission-heading"
              className="text-2xl font-semibold text-gray-900 dark:text-white"
            >
              Our mission
            </h2>
            <div className="mx-auto mt-6 max-w-3xl">
              <p className={bodyText}>
                To help schools save time, reduce manual work, and manage important
                school information with clarity.
              </p>
            </div>
          </div>
        </RevealSection>

        <RevealSection
          id="about-helps"
          className="border-b border-gray-100 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-950 md:py-20"
          aria-labelledby="helps-heading"
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2
              id="helps-heading"
              className="text-2xl font-semibold text-gray-900 dark:text-white"
            >
              What Adakaro helps you do
            </h2>
            <div className="mt-6 grid auto-rows-fr gap-6 md:grid-cols-3">
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Track payments clearly
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                  See who paid, who hasn&apos;t, and avoid confusion.
                </p>
              </div>
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Manage students easily
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                  Keep records, reports, and updates in one place.
                </p>
              </div>
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Stay organized as a school
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                  No more WhatsApp chaos or scattered spreadsheets.
                </p>
              </div>
            </div>
          </div>
        </RevealSection>

        <RevealSection
          id="about-believe"
          className="border-b border-gray-100 bg-gray-50 py-16 dark:border-zinc-800 dark:bg-zinc-900/30 md:py-20"
          aria-labelledby="believe-heading"
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2
              id="believe-heading"
              className="text-2xl font-semibold text-gray-900 dark:text-white"
            >
              What we believe
            </h2>
            <div className="mt-6 grid auto-rows-fr gap-6 md:grid-cols-3">
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Simple
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                  Easy for any staff member to understand and use.
                </p>
              </div>
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Affordable
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                  Built for growing schools without expensive setup.
                </p>
              </div>
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Practical
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                  Designed for real daily school operations.
                </p>
              </div>
            </div>
          </div>
        </RevealSection>

        <RevealSection
          id="about-teams"
          className="border-b border-gray-100 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-950 md:py-20"
          aria-labelledby="teams-heading"
        >
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2
              id="teams-heading"
              className="text-2xl font-semibold text-gray-900 dark:text-white"
            >
              Built for real school teams
            </h2>
            <div className="mx-auto mt-8 grid max-w-xl auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2">
              <div className={roleCardClass}>School owners / Administrators</div>
              <div className={roleCardClass}>Bursars / Finance staff</div>
              <div className={roleCardClass}>Teachers</div>
              <div className={roleCardClass}>Parents</div>
            </div>
            <p className={cn("mx-auto mt-4 max-w-xl text-sm sm:text-base", bodyText)}>
              Every role sees only what they need — simple, secure, and clear.
            </p>
          </div>
        </RevealSection>

        <RevealSection
          id="about-region"
          className="border-b border-gray-100 bg-gray-50 py-16 dark:border-zinc-800 dark:bg-zinc-900/30 md:py-20"
          aria-labelledby="region-heading"
        >
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <h2
                id="region-heading"
                className="text-2xl font-semibold text-gray-900 dark:text-white"
              >
                Built for Tanzania and growing schools
              </h2>
              <p className={cn("mt-4", bodyText)}>
                Adakaro is designed for schools that want better systems without
                needing complicated technology or expensive tools.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-gray-600 dark:text-zinc-400">
                <li className="flex gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                    aria-hidden
                  />
                  <span>
                    Works for schools using mobile money and bank payments
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                    aria-hidden
                  />
                  <span>Simple enough for non-technical staff</span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                    aria-hidden
                  />
                  <span>
                    Built for small schools today and growing schools tomorrow
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </RevealSection>

        <RevealSection
          id="about-cta"
          className="border-t border-gray-100 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-950 md:py-20"
        >
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Start managing your school the simple way
            </h2>
            <div className="mx-auto mt-4 max-w-xl text-center">
              <p className="text-base leading-relaxed text-gray-600 dark:text-zinc-400">
                Set up your school in minutes and see everything working before you pay
                anything.
              </p>
            </div>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/signup?role=admin" className={primaryBtn}>
                Start Free
              </Link>
              <Link href="/contact" className={secondaryBtn}>
                Contact us
              </Link>
            </div>
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
      <SmartFloatingScrollButton sectionIds={ABOUT_SECTION_IDS} />
    </div>
  );
}
