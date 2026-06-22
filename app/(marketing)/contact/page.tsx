import type { Metadata } from "next";
import Link from "next/link";
import { Check, MessageCircle } from "lucide-react";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { ContactForm } from "./contact-form";
import { ContactWhatsAppFloat } from "./contact-whatsapp-float";

export const metadata: Metadata = {
  title: "Request Demo — Adakaro",
  description:
    "Request a demo of Adakaro school management software for your school in Tanzania and East Africa.",
};

const WHATSAPP_HREF =
  "https://wa.me/255762545454?text=Hello%20Adakaro%2C%20I%20would%20like%20to%20request%20a%20demo%20for%20my%20school.";

const footerLinks = [
  { href: "/", label: "← Back to home" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
] as const;

const trustItems = [
  {
    label: "Built for African Schools",
    desktopOrder: "sm:order-3",
  },
  {
    label: "Live Demo Available",
    desktopOrder: "sm:order-2",
  },
  {
    label: "Response within 24 hours",
    desktopOrder: "sm:order-1",
  },
] as const;

export default function ContactPage() {
  return (
    <>
      <div className="min-h-screen bg-slate-50 px-5 pb-28 pt-8 dark:bg-zinc-950 sm:px-6 sm:py-16 md:pb-16">
        <div className="mx-auto max-w-3xl">
          <header className="mb-6 text-center sm:mb-12 sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600 sm:text-[11px] sm:tracking-[0.14em]">
              Request Demo
            </p>
            <h1 className="mt-2 text-[clamp(1.75rem,8vw,2.5rem)] font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Request Demo / Contact Adakaro
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-lg leading-8 text-slate-600 dark:text-zinc-400 sm:mx-0 sm:text-base sm:leading-relaxed">
              See how Adakaro helps schools manage students, fees, report cards,
              and parent communication in one platform. Request a demo and our
              team will reach out shortly.
            </p>
          </header>

          <ul
            className="mb-6 flex flex-col items-center gap-3 sm:mb-8 sm:grid sm:max-w-xl sm:grid-cols-3 sm:items-start sm:gap-x-6 sm:gap-y-0 sm:text-left lg:mb-10"
            aria-label="Why schools trust Adakaro"
          >
            {trustItems.map((item) => (
              <li
                key={item.label}
                className={`flex items-center justify-center gap-2.5 text-sm text-slate-600 dark:text-zinc-400 sm:justify-start ${item.desktopOrder}`}
              >
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-emerald-600/80 dark:text-emerald-500/80"
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>

          <div className="grid gap-6 lg:grid-cols-5 lg:gap-12">
            <div className="lg:col-span-3">
              <ContactForm />
            </div>

            <aside className="lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-xl sm:p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Contact Adakaro Directly
                </h2>
                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                      Email
                    </dt>
                    <dd className="mt-1">
                      <a
                        href="mailto:info@adakaro.com"
                        className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                      >
                        info@adakaro.com
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                      Phone / WhatsApp
                    </dt>
                    <dd className="mt-1">
                      <a
                        href="tel:+255762545454"
                        className="text-base font-semibold text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                      >
                        +255 762 545 454
                      </a>
                    </dd>
                    <dd className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-zinc-500">
                      <span className="font-medium text-slate-600 dark:text-zinc-400">
                        Available:
                      </span>{" "}
                      Mon–Fri
                      <br />
                      8:00 AM – 6:00 PM (EAT)
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  Prefer WhatsApp? Message us directly and request a demo for
                  your school.
                </p>
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  WhatsApp Adakaro
                </a>
              </div>
            </aside>
          </div>

          <nav
            className="mt-8 border-t border-slate-200 pt-6 dark:border-zinc-800 sm:mt-12 sm:pt-8"
            aria-label="Contact page links"
          >
            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:justify-start sm:gap-x-3 sm:text-sm">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <ContactWhatsAppFloat href={WHATSAPP_HREF} />
      <SmartFloatingScrollButton
        sectionIds={[]}
        hideWhileScrolling
        className="bottom-4 right-4 sm:bottom-8 sm:right-8"
      />
    </>
  );
}
