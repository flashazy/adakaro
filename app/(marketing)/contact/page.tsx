import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { ContactForm } from "./contact-form";
import { ContactDirectCard } from "./contact-direct-card";
import { ContactWhatsAppFloat } from "./contact-whatsapp-float";
import { ContactWhatsAppProvider } from "./contact-whatsapp-provider";

export const metadata: Metadata = {
  title: "Request Demo — Adakaro",
  description:
    "Request a demo of Adakaro school management software for your school in Tanzania and East Africa.",
};

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
    <ContactWhatsAppProvider>
      <div className="min-h-screen overflow-x-clip bg-slate-50 px-5 pb-28 pt-8 dark:bg-zinc-950 sm:px-6 sm:py-16 md:pb-16">
        <div className="mx-auto max-w-3xl">
          <header className="mb-6 text-center sm:mb-10 sm:text-left lg:mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600 sm:text-[11px] sm:tracking-[0.14em]">
              Request Demo
            </p>
            <h1 className="mt-2 text-[clamp(1.75rem,8vw,2.5rem)] font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Request Demo / Contact Adakaro
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-lg leading-7 text-slate-600 dark:text-zinc-400 sm:mx-0 sm:text-base sm:leading-relaxed">
              See how Adakaro helps schools manage students, fees, report cards,
              and parent communication in one platform. Request a demo and our
              team will reach out shortly.
            </p>
          </header>

          <ul
            className="mb-7 flex flex-col items-center gap-3 sm:mb-8 sm:grid sm:max-w-xl sm:grid-cols-3 sm:items-start sm:gap-x-6 sm:gap-y-0 sm:text-left lg:mb-10"
            aria-label="Why schools trust Adakaro"
          >
            {trustItems.map((item) => (
              <li
                key={item.label}
                className={`flex items-center justify-center gap-2.5 text-sm leading-snug text-slate-600 dark:text-zinc-400 sm:justify-start ${item.desktopOrder}`}
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

          <div className="grid min-w-0 gap-6 lg:grid-cols-5 lg:gap-12">
            <div className="min-w-0 lg:col-span-3">
              <ContactForm />
            </div>

            <aside className="min-w-0 lg:col-span-2">
              <ContactDirectCard />
            </aside>
          </div>

          <nav
            className="mt-8 border-t border-slate-200 pt-6 dark:border-zinc-800 sm:mt-12 sm:pt-8"
            aria-label="Contact page links"
          >
            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5 text-xs leading-relaxed sm:justify-start sm:gap-x-5 sm:text-sm">
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
      <ContactWhatsAppFloat />
      <SmartFloatingScrollButton
        sectionIds={[]}
        hideWhileScrolling
        className="bottom-4 right-4 sm:bottom-8 sm:right-8"
      />
    </ContactWhatsAppProvider>
  );
}
