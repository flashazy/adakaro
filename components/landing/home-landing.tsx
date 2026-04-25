"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Quote } from "lucide-react";
import {
  HeroScrollDown,
  LandingScrollBehavior,
  SmartFloatingScrollButton,
} from "./landing-scroll";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

const problemItems = [
  "Payments are tracked in notebooks or scattered spreadsheets",
  "You don’t always know who has paid and who hasn’t",
  "Student records are scattered everywhere",
  "Preparing report cards takes too much time",
  "Parents keep asking for updates — and you’re stretched thin",
] as const;

const featureGroups = [
  {
    title: "Fees & Payments",
    lead: "Know where your money is — without reconciling notebooks.",
    bullets: [
      "Know instantly who has paid and who hasn’t",
      "Record payments in seconds",
      "Generate receipts automatically",
      "Track balances without spreadsheets",
    ],
  },
  {
    title: "Student Management",
    lead: "One place for every learner — from admission to the classroom.",
    bullets: [
      "Keep all student records organized in one place",
      "Add and manage students easily and quickly",
      "Import students in bulk using CSV",
      "View complete student profiles anytime",
    ],
  },
  {
    title: "Reports & Insights",
    lead: "Answer “how are we doing?” before the board meeting asks.",
    bullets: [
      "See clear financial reports instantly",
      "Track outstanding balances at a glance",
      "Export data anytime",
      "Monitor school performance",
    ],
  },
  {
    title: "Teachers & Academics",
    lead: "Give your teaching team tools they’ll actually use.",
    bullets: [
      "Record attendance quickly",
      "Enter and manage student marks",
      "Track student progress easily",
      "Support teachers with simple tools",
    ],
  },
  {
    title: "Report Cards",
    lead: "Ship report season without burning out your coordinators.",
    bullets: [
      "Generate report cards automatically",
      "Follow a clear coordinator workflow",
      "Share report cards with parents instantly",
    ],
  },
  {
    title: "Parent Experience",
    lead: "Fewer “have you paid?” messages — parents see what they need.",
    bullets: [
      "Parents can view fees and balances",
      "Access report cards anytime",
      "Stay updated without extra communication",
    ],
  },
] as const;

const howItWorksSteps = [
  {
    n: "1",
    title: "Add your students",
    body: "Enter student details or import using CSV.",
  },
  {
    n: "2",
    title: "Record payments & manage data",
    body: "Track fees, attendance, and academic records in one place.",
  },
  {
    n: "3",
    title: "Generate reports instantly",
    body: "Create report cards and financial reports in seconds.",
  },
] as const;

const whyPoints = [
  "Simple enough for anyone on your team to use",
  "No complicated setup — get going quickly",
  "Works for small schools and growing ones",
  "Built for how African schools actually operate",
] as const;

const testimonials = [
  {
    quote:
      "This system helped us stop tracking fees in notebooks. Everything is now clear.",
    attribution: "School Administrator — Dar es Salaam",
  },
  {
    quote:
      "Preparing report cards used to take days. Now it takes minutes.",
    attribution: "Teacher — Secondary School",
  },
  {
    quote:
      "Parents no longer call every day asking for updates. They can see everything.",
    attribution: "Accountant — Private Primary School",
  },
] as const;

const heroTrustStats = [
  "Save hours every week",
  "Track payments accurately",
  "Everything in one place",
] as const;

function HeroPreview() {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntered(true);
      return;
    }
    const id = window.setTimeout(() => setEntered(true), 100);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900",
        "motion-reduce:opacity-100 motion-reduce:translate-y-0",
        entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        "motion-safe:transition-[opacity,transform] motion-safe:duration-[650ms] motion-safe:ease-out",
      )}
      aria-hidden
    >
      <p className="text-xs text-gray-500 dark:text-zinc-500">Dashboard overview</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-500">Students</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">324</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-500">Classes</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">12</p>
        </div>
        <div className="col-span-2 border-t border-gray-100 pt-4 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Fees collected</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                TZS 12,400,000
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Pending</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                18 students
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-200">
          Up to date
        </span>
        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/50 dark:text-indigo-200">
          Reports ready
        </span>
      </div>
    </div>
  );
}

