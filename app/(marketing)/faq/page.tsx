import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LandingScrollBehavior,
  SmartFloatingScrollButton,
} from "@/components/landing/landing-scroll";

export const metadata: Metadata = {
  title: "FAQ — Adakaro",
  description:
    "Answers about Adakaro setup, simple per-student pricing, payments, parents, and school data.",
};

const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:w-auto";

const secondaryBtn =
  "inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-base font-semibold text-gray-900 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out hover:shadow-md hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 sm:w-auto";

const accordionCardClass =
  "group rounded-xl border border-gray-200 bg-white shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 open:shadow-md";

const faqGroups: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: "Pricing",
    items: [
      {
        q: "How much does Adakaro cost?",
        a: "You can start free with up to 20 students. After that, Adakaro costs TSh 500 per student per month, or TSh 5,000 per student per year.",
      },
      {
        q: "Do I lose features on monthly billing?",
        a: "No. Monthly and yearly schools get the same full system. Yearly billing simply helps you save TSh 1,000 per student per year.",
      },
      {
        q: "Are there different plans or feature limits?",
        a: "No. Adakaro does not lock features behind tiers. Every paying school gets the full system.",
      },
      {
        q: "Are transaction fees included?",
        a: "Mobile money, bank, or payment provider transaction fees may apply separately.",
      },
    ],
  },
  {
    title: "Setup",
    items: [
      {
        q: "Do I need a credit card to start?",
        a: "No. You can start free with up to 20 students without adding payment details. You only upgrade when your school grows.",
      },
      {
        q: "How long does setup take?",
        a: `Getting started is simple. Most schools follow these steps:

1. Create classes
2. Assign subjects to classes
3. Import students
4. Set fees and fee structures
5. Add users

Adakaro is designed to make this process simple, even for non-technical staff. Most schools are ready to start within the same day.`,
      },
      {
        q: "Can I import students in bulk?",
        a: "Yes. You can import students in bulk using a simple spreadsheet template, which saves time compared to entering each student manually. Most schools complete this in minutes.",
      },
      {
        q: "Do I need technical skills to use Adakaro?",
        a: "No. Adakaro is designed for everyday school staff, not technical users. Most tasks are simple and can be done without any technical background.",
      },
    ],
  },
  {
    title: "Payments",
    items: [
      {
        q: "How does payment tracking work?",
        a: "Adakaro helps schools track all payments in one place. Accountants can record payments manually from submitted receipts, update student balances, and generate clear reports showing who has paid and who still owes. You can start using this immediately after setup.",
      },
      {
        q: "Can parents pay using mobile money or bank?",
        a: "Parents can currently submit payment receipts (such as bank slips), and accountants record and verify payments inside the system. Adakaro is designed to support automated mobile money and bank payments as the platform continues to evolve.",
      },
    ],
  },
  {
    title: "Parents",
    items: [
      {
        q: "How do parents link to students?",
        a: "Parents are linked to students by the school administrator. Once linked, parents can view their child's fee balance, payments, and reports based on the access given by the school.",
      },
      {
        q: "Can parents see balances and reports?",
        a: "Yes. Parents can view their child's fee balance, payment history, and reports, helping them stay informed without needing to contact the school. This reduces follow-ups and saves time for staff.",
      },
    ],
  },
  {
    title: "Security",
    items: [
      {
        q: "Is school data secure?",
        a: "Yes. Adakaro is built with secure authentication and controlled access, ensuring that only authorized users can view or manage school data.",
      },
      {
        q: "Who can access student information?",
        a: "Access is controlled by the school. Administrators assign roles and permissions so each user (teachers, accountants, parents) only sees the information relevant to them.",
      },
    ],
  },
];

function slugifyHeading(title: string) {
  return `faq-${title.toLowerCase().replace(/\s+/g, "-")}`;
}

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      <LandingScrollBehavior />

      <section className="border-b border-gray-100 bg-gray-50 py-16 dark:border-zinc-800 dark:bg-zinc-900/30 md:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Frequently asked questions
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-zinc-400">
            Clear answers about setup, pricing, payments, parents, and school data.
            <br />
            Built for schools in Tanzania. Designed for real, everyday workflows.
          </p>
        </div>
      </section>

      <section className="border-b border-gray-100 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-950 md:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {faqGroups.map((group, groupIndex) => (
            <div
              key={group.title}
              className={cn(groupIndex > 0 && "mt-12 border-t border-gray-100 pt-12 dark:border-zinc-800")}
            >
              <h2
                id={slugifyHeading(group.title)}
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                {group.title}
              </h2>
              <div className="mt-4 space-y-3">
                {group.items.map((item) => (
                  <details key={item.q} className={accordionCardClass}>
                    <summary className="cursor-pointer list-none px-4 py-4 pr-10 text-left text-sm font-semibold text-gray-900 outline-none ring-indigo-500 ring-offset-2 marker:content-none focus-visible:ring-2 dark:text-white [&::-webkit-details-marker]:hidden">
                      <span className="flex items-start justify-between gap-3">
                        <span>{item.q}</span>
                        <span className="shrink-0 text-indigo-600 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out group-open:rotate-180 dark:text-indigo-400">
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
                    <div className="border-t border-gray-100 px-4 pb-4 pt-0 text-sm leading-relaxed text-gray-600 dark:border-zinc-800 dark:text-zinc-400">
                      <p className="whitespace-pre-line pt-3">{item.a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-gray-100 bg-gray-50 py-16 dark:border-zinc-800 dark:bg-zinc-900/30 md:py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Still have questions or want to see how it works?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-600 dark:text-zinc-400">
            Contact us and we&apos;ll help you understand how Adakaro can fit your
            school.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/signup?role=admin" className={primaryBtn}>
              Start Free
            </Link>
            <Link href="/contact" className={secondaryBtn}>
              Contact us
            </Link>
          </div>
        </div>
      </section>

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
          href="/pricing"
          className="font-medium text-gray-500 underline-offset-4 hover:text-indigo-600 hover:underline dark:text-zinc-500 dark:hover:text-indigo-400"
        >
          Pricing
        </Link>
      </p>

      <SmartFloatingScrollButton sectionIds={[]} />
    </div>
  );
}
