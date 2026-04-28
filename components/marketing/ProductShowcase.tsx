import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ProductShowcaseItem = {
  label: string;
  title: string;
  description: string;
  bullets: string[];
  imageSrc: string;
  imageAlt: string;
};

const showcaseItems: ProductShowcaseItem[] = [
  {
    label: "Overview",
    title: "See your school at a glance",
    description:
      "Track students, payments, outstanding balances, and activity from one clear dashboard.",
    bullets: [
      "View key numbers instantly",
      "Spot payment trends",
      "Understand school performance",
    ],
    imageSrc: "/screenshots/dashboard.png",
    imageAlt: "Adakaro dashboard overview",
  },
];

export function ProductShowcase() {
  return (
    <section className="bg-gradient-to-b from-white via-slate-50 to-white py-24 md:py-32 dark:from-black dark:via-zinc-950 dark:to-black">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-5xl dark:text-white">
            Everything your school needs, in one simple system
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Adakaro brings fees, students, reports, and report cards into one
            clear workspace built for real school operations.
          </p>
        </div>

        <div className="space-y-14 md:space-y-16">
          {showcaseItems.map((item, idx) => {
            const reverse = idx % 2 === 1;
            return (
              <div
                key={item.title}
                className="relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm md:grid md:grid-cols-2 md:items-center md:gap-8 md:p-8 dark:border-zinc-800 dark:bg-zinc-950"
              >
                {idx === 0 ? (
                  <div
                    className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/20"
                    aria-hidden
                  />
                ) : null}

                <div
                  className={cn(
                    "relative z-10",
                    reverse ? "md:order-2" : "md:order-1"
                  )}
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                    {item.label}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-gray-900 md:text-3xl dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-gray-600 dark:text-gray-400">
                    {item.description}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {item.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400"
                          aria-hidden
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  className={cn(
                    "mt-6 md:mt-0",
                    reverse ? "md:order-1" : "md:order-2"
                  )}
                >
                  <div
                    className={cn(
                      "overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-lg dark:border-zinc-800 dark:bg-zinc-900",
                      idx === 0 ? "bg-white" : ""
                    )}
                  >
                    <Image
                      src={item.imageSrc}
                      alt={item.imageAlt}
                      width={1400}
                      height={900}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                      className="object-contain w-full h-auto"
                      style={{ imageRendering: "auto" }}
                      quality={100}
                      priority={idx === 0}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-xl font-semibold text-gray-900 dark:text-white">
            Ready to bring clarity to your school?
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Start Free
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-200 dark:hover:bg-zinc-900"
            >
              Contact us
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
