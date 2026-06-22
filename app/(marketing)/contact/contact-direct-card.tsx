"use client";

import { MessageCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTACT_CARD_CLASS,
  CONTACT_HELPER_CLASS,
  CONTACT_SECTION_LABEL_CLASS,
} from "./contact-ui";
import { useContactWhatsApp } from "./contact-whatsapp-provider";

export function ContactWhatsAppButton({
  className,
  fullWidth = true,
}: {
  className?: string;
  fullWidth?: boolean;
}) {
  const { openWhatsAppModal } = useContactWhatsApp();

  return (
    <button
      type="button"
      onClick={openWhatsAppModal}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
        fullWidth && "w-full",
        className
      )}
    >
      <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
      WhatsApp Adakaro
    </button>
  );
}

export function ContactDirectCard() {
  const { openWhatsAppModal } = useContactWhatsApp();

  return (
    <div className={CONTACT_CARD_CLASS}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        Contact Adakaro Directly
      </h2>
      <dl className="mt-4 text-sm">
        <div className="pb-6">
          <dt className={CONTACT_SECTION_LABEL_CLASS}>Email</dt>
          <dd className="mt-1">
            <a
              href="mailto:info@adakaro.com"
              className="font-medium text-indigo-600 hover:text-indigo-500 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-400"
            >
              info@adakaro.com
            </a>
          </dd>
          <dd className={`mt-1.5 ${CONTACT_HELPER_CLASS}`}>
            We respond within 24 hours on business days.
          </dd>
        </div>

        <div className="-mx-1 rounded-xl bg-emerald-50/80 p-4 ring-1 ring-emerald-100/80 dark:bg-emerald-950/20 dark:ring-emerald-900/40">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Zap className="h-3 w-3" aria-hidden />
            Fastest Response
          </span>
          <dt className={`mt-3 ${CONTACT_SECTION_LABEL_CLASS} text-emerald-800/70 dark:text-emerald-400/80`}>
            WhatsApp
          </dt>
          <dd className="mt-1">
            <button
              type="button"
              onClick={openWhatsAppModal}
              className="text-lg font-bold leading-snug text-slate-900 hover:text-emerald-700 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-white dark:hover:text-emerald-400"
            >
              +255 762 545 454
            </button>
          </dd>
          <dd className={`mt-1.5 ${CONTACT_HELPER_CLASS}`}>
            Preferred contact method for demos and support.
          </dd>
          <dd className={`mt-2 ${CONTACT_HELPER_CLASS}`}>
            <span className="font-medium text-slate-600 dark:text-zinc-400">
              Available:
            </span>{" "}
            Mon–Fri
            <br />
            8:00 AM – 6:00 PM (EAT)
          </dd>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Send us a WhatsApp message and we&apos;ll help you schedule a demo
            for your school.
          </p>
          <div className="mt-4">
            <ContactWhatsAppButton />
          </div>
        </div>
      </dl>
    </div>
  );
}
