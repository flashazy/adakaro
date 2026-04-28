"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
  Check,
  CreditCard,
  FileText,
  Quote,
  UserPlus,
  UsersRound,
} from "lucide-react";
import {
  HeroScrollDown,
  LandingScrollBehavior,
  SmartFloatingScrollButton,
} from "./landing-scroll";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

const problemItems = [
  {
    title: "Payments tracked in notebooks",
    description:
      "Manual records make it harder to know who has paid and who still owes.",
    icon: CreditCard,
  },
  {
    title: "Student records scattered everywhere",
    description:
      "Important information lives in different places, slowing daily school operations.",
    icon: UsersRound,
  },
  {
    title: "Report cards take too much time",
    description:
      "Manual report preparation creates delays and extra workload each term.",
    icon: FileText,
  },
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
  "Generate report cards faster",
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
    <div className="relative mx-auto w-full max-w-2xl" aria-hidden>
      <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-200/45 via-violet-200/20 to-transparent blur-2xl dark:from-indigo-500/20 dark:via-violet-500/10" />

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 md:-rotate-[1deg] md:translate-y-1",
          "motion-reduce:opacity-100 motion-reduce:translate-y-0",
          entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
          "motion-safe:transition-[opacity,transform] motion-safe:duration-[650ms] motion-safe:ease-out",
        )}
      >
        <Image
          src="/screenshots/dashboard-2.png"
          alt=""
          width={1400}
          height={900}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 92vw, 720px"
          className="h-auto w-full object-contain"
          quality={100}
          priority
        />
      </div>

      <div className="pointer-events-none absolute -left-6 top-8 hidden rounded-xl border border-indigo-100 bg-white/95 px-3 py-2 shadow-lg backdrop-blur md:block dark:border-indigo-900/60 dark:bg-zinc-900/95">
        <p className="text-[11px] text-gray-500 dark:text-zinc-400">Fees collected</p>
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          TSh 206.9M
        </p>
      </div>
      <div className="pointer-events-none absolute -right-6 top-16 hidden rounded-xl border border-indigo-100 bg-white/95 px-3 py-2 shadow-lg backdrop-blur md:block dark:border-indigo-900/60 dark:bg-zinc-900/95">
        <p className="text-[11px] text-gray-500 dark:text-zinc-400">Active students</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">262</p>
      </div>
      <div className="pointer-events-none absolute -bottom-5 right-8 hidden rounded-xl border border-indigo-100 bg-white/95 px-3 py-2 shadow-lg backdrop-blur md:block dark:border-indigo-900/60 dark:bg-zinc-900/95">
        <p className="text-[11px] text-gray-500 dark:text-zinc-400">Reports ready</p>
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          Up to date
        </p>
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
          className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-white via-indigo-50/30 to-white py-16 dark:border-zinc-800 dark:from-zinc-950 dark:via-indigo-950/25 dark:to-zinc-950 sm:py-20"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_15%_-10%,rgba(99,102,241,0.14),transparent),radial-gradient(ellipse_60%_45%_at_90%_20%,rgba(139,92,246,0.08),transparent)] dark:bg-[radial-gradient(ellipse_70%_50%_at_15%_-10%,rgba(99,102,241,0.22),transparent),radial-gradient(ellipse_60%_45%_at_90%_20%,rgba(139,92,246,0.16),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="text-center lg:text-left">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
                  One system to run your entire school — from fees to report
                  cards.
                </h1>
                <p className="mt-4 text-lg text-gray-600 dark:text-zinc-400">
                  Track payments, manage students, communicate with parents, and
                  generate reports without paperwork or confusion.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
                  <Link
                    href="/signup?role=admin"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-indigo-600/20 motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-600/30 active:translate-y-0 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Get Started Free
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <button
                    type="button"
                    onClick={() => scrollToId("how-it-works")}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-base font-semibold text-gray-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                  >
                    See How It Works
                  </button>
                </div>
                <p className="mt-6 text-sm text-gray-600 dark:text-zinc-400">
                  No credit card required • Setup in minutes
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
            <div className="mx-auto max-w-2xl text-center">
              <h2
                id="pain-heading"
                className="text-3xl font-semibold text-gray-900 dark:text-white"
              >
                Running a school shouldn’t feel this hard
              </h2>
              <p className="mt-3 text-gray-600 dark:text-zinc-400">
                Adakaro replaces scattered tools, manual records, and repeated
                follow-ups with one simple system.
              </p>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {problemItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="mx-auto mt-10 max-w-2xl text-center text-lg font-medium text-gray-600 dark:text-zinc-400">
              Adakaro brings fees, students, parents, and reports into one
              simple system.
            </p>
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
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featureGroups.map((group, idx) => {
                  const iconByTitle: Record<string, typeof CreditCard> = {
                    "Fees & Payments": CreditCard,
                    "Student Management": UsersRound,
                    "Reports & Insights": FileText,
                    "Teachers & Academics": BookOpenText,
                    "Report Cards": FileText,
                    "Parent Experience": UsersRound,
                  };
                  const Icon = iconByTitle[group.title] ?? Check;
                  const isPrimary = idx === 0;
                  return (
                    <li
                      key={group.title}
                      className={cn(
                        "h-full rounded-2xl border p-6 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-1 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/30",
                        isPrimary
                          ? "border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-md dark:border-purple-800/60 dark:from-purple-950/30 dark:to-zinc-900"
                          : "border-gray-200 bg-white"
                      )}
                    >
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                        {group.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-zinc-400">
                        {group.lead}
                      </p>
                      <ul className="mt-5 space-y-2.5 text-sm text-gray-600 dark:text-zinc-400">
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
                  );
                })}
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
            <ol className="relative mt-8 grid gap-6 md:grid-cols-3">
              <div
                className="absolute left-[16%] right-[16%] top-[34px] hidden h-0.5 bg-gray-200 md:block dark:bg-zinc-700"
                aria-hidden
              />
              {howItWorksSteps.map((step, i) => (
                <li
                  key={step.n}
                  className="relative rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-1 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/30"
                >
                  <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 dark:shadow-indigo-900/40">
                    {i === 0 ? (
                      <UserPlus className="h-6 w-6" aria-hidden />
                    ) : i === 1 ? (
                      <CreditCard className="h-6 w-6" aria-hidden />
                    ) : (
                      <FileText className="h-6 w-6" aria-hidden />
                    )}
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
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                Trusted by schools across Tanzania
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300">
                  500+ students managed
                </span>
                <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300">
                  10+ schools onboarded
                </span>
              </div>
            </div>
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
                  className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                      {t.attribution
                        .split("—")[0]
                        .trim()
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                    <Quote
                      className="h-5 w-5 text-indigo-500 dark:text-indigo-400"
                      aria-hidden
                    />
                  </div>
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
          className="scroll-mt-20 bg-white py-16 dark:bg-zinc-950 md:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-16 text-center text-white shadow-2xl md:px-10 md:py-20">
              <h2 className="text-3xl font-semibold">
                Ready to run your school the smart way?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-purple-100">
                Join schools already simplifying fees, students, and reports with
                Adakaro.
              </p>
              <div className="mt-8">
                <Link
                  href="/signup?role=admin"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-8 py-3.5 text-base font-semibold text-purple-700 shadow-lg transition-all duration-200 ease-out hover:scale-105 hover:bg-gray-100 hover:shadow-xl sm:px-10 sm:py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              <p className="mt-4 text-sm text-purple-100">No credit card required</p>
            </div>
          </div>
        </section>
      </main>
      <SmartFloatingScrollButton />
    </div>
  );
}