export function HomeLanding() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      <LandingScrollBehavior />
      <main id="main">
        {/* Hero — soft indigo wash + radial depth (original premium look) */}
        <section
          id="hero"
          className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-indigo-50/80 via-white to-white py-16 dark:border-zinc-800 dark:from-indigo-950/40 dark:via-zinc-950 dark:to-zinc-950 sm:py-20"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.12),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
                  Run your school from fees to report cards — in one simple
                  system.
                </h1>
                <p className="mt-4 text-lg text-gray-600 dark:text-zinc-400">
                  Track payments, manage students, and generate reports without
                  paperwork or confusion.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/signup?role=admin"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 active:translate-y-0 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Get Started Free
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <button
                    type="button"
                    onClick={() => scrollToId("how-it-works")}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-base font-semibold text-gray-900 transition hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                  >
                    See How It Works
                  </button>
                </div>
                <p className="mt-6 text-sm text-gray-600 dark:text-zinc-400">
                  Built for real schools — designed for simplicity and clarity.
                </p>
                <ul
                  className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-zinc-500 lg:justify-start"
                  aria-label="Trust highlights"
                >
                  {heroTrustStats.map((label) => (
                    <li key={label} className="flex items-center gap-2">
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400"
                        aria-hidden
                      />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm text-gray-500 dark:text-zinc-500">
                  Already registered?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
              <div className="flex justify-center lg:justify-end">
                <HeroPreview />
              </div>
            </div>
          </div>
          <HeroScrollDown targetId="pain" />
        </section>

        {/* Problem */}
        <section
          id="pain"
          className="scroll-mt-20 border-b border-t border-gray-100 bg-gray-50 py-14 dark:border-zinc-800 dark:bg-zinc-900/40 md:py-20"
          aria-labelledby="pain-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl">
              <h2
                id="pain-heading"
                className="text-center text-3xl font-semibold text-gray-900 dark:text-white"
              >
                Running a school shouldn’t feel this hard
              </h2>
              <ul className="mt-8 space-y-3">
                {problemItems.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 rounded-xl border border-gray-200 bg-white p-5 text-left text-gray-600 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-center text-lg font-medium text-gray-900 dark:text-white">
                Adakaro brings everything into one place.
              </p>
            </div>
          </div>
        </section>

        {/* Solution */}
        <section
          id="solution"
          className="scroll-mt-20 border-b border-t border-gray-100 bg-white py-14 dark:border-zinc-800 dark:bg-zinc-950 md:py-20"
          aria-labelledby="solution-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2
              id="solution-heading"
              className="text-3xl font-semibold text-gray-900 dark:text-white"
            >
              One system. Everything your school needs.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-gray-600 dark:text-zinc-400">
              From fees to academics, Adakaro helps you manage your school in a
              simple, organized, and stress-free way.
            </p>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="scroll-mt-20 border-b border-t border-gray-100 bg-gray-50 py-14 dark:border-zinc-800 dark:bg-zinc-900/40 md:py-20"
          aria-labelledby="features-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2
              id="features-heading"
              className="text-3xl font-semibold text-gray-900 dark:text-white"
            >
              Less admin work. More clarity.
            </h2>
            <p className="mt-3 max-w-2xl text-gray-600 dark:text-zinc-400">
              Outcomes your office feels every week — not a list of software
              features.
            </p>
            <div className="mt-8">
              <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featureGroups.map((group) => (
                  <li
                    key={group.title}
                    className="rounded-xl border border-gray-200 p-5 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/30"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {group.title}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
                      {group.lead}
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-zinc-400">
                      {group.bullets.map((b) => (
                        <li key={b} className="flex gap-2">
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400"
                            aria-hidden
                          />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/signup?role=admin"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 active:translate-y-0 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* How it works — classic horizontal steps + connector line */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-b border-t border-gray-100 bg-white py-14 dark:border-zinc-800 dark:bg-zinc-950 md:py-20"
          aria-labelledby="how-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2
              id="how-heading"
              className="text-center text-3xl font-semibold text-gray-900 dark:text-white"
            >
              How Adakaro works
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-gray-600 dark:text-zinc-400">
              Three steps from setup to reports — keep it simple.
            </p>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {howItWorksSteps.map((step, i) => (
                <li key={step.n} className="relative text-center">
                  {i < howItWorksSteps.length - 1 ? (
                    <div
                      className="absolute left-[60%] top-8 hidden h-0.5 w-[80%] bg-gradient-to-r from-indigo-200 to-transparent md:block dark:from-indigo-500/30"
                      aria-hidden
                    />
                  ) : null}
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-600/30 dark:shadow-indigo-900/40">
                    {step.n}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Why Adakaro */}
        <section
          id="why"
          className="scroll-mt-20 border-b border-t border-gray-100 bg-gray-50 py-14 dark:border-zinc-800 dark:bg-zinc-900/40 md:py-20"
          aria-labelledby="why-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2
              id="why-heading"
              className="text-3xl font-semibold text-gray-900 dark:text-white"
            >
              Built for real schools
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {whyPoints.map((point) => (
                <li
                  key={point}
                  className="rounded-xl border border-gray-200 bg-white p-5 text-gray-600 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <span className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400"
                      aria-hidden
                    />
                    <span>{point}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Testimonials */}
        <section
          id="testimonials"
          className="scroll-mt-20 border-b border-t border-gray-100 bg-white py-14 dark:border-zinc-800 dark:bg-zinc-950 md:py-20"
          aria-labelledby="testimonials-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2
              id="testimonials-heading"
              className="text-3xl font-semibold text-gray-900 dark:text-white"
            >
              Trusted by schools like yours
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">
              Simple feedback from school teams using Adakaro to reduce manual
              work.
            </p>
            <ul className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <li
                  key={t.quote}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <Quote
                    className="h-5 w-5 text-indigo-500 dark:text-indigo-400"
                    aria-hidden
                  />
                  <blockquote className="mt-3">
                    <p className="text-sm text-gray-700 dark:text-zinc-300">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <footer className="mt-4 text-xs text-gray-500 dark:text-zinc-500">
                      — {t.attribution}
                    </footer>
                  </blockquote>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <p className="mx-auto max-w-6xl px-4 text-center text-sm text-gray-500 mb-6 dark:text-zinc-400 sm:px-6 lg:px-8">
          ✨ Schools are joining Adakaro every week
        </p>

        {/* Final CTA */}
        <section
          id="cta"
          className="scroll-mt-20 bg-indigo-600 py-16 text-white dark:bg-indigo-700"
        >
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold">
              Start managing your school in minutes — no paperwork, no stress.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-indigo-100">
              Join schools already using Adakaro to save time and stay organized.
            </p>
            <div className="mt-8">
              <Link
                href="/signup?role=admin"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-indigo-700 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 active:translate-y-0 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SmartFloatingScrollButton />
    </div>
  );
}
