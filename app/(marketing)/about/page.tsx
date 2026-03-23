import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Adakaro",
  description:
    "Our mission: effortless school fee management for East African schools and families.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-zinc-950 sm:py-16">
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          About Adakaro
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          School fee management built for East Africa
        </p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
          <section aria-labelledby="mission-heading">
            <h2
              id="mission-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Our mission
            </h2>
            <p className="mt-3 text-base font-medium text-indigo-900 dark:text-indigo-200">
              Making school fee management effortless for East African schools
              and families.
            </p>
          </section>

          <section aria-labelledby="what-heading">
            <h2
              id="what-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              What we do
            </h2>
            <p className="mt-3">
              Adakaro is a platform where schools can set up classes and fee
              structures, track who has paid and who still owes, and securely
              link parents to the right students. Parents get a clear view of
              balances and can pay online through{" "}
              <strong className="text-slate-800 dark:text-zinc-200">
                ClickPesa
              </strong>{" "}
              — using mobile money and other channels families already trust.
            </p>
          </section>

          <section aria-labelledby="why-heading">
            <h2
              id="why-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Why we built it
            </h2>
            <p className="mt-3">
              Schools spend countless hours chasing payments, reconciling
              spreadsheets, and answering the same questions from parents.
              Families need a simple, transparent way to see what they owe and pay
              on time. Adakaro bridges that gap — one place for administrators,
              finance teams, and parents to stay aligned.
            </p>
          </section>

          <section aria-labelledby="who-heading">
            <h2
              id="who-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Who it&apos;s for
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-slate-800 dark:text-zinc-200">
                  School administrators
                </strong>{" "}
                — enrolment, classes, and day-to-day oversight
              </li>
              <li>
                <strong className="text-slate-800 dark:text-zinc-200">
                  Finance teams and bursars
                </strong>{" "}
                — collections, reporting, and receipts
              </li>
              <li>
                <strong className="text-slate-800 dark:text-zinc-200">
                  Parents and guardians
                </strong>{" "}
                — balances, history, and online payments
              </li>
            </ul>
          </section>

          <section aria-labelledby="values-heading">
            <h2
              id="values-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Our values
            </h2>
            <ul className="mt-3 flex flex-wrap gap-3">
              {["Simplicity", "Transparency", "Reliability"].map((v) => (
                <li
                  key={v}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-950/50 dark:text-indigo-200"
                >
                  {v}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="team-heading">
            <h2
              id="team-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              The team
            </h2>
            <p className="mt-3">
              Built with care for schools across{" "}
              <strong className="text-slate-800 dark:text-zinc-200">
                Tanzania, Kenya, Uganda
              </strong>
              , and beyond.
            </p>
          </section>
        </div>

        <p className="mt-12 border-t border-slate-200 pt-8 dark:border-zinc-800">
          <Link
            href="/"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            ← Back to home
          </Link>
          {" · "}
          <Link
            href="/contact"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Contact
          </Link>
          {" · "}
          <Link
            href="/faq"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            FAQ
          </Link>
          {" · "}
          <Link
            href="/signup?role=admin"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Get started
          </Link>
        </p>
      </article>
    </div>
  );
}
