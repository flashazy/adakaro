import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
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

export default function ContactPage() {
  return (
    <>
      <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-zinc-950 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <header className="mb-10 text-center sm:mb-12 sm:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
              Request Demo
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Request Demo / Contact Adakaro
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400 sm:text-base">
              See how Adakaro helps schools manage students, fees, report cards,
              and parent communication in one platform. Request a demo and our
              team will reach out shortly.
            </p>
          </header>

          <div className="grid gap-10 lg:grid-cols-5 lg:gap-12">
            <div className="lg:col-span-3">
              <ContactForm />
            </div>

            <aside className="lg:col-span-2">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Contact Adakaro Directly
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
                      Phone / WhatsApp
                    </dt>
                    <dd className="mt-1 text-slate-600 dark:text-zinc-400">
                      <a
                        href="tel:+255762545454"
                        className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                      >
                        +255 762 545 454
                      </a>
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
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  WhatsApp Adakaro
                </a>
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
      <ContactWhatsAppFloat href={WHATSAPP_HREF} />
      <SmartFloatingScrollButton sectionIds={[]} />
    </>
  );
}
