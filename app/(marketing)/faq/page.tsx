import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ — Adakaro",
  description:
    "Frequently asked questions about Adakaro, ClickPesa, currencies, and plans.",
};

const faqs: { q: string; a: string }[] = [
  {
    q: "How does ClickPesa payment work?",
    a: "Parents can pay school fees using the control number displayed on their dashboard. They simply open M-Pesa, TigoPesa, or Airtel Money, select “Pay Bill”, enter the control number, and confirm the amount. The school receives real-time payment confirmation.",
  },
  {
    q: "Can I change my school's currency?",
    a: "Yes. School administrators can go to School Settings and select the currency that matches their school (TZS, KES, UGX, or USD). All amounts will then display in that currency.",
  },
  {
    q: "How do parents link to students?",
    a: "Parents request access by entering their child's admission number. The school admin reviews the request and approves it. Once approved, the parent sees the student's fee balance and can make payments.",
  },
  {
    q: "What happens if I exceed my plan's student limit?",
    a: "If your school grows beyond your current plan's student limit, you'll be prompted to upgrade to the next tier. You can upgrade anytime from the Plans page or contact us for assistance.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted in transit (HTTPS) and stored securely. We use industry-standard security practices and partner with ClickPesa for payment processing, which is fully compliant.",
  },
  {
    q: "How do I get support?",
    a: "For support, visit our Contact page or email info@adakaro.com. Free plan users receive email support within 72 hours, Basic and Pro users within 24 hours, and Enterprise users have dedicated support.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. The Free plan requires no payment. You can start with up to 50 students and upgrade later as you grow.",
  },
  {
    q: "Can I import students in bulk?",
    a: "Yes, on the Pro plan you can import students via CSV upload. This feature will be available soon.",
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-zinc-950 sm:py-16">
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Frequently Asked Questions
        </h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-zinc-400">
          Everything you need to know about Adakaro
        </p>

        <div className="mt-10 space-y-3">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-slate-200 bg-slate-50/50 open:bg-white dark:border-zinc-700 dark:bg-zinc-800/40 dark:open:bg-zinc-900"
            >
              <summary className="cursor-pointer list-none px-4 py-4 pr-10 text-sm font-semibold text-slate-900 outline-none ring-indigo-500 ring-offset-2 marker:content-none focus-visible:ring-2 dark:text-white [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-3">
                  <span>{item.q}</span>
                  <span className="shrink-0 text-indigo-600 transition group-open:rotate-180 dark:text-indigo-400">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m19.5 8.25-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </span>
                </span>
              </summary>
              <div className="border-t border-slate-200 px-4 pb-4 pt-0 text-sm leading-relaxed text-slate-600 dark:border-zinc-700 dark:text-zinc-400">
                <p className="pt-3">{item.a}</p>
              </div>
            </details>
          ))}
        </div>

        <p className="mt-12 border-t border-slate-200 pt-8 text-center text-sm dark:border-zinc-800 sm:text-left">
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
            href="/pricing"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Pricing
          </Link>
        </p>
      </article>
    </div>
  );
}
