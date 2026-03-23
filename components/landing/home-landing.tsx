import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Coins,
  LayoutDashboard,
  Lock,
  Shield,
  Smartphone,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";

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
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Collected", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
            { label: "Pending", tone: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
            { label: "Students", tone: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300" },
          ].map((c) => (
            <div
              key={c.label}
              className={`rounded-lg px-2 py-3 text-center text-[10px] font-semibold sm:text-xs ${c.tone}`}
            >
              {c.label}
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-2 rounded bg-slate-100 dark:bg-zinc-800" />
          <div className="h-2 w-[80%] rounded bg-slate-100 dark:bg-zinc-800" />
          <div className="h-2 w-[60%] rounded bg-slate-100 dark:bg-zinc-800" />
        </div>
        <p className="mt-3 text-center text-[10px] text-slate-400 dark:text-zinc-500 sm:text-xs">
          Fee overview · payments · reports
        </p>
      </div>
    </div>
  );
}

const featureCards = [
  {
    icon: Coins,
    title: "Multi-currency support",
    description:
      "KES, TZS, UGX, USD — set the currency that matches your school. Statements and balances display clearly for every family.",
  },
  {
    icon: Smartphone,
    title: "ClickPesa payments",
    description:
      "Parents pay with M-Pesa, Tigo Pesa, Airtel Money, and more. Control numbers and checkout links meet families where they already pay.",
  },
  {
    icon: Activity,
    title: "Real-time fee tracking",
    description:
      "See who has paid, who still owes, and class-level balances at a glance — without digging through spreadsheets.",
  },
  {
    icon: UserPlus,
    title: "Parent–student linking",
    description:
      "Parents request access with an admission number; your team approves in one place. No more guesswork or duplicate accounts.",
  },
  {
    icon: BarChart3,
    title: "Detailed reports",
    description:
      "Payment history, collection rates, and monthly income trends help you plan budgets and talk confidently with your board.",
  },
  {
    icon: LayoutDashboard,
    title: "Full admin dashboard",
    description:
      "Classes, students, fee types, and fee structures — everything you need to run fees lives in a single, simple workspace.",
  },
] as const;

const steps = [
  {
    n: "1",
    title: "School sets up",
    body: "Create your school, add classes, and define fee types and structures in minutes.",
  },
  {
    n: "2",
    title: "Parents link",
    body: "Parents submit a link request with their child’s admission number; admins review and approve.",
  },
  {
    n: "3",
    title: "Fees get paid",
    body: "Parents pay online via ClickPesa; your dashboard updates in real time so you always know the picture.",
  },
] as const;

export function HomeLanding() {
  const sampleTzs = formatCurrency(850_000, "TZS");
  const sampleKes = formatCurrency(45_000, "KES");

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-indigo-50/80 via-white to-white dark:border-zinc-800 dark:from-indigo-950/40 dark:via-zinc-950 dark:to-zinc-950">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.12),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:flex lg:items-center lg:gap-12 lg:px-8 lg:py-24">
            <div className="flex-1 text-center lg:text-left">
              <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-950/50 dark:text-indigo-200">
                Built for East Africa
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-white">
                Smart school fee management for East African schools
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 lg:mx-0 dark:text-zinc-400">
                Simplify payments, track collections, and keep parents happy. One
                platform for schools, parents, and administrators.
              </p>
              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/signup?role=parent"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  For parents
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/signup?role=admin"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 transition hover:border-indigo-300 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:border-indigo-500/50 dark:hover:bg-zinc-800"
                >
                  For schools
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              <p className="mt-4 text-sm text-slate-500 dark:text-zinc-500">
                Already registered?{" "}
                <Link
                  href="/login"
                  className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  Sign in to your account
                </Link>
              </p>
              <p className="mt-6 text-xs text-slate-400 dark:text-zinc-600">
                Example balances:{" "}
                <span className="font-medium text-slate-600 dark:text-zinc-400">
                  {sampleTzs}
                </span>
                {" · "}
                <span className="font-medium text-slate-600 dark:text-zinc-400">
                  {sampleKes}
                </span>
              </p>
            </div>
            <div className="mt-12 flex-1 lg:mt-0">
              <HeroMockup />
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          className="border-b border-slate-100 py-16 dark:border-zinc-800 sm:py-20"
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
                From the first invoice to the last receipt, Adakaro keeps your
                school and your families aligned.
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
          className="border-b border-slate-100 bg-slate-50/80 py-16 dark:border-zinc-800 dark:bg-zinc-900/30 sm:py-20"
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
              Three straightforward steps from signup to paid fees.
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
          className="border-b border-slate-100 py-16 dark:border-zinc-800 sm:py-20"
          aria-labelledby="stories-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2
              id="stories-heading"
              className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white"
            >
              Trusted by schools that put families first
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
          className="border-b border-slate-100 py-14 dark:border-zinc-800 sm:py-16"
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
                    Secure payments via ClickPesa
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                    Industry-grade payment rails trusted across the region.
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
                    Data protected
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                    Encrypted connections (HTTPS) and careful access controls for
                    your school data.
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
                    Free setup, no hidden fees
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                    Get started without a credit card. Transparent pricing as
                    you grow.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 py-16 text-white sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Ready to simplify school fee management?
            </h2>
            <p className="mt-3 text-indigo-100">
              Join schools and parents who are already saving time every term.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup?role=admin"
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-indigo-700 shadow-lg transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Sign up your school
              </Link>
              <Link
                href="/signup?role=parent"
                className="inline-flex items-center justify-center rounded-xl border-2 border-white/40 bg-transparent px-6 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Join as a parent
              </Link>
            </div>
            <p className="mt-6 text-sm text-indigo-200">
              No credit card required to start.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
