"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useContactWhatsApp } from "./contact-whatsapp-provider";

const CONTACT_FORM_ID = "contact-demo-form";

export function ContactWhatsAppFloat() {
  const { openWhatsAppModal } = useContactWhatsApp();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const form = document.getElementById(CONTACT_FORM_ID);
    if (!form) return;

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && form.contains(target)) {
        setHidden(true);
      }
    };

    const onFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || !form.contains(active)) {
          setHidden(false);
        }
      }, 0);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={openWhatsAppModal}
      className={cn(
        "fixed right-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-1 ring-emerald-500/30 transition-[opacity,transform] duration-200 hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:h-auto sm:w-auto sm:gap-2 sm:rounded-full sm:px-4 sm:py-3 sm:text-sm sm:font-semibold",
        "bottom-[88px] sm:bottom-[7.5rem] sm:right-8",
        hidden && "pointer-events-none translate-y-1 scale-95 opacity-0"
      )}
      aria-label="WhatsApp Adakaro"
      aria-hidden={hidden}
    >
      <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
      <span className="hidden sm:inline">WhatsApp Us</span>
    </button>
  );
}
