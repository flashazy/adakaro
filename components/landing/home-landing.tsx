"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Coins,
  LayoutDashboard,
  Lock,
  Shield,
  Smartphone,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import {
  HeroScrollDown,
  LandingScrollBehavior,
  SmartFloatingScrollButton,
} from "./landing-scroll";

const heroPreviewMetrics = [
  {
    title: "Total Collected (TSH)",
    value: "12.45M",
    sub: "This term",
    panel:
      "border-emerald-200/90 bg-emerald-50/90 dark:border-emerald-800/60 dark:bg-emerald-950/35",
    valueClass:
      "text-emerald-800 dark:text-emerald-200",
  },
  {
    title: "Outstanding Fees",
    value: "3.18M",
    sub: "This term",
    panel:
      "border-amber-200/90 bg-amber-50/90 dark:border-amber-800/60 dark:bg-amber-950/35",
    valueClass:
      "text-amber-900 dark:text-amber-200",
  },
  {
    title: "Paid Students",
    value: "186",
    sub: "Updated today",
    panel:
      "border-indigo-200/90 bg-indigo-50/90 dark:border-indigo-800/60 dark:bg-indigo-950/35",
    valueClass:
      "text-indigo-900 dark:text-indigo-200",
  },
] as const;

function HeroMockup() {
  return (
    <div
      className="relative mx-auto w-full max-w-lg lg:max-w-none"
      aria-hidden
    >
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xl shadow-indigo-900/5 ring-1 ring-slate-900/5 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/10">
        <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-zinc-800">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className="ml-2 text-xs font-medium text-slate-400 dark:text-zinc-500">
            Adakaro — Admin
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {heroPreviewMetrics.map((m) => (
            <div
              key={m.title}
              className={`flex min-h-0 flex-col rounded-xl border p-2.5 text-left sm:p-3 ${m.panel}`}
            >
              <p className="text-[9px] font-semibold leading-snug text-slate-700 sm:text-[10px] dark:text-zinc-300">
                {m.title}
              </p>
              <p
                className={`mt-2 text-sm font-bold tabular-nums tracking-tight sm:text-base ${m.valueClass}`}
              >
                {m.value}
              </p>
              <p className="mt-auto pt-2 text-[9px] text-slate-500 sm:text-[10px] dark:text-zinc-500">
                {m.sub}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[10px] text-slate-400 dark:text-zinc-500 sm:text-xs">
          Fees · control numbers · who paid
        </p>
      </div>
    </div>
  );
}

const featureCards = [
  {
    icon: Coins,
    title: "Generate payment numbers for easy bank and mobile payments",
    description:
      "Create control numbers families can use at the bank or on mobile money — less confusion, fewer wrong references, and easier reconciliation for your office.",
  },
  {
    icon: Smartphone,
    title: "Collect fees the way parents already pay",
    description:
      "Mobile money and familiar payment flows mean parents pay on time; your team spends less time chasing proof of payment.",
  },
  {
    icon: Activity,
    title: "Instantly see who has paid and who hasn’t",
    description:
      "One live view of balances and outstanding fees — no more guessing before assembly, audits, or board meetings.",
  },
  {
    icon: UserPlus,
    title: "Approve parent access in one place",
    description:
      "Families request access with an admission number; your office approves or declines — fewer duplicate accounts and clearer fee responsibility.",
  },
  {
    icon: BarChart3,
    title: "Understand your school income at a glance",
    description:
      "Payment history, collection rates, and trends — export-friendly reports so heads, bursars, and accountants stay aligned.",
  },
  {
    icon: LayoutDashboard,
    title: "Keep all student records organized in one place",
    description:
      "Classes, students, fee types, and fee structures in one view — so admins aren’t reconciling notebooks, spreadsheets, and WhatsApp.",
  },
] as const;

const steps = [
  {
    n: "1",
    title: "Your school sets up",
    body: "Create the school, add classes, and define fee types and structures — usually in one sitting.",
  },
  {
    n: "2",
    title: "Parents request access",
    body: "Families submit a link request with their child’s admission number; your team approves who can see what.",
  },
  {
    n: "3",
    title: "Fees flow in; you see it live",
    body: "Payments land through integrated rails; your dashboard updates so you always know who has paid.",
  },
] as const;

const painPoints = [
  "Manual records lead to costly mistakes",
  "Parents lose receipts and proof of payment",
  "It’s difficult to track who has paid",
  "No clear overview of school finances",
] as const;

const microTrust = [
  "Designed for real schools",
  "No technical skills needed",
  "Works with local payment systems",
] as const;

export function HomeLanding() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      <LandingScrollBehavior />
      <main id="main">
        {/* Hero */}
        <section
          id="hero"
          className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-indigo-50/80 via-white to-white dark:border-zinc-800 dark:from-indigo-950/40 dark:via-zinc-950 dark:to-zinc-950"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.12),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:flex lg:items-center lg:gap-12 lg:px-8 lg:py-24">
            <div className="flex-1 text-center lg:text-left">
              <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-950/50 dark:text-indigo-200">
                For school owners &amp; bursars in Tanzania &amp; East Africa
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-white">
                Track Every School Fee Payment Without Paper or Confusion
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 lg:mx-0 dark:text-zinc-400">
                Adakaro helps schools in Tanzania and East Africa collect fees,
                generate control numbers, and instantly see who has paid — all in
                one simple system.
              </p>

              <ul className="mx-auto mt-6 flex max-w-xl flex-col gap-2 text-left text-sm text-slate-600 sm:mx-0 lg:mx-0 dark:text-zinc-400">
                {microTrust.map((line) => (
                  <li key={line} className="flex items-center gap-2">
                    <CheckCircle2
                      className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/signup?role=admin"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Start Free for Your School
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 transition hover:border-indigo-300 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:border-indigo-500/50 dark:hover:bg-zinc-800"
                  onClick={() => {
                    document
                      .getElementById("features")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Features
                </button>
              </div>
              <p className="mt-5 text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-zinc-500">
                Supports mobile money • Control numbers ready • Built for East
                African schools
              </p>
              <p className="mt-4 text-sm text-slate-500 dark:text-zinc-500">
                Already registered?{" "}
                <Link
                  href="/login"
                  className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  Sign in to your account
                </Link>
              </p>
            </div>
            <div className="mt-12 flex-1 lg:mt-0">
              <HeroMockup />
            </div>
          </div>
          <HeroScrollDown targetId="pain" />
        </section>

        {/* Pain points */}
        <section
          id="pain"
          className="scroll-mt-20 border-b border-slate-100 bg-slate-50/90 py-14 dark:border-zinc-800 dark:bg-zinc-900/40 sm:py-16"
          aria-labelledby="pain-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2
              id="pain-heading"
              className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white"
            >
              Why managing school fees is still a problem
            </h2>
            <ul className="mx-auto mt-8 max-w-2xl space-y-3 text-left text-base text-slate-700 dark:text-zinc-300">
              {painPoints.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/80"
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="scroll-mt-20 border-b border-slate-100 py-16 dark:border-zinc-800 sm:py-20"
          aria-labelledby="features-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2
                id="features-heading"
                className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white"
              >
                Everything you need to run fees with confidence
              </h2>
              <p className="mt-3 text-slate-600 dark:text-zinc-400">
                Clear outcomes for heads, bursars, and accountants — not
                buzzwords.
              </p>
            </div>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featureCards.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 transition hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-indigo-500/30"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                    {description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          className="scroll-mt-20 border-b border-slate-100 bg-slate-50/80 py-16 dark:border-zinc-800 dark:bg-zinc-900/30 sm:py-20"
          aria-labelledby="how-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2
              id="how-heading"
              className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white"
            >
              How it works
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-slate-600 dark:text-zinc-400">
              Three straightforward steps from setup to clear fee visibility.
            </p>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.n} className="relative text-center">
                  {i < steps.length - 1 && (
                    <div
                      className="absolute left-[60%] top-8 hidden h-0.5 w-[80%] bg-gradient-to-r from-indigo-200 to-transparent md:block dark:from-indigo-500/30"
                      aria-hidden
                    />
                  )}
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-600/30">
                    {step.n}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Testimonials */}
        <section
          id="stories"
          className="scroll-mt-20 border-b border-slate-100 py-16 dark:border-zinc-800 sm:py-20"
          aria-labelledby="stories-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2
              id="stories-heading"
              className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white"
            >
              Schools that needed fewer fee headaches
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <figure className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <blockquote className="text-slate-700 dark:text-zinc-300">
                  <p className="text-lg font-medium leading-relaxed">
                    &ldquo;Since using Adakaro, our fee collection has improved
                    by 40%. Parents finally have a clear, simple way to pay.&rdquo;
                  </p>
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-3 text-sm text-slate-500 dark:text-zinc-500">
                  <Users className="h-8 w-8 text-indigo-500" aria-hidden />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">
                      Headteacher
                    </span>
                    , Mount Zion Primary
                  </div>
                </figcaption>
              </figure>
              <figure className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <blockquote className="text-slate-700 dark:text-zinc-300">
                  <p className="text-lg font-medium leading-relaxed">
                    &ldquo;Adakaro has made fee collection effortless. Parents
                    appreciate the transparency, and our finance team saves hours
                    every week.&rdquo;
                  </p>
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-3 text-sm text-slate-500 dark:text-zinc-500">
                  <Users className="h-8 w-8 text-indigo-500" aria-hidden />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">
                      School Bursar
                    </span>
                    , Riverside Academy
                  </div>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section
          id="trust"
          className="scroll-mt-20 border-b border-slate-100 py-14 dark:border-zinc-800 sm:py-16"
          aria-labelledby="trust-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 id="trust-heading" className="sr-only">
              Security and trust
            </h2>
            <ul className="flex flex-col items-center justify-center gap-8 sm:flex-row sm:flex-wrap sm:gap-12">
              <li className="flex max-w-xs items-start gap-3 text-center sm:text-left">
                <Shield
                  className="mx-auto h-10 w-10 shrink-0 text-indigo-600 dark:text-indigo-400 sm:mx-0"
                  aria-hidden
                />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Payments you can stand behind
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                    Integrated rails used across the region — so collections
                    match how families already move money.
                  </p>
                </div>
              </li>
              <li className="flex max-w-xs items-start gap-3 text-center sm:text-left">
                <Lock
                  className="mx-auto h-10 w-10 shrink-0 text-indigo-600 dark:text-indigo-400 sm:mx-0"
                  aria-hidden
                />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Your school data stays yours
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                    Encrypted connections (HTTPS) and access controls designed
                    for real school offices.
                  </p>
                </div>
              </li>
              <li className="flex max-w-xs items-start gap-3 text-center sm:text-left">
                <Sparkles
                  className="mx-auto h-10 w-10 shrink-0 text-indigo-600 dark:text-indigo-400 sm:mx-0"
                  aria-hidden
                />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Start without a big IT project
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                    No credit card to try the basics. Straightforward pricing as
                    you grow.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* Final CTA */}
        <section
          id="cta"
          className="scroll-mt-20 bg-gradient-to-br from-indigo-600 to-indigo-800 py-16 text-white sm:py-20"
        >
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Stop struggling with school fee tracking
            </h2>
            <p className="mt-3 text-indigo-100">
              Start using a simple system that gives you full control of your
              school finances.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
              <Link
                href="/signup?role=admin"
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-indigo-700 shadow-lg transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Create Free School Account
              </Link>
            </div>
            <p className="mt-6 text-sm text-indigo-200">
              No credit card required to start.
            </p>
          </div>
        </section>
      </main>
      <SmartFloatingScrollButton />
    </div>
  );
}
