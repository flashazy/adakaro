"use client";

import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  useCallback,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";

/** Inline spinner matching app-wide loading affordance (Loader2). */
export function SuperAdminSpinner({
  className,
}: {
  className?: string;
}) {
  return (
    <Loader2
      className={cn("h-3.5 w-3.5 shrink-0 animate-spin", className)}
      aria-hidden
    />
  );
}

export const superAdminActionBusyClass =
  "pointer-events-none cursor-not-allowed opacity-80";

type ButtonProps = ComponentProps<"button">;

export interface SuperAdminLoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingLabel?: ReactNode;
  success?: boolean;
  successLabel?: ReactNode;
}

/** Button with spinner, loading label, and duplicate-click prevention. */
export function SuperAdminLoadingButton({
  loading = false,
  loadingLabel = "Loading…",
  success = false,
  successLabel = "Done",
  disabled,
  className,
  children,
  onClick,
  type = "button",
  ...rest
}: SuperAdminLoadingButtonProps) {
  const isBusy = loading || success;
  const label = loading
    ? loadingLabel
    : success
      ? successLabel
      : children;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5",
        (loading || disabled) && "cursor-not-allowed",
        isBusy && "opacity-80",
        className
      )}
      onClick={(e) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {isBusy ? <SuperAdminSpinner /> : null}
      <span className={cn(isBusy && "tabular-nums")}>{label}</span>
    </button>
  );
}

type NavLinkProps = ComponentProps<typeof NavLinkWithLoading>;

/** Super Admin nav link with loading label during route transitions. */
export function SuperAdminNavLink({
  loadingLabel = "Loading…",
  className,
  children,
  ...rest
}: NavLinkProps & { loadingLabel?: ReactNode }) {
  return (
    <NavLinkWithLoading
      loadingLabel={loadingLabel}
      className={cn("inline-flex items-center gap-1.5", className)}
      {...rest}
    >
      {children}
    </NavLinkWithLoading>
  );
}

type AnchorProps = ComponentProps<"a">;

/** Plain anchor navigation with immediate loading feedback (full page/API routes). */
export function SuperAdminLoadingAnchor({
  href,
  loadingLabel = "Loading…",
  className,
  children,
  onClick,
  ...rest
}: AnchorProps & { loadingLabel?: ReactNode }) {
  const [loading, setLoading] = useState(false);

  return (
    <a
      href={href}
      aria-busy={loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5",
        loading && superAdminActionBusyClass,
        className
      )}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || loading) return;
        setLoading(true);
      }}
      {...rest}
    >
      {loading ? (
        <>
          <SuperAdminSpinner />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </a>
  );
}

/** Download/export link with “Exporting…” feedback and duplicate-click guard. */
export function SuperAdminExportLink({
  href,
  className,
  children,
  loadingLabel = "Exporting…",
  onClick,
  ...rest
}: AnchorProps & { loadingLabel?: ReactNode }) {
  const [exporting, setExporting] = useState(false);

  return (
    <a
      href={href}
      aria-busy={exporting}
      className={cn(
        "inline-flex items-center justify-center gap-1.5",
        exporting && superAdminActionBusyClass,
        className
      )}
      onClick={(e) => {
        if (exporting) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
        if (e.defaultPrevented) return;
        setExporting(true);
        window.setTimeout(() => setExporting(false), 4000);
      }}
      {...rest}
    >
      {exporting ? (
        <>
          <SuperAdminSpinner />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </a>
  );
}

/** Copy-to-clipboard with Copying… / Copied feedback. */
export function useCopyWithFeedback(resetMs = 1600) {
  const [state, setState] = useState<"idle" | "copying" | "copied">("idle");

  const copy = useCallback(
    async (text: string, onError?: () => void) => {
      if (!text || state === "copying") return false;
      setState("copying");
      try {
        await navigator.clipboard.writeText(text);
        setState("copied");
        window.setTimeout(() => setState("idle"), resetMs);
        return true;
      } catch {
        setState("idle");
        onError?.();
        return false;
      }
    },
    [resetMs, state]
  );

  return {
    copy,
    state,
    isCopying: state === "copying",
    isCopied: state === "copied",
    copyLabel: (idle: string) =>
      state === "copying" ? "Copying…" : state === "copied" ? "Copied" : idle,
  };
}

/** Programmatic export/download via URL with loading state. */
export function useExportDownload() {
  const [exporting, setExporting] = useState(false);

  const download = useCallback(
    (url: string) => {
      if (exporting) return;
      setExporting(true);
      window.location.href = url;
      window.setTimeout(() => setExporting(false), 4000);
    },
    [exporting]
  );

  return { exporting, download };
}

/** Wrap async handlers with per-action loading + duplicate guard. */
export function useAsyncAction<T extends unknown[]>(
  action: (...args: T) => Promise<void> | void
) {
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (...args: T) => {
      if (loading) return;
      setLoading(true);
      try {
        await action(...args);
      } finally {
        setLoading(false);
      }
    },
    [action, loading]
  );

  return { loading, run };
}

export function SuperAdminCopyButton({
  text,
  label,
  copyingLabel = "Copying…",
  copiedLabel = "Copied",
  className,
  onError,
}: {
  text: string;
  label: string;
  copyingLabel?: string;
  copiedLabel?: string;
  className?: string;
  onError?: () => void;
}) {
  const { copy, state } = useCopyWithFeedback();

  return (
    <SuperAdminLoadingButton
      type="button"
      loading={state === "copying"}
      loadingLabel={copyingLabel}
      success={state === "copied"}
      successLabel={copiedLabel}
      className={className}
      onClick={() => void copy(text, onError)}
    >
      {label}
    </SuperAdminLoadingButton>
  );
}

export function preventDoubleClick(
  e: MouseEvent,
  busy: boolean
): boolean {
  if (busy) {
    e.preventDefault();
    return true;
  }
  return false;
}
