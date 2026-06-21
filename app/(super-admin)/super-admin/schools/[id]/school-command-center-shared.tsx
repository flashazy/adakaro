"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  saBtnPrimarySm,
  saBtnSecondarySm,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { SuperAdminNavLink } from "@/components/super-admin/super-admin-loading-action";
import {
  ChevronDown,
  Copy,
  Mail,
  MessageCircle,
  Phone,
  type LucideIcon,
} from "lucide-react";

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex items-center gap-1 rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
    >
      <Copy className="h-3 w-3" aria-hidden />
    </button>
  );
}

function whatsAppHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized =
    digits.startsWith("0") && digits.length >= 9
      ? `255${digits.slice(1)}`
      : digits;
  return `https://wa.me/${normalized}`;
}

export function ContactSchoolMenu({
  email,
  phone,
  contactsHref,
  className,
  variant = "secondary",
}: {
  email: string | null;
  phone: string | null;
  contactsHref: string;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const btnClass = variant === "primary" ? saBtnPrimarySm : saBtnSecondarySm;

  const hasCall = Boolean(phone?.trim());
  const hasEmail = Boolean(email?.trim());
  const hasWhatsApp = hasCall;
  const hasDirect = hasCall || hasEmail || hasWhatsApp;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!hasDirect) {
    return (
      <SuperAdminNavLink href={contactsHref} className={cn(btnClass, className)}>
        Contact School
      </SuperAdminNavLink>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        className={cn(btnClass, "inline-flex items-center gap-1.5")}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        Contact School
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {hasCall ? (
            <a
              role="menuitem"
              href={`tel:${phone!.trim()}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              Call School
            </a>
          ) : null}
          {hasEmail ? (
            <a
              role="menuitem"
              href={`mailto:${email!.trim()}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              Email School
            </a>
          ) : null}
          {hasWhatsApp ? (
            <a
              role="menuitem"
              href={whatsAppHref(phone!.trim())}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <MessageCircle className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              WhatsApp School
            </a>
          ) : null}
          <SuperAdminNavLink
            href={contactsHref}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            View in Contacts
          </SuperAdminNavLink>
        </div>
      ) : null}
    </div>
  );
}

export function ExecutiveSectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <div className="h-px flex-1 bg-slate-200" aria-hidden />
    </div>
  );
}

export function SchoolManagementCollapsible({
  children,
  defaultOpen = true,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="space-y-6">
      <ExecutiveSectionDivider label="School Management" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/80"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">School Management</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Administrative controls and onboarding tools
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        {open ? (
          <div id={panelId} className="space-y-6 border-t border-slate-100 px-5 py-6">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export type EmptyPanelTheme = "neutral" | "blue" | "purple" | "amber";

const emptyThemeStyles: Record<
  EmptyPanelTheme,
  { panel: string; iconWrap: string; icon: string }
> = {
  neutral: {
    panel: "border-slate-200 bg-slate-50/60",
    iconWrap: "bg-white text-slate-400 ring-slate-200",
    icon: "text-slate-400",
  },
  blue: {
    panel: "border-blue-200 bg-blue-50/50",
    iconWrap: "bg-white text-blue-500 ring-blue-200",
    icon: "text-blue-500",
  },
  purple: {
    panel: "border-violet-200 bg-violet-50/50",
    iconWrap: "bg-white text-violet-500 ring-violet-200",
    icon: "text-violet-500",
  },
  amber: {
    panel: "border-amber-200 bg-amber-50/50",
    iconWrap: "bg-white text-amber-500 ring-amber-200",
    icon: "text-amber-500",
  },
};

export function ThemedEmptyPanel({
  title,
  description,
  impact,
  recommendation,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  icon: Icon,
  theme = "neutral",
}: {
  title: string;
  description: string;
  impact?: string;
  recommendation?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  icon: LucideIcon;
  theme?: EmptyPanelTheme;
}) {
  const styles = emptyThemeStyles[theme];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center",
        styles.panel
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl shadow-sm ring-1",
          styles.iconWrap
        )}
      >
        <Icon className={cn("h-6 w-6", styles.icon)} strokeWidth={1.5} aria-hidden />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      {impact ? (
        <p className="mt-3 max-w-sm text-sm text-slate-600">
          <span className="font-medium text-slate-700">Impact:</span> {impact}
        </p>
      ) : null}
      {recommendation ? (
        <p className="mt-2 max-w-sm text-sm text-slate-600">
          <span className="font-medium text-slate-700">Recommended action:</span>{" "}
          {recommendation}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onPrimary} className={saBtnPrimarySm}>
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary ? (
          <button type="button" onClick={onSecondary} className={saBtnSecondarySm}>
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TableEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  theme = "neutral",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  theme?: EmptyPanelTheme;
}) {
  const styles = emptyThemeStyles[theme];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center",
        styles.panel
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl shadow-sm ring-1",
          styles.iconWrap
        )}
      >
        <Icon className={cn("h-5 w-5", styles.icon)} strokeWidth={1.5} aria-hidden />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className={cn(saBtnSecondarySm, "mt-5")}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ScoreDot({ className }: { className: string }) {
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", className)}
      aria-hidden
    />
  );
}
