import type { Metadata } from "next";
import Link from "next/link";
import { BackToTopButton } from "@/components/ui/BackToTopButton";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact — Adakaro",
  description: "Get in touch with the Adakaro team.",
};

export default function ContactPage() {
  return (
    <>
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-zinc-950 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 text-center sm:mb-12 sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Get in touch
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400 sm:text-base">
            Have questions about Adakaro? We&apos;re here to help — whether
            you&apos;re a school exploring the platform or a parent who needs
            support.
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-5 lg:gap-12">
          <div className="lg:col-span-3">
            <ContactForm />
          </div>

          <aside className="lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Contact directly
              </h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="font-medium text-slate-900 dark:text-white">
                    Email
                  </dt>
                  <dd className="mt-1">
                    <a
                      href="mailto:info@adakaro.com"
                      className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      info@adakaro.com
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-900 dark:text-white">
                    Phone
                  </dt>
                  <dd className="mt-1 text-slate-600 dark:text-zinc-400">
                    <span className="text-slate-400 dark:text-zinc-500">
                      Coming soon
                    </span>
                    <span className="sr-only">
                      Phone support placeholder — use email for now
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="mt-6 text-xs leading-relaxed text-slate-500 dark:text-zinc-500">
                We aim to respond within one to two business days. For urgent
                payment issues, include your school name and student admission
                number where relevant.
              </p>
            </div>
          </aside>
        </div>

        <p className="mt-12 border-t border-slate-200 pt-8 text-center dark:border-zinc-800 sm:text-left">
          <Link
            href="/"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            ← Back to home
          </Link>
          {" · "}
          <Link
            href="/about"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            About
          </Link>
          {" · "}
          <Link
            href="/faq"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            FAQ
          </Link>
        </p>
      </div>
    </div>
    <BackToTopButton />
    </>
  );
}
