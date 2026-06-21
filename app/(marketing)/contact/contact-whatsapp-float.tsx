import { MessageCircle } from "lucide-react";

export function ContactWhatsAppFloat({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-emerald-500/30 transition-transform hover:scale-[1.02] hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:bottom-8 sm:right-8"
      aria-label="WhatsApp Adakaro"
    >
      <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
      <span className="hidden sm:inline">WhatsApp Us</span>
    </a>
  );
}
