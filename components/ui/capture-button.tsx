"use client";

import Link from "next/link";
import type { LinkProps } from "next/link";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md";

function baseButtonClasses(variant: Variant, size: Size) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium touch-manipulation transition-[transform,colors,box-shadow,filter] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-school-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-950";

  const sizing = size === "sm" ? "px-3 py-2 text-sm" : "px-4 py-2.5 text-sm";

  const v =
    variant === "primary"
      ? "bg-school-primary text-white shadow-sm hover:brightness-105"
      : variant === "outline"
        ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        : "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800";

  return cn(base, sizing, v);
}

export interface CaptureButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingLabel?: string;
}

export const CaptureButton = forwardRef<HTMLButtonElement, CaptureButtonProps>(
  function CaptureButton(
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      loadingLabel,
      disabled,
      children,
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={cn(baseButtonClasses(variant, size), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            <span>{loadingLabel ?? children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

export interface CaptureLinkButtonProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: LinkProps["href"];
  variant?: Variant;
  size?: Size;
}

export const CaptureLinkButton = forwardRef<
  HTMLAnchorElement,
  CaptureLinkButtonProps
>(function CaptureLinkButton(
  { href, className, variant = "primary", size = "sm", children, ...rest },
  ref
) {
  return (
    <Link
      ref={ref}
      href={href}
      className={cn(baseButtonClasses(variant, size), className)}
      {...rest}
    >
      {children}
    </Link>
  );
});

