import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/layout/MarketingFooter";
import { MarketingHeader } from "@/components/layout/MarketingHeader";
import { AIChatWidget } from "@/components/ai/AIChatWidget";

export const metadata: Metadata = {
  title: "Adakaro AI — Ask About School Management",
  description:
    "Chat with Adakaro AI for instant answers about features, pricing, report cards, attendance, finance, and onboarding.",
};

export default function AIPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1 bg-gray-50 px-4 py-10 dark:bg-zinc-950 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Adakaro AI
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Your intelligent guide to Adakaro
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-slate-600 dark:text-zinc-400">
            Ask about features, pricing, report cards, attendance, finance, and
            how to get started — with a conversational experience built for
            schools.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link
              href="/contact"
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Request a demo
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              href="/pricing"
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              View pricing
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-3xl">
          <AIChatWidget product="public" mode="page" />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
