"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTransition, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

function isModifiedClick(e: React.MouseEvent<HTMLAnchorElement>) {
  return (
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey ||
    e.button !== 0
  );
}

function isExternalHref(href: LinkProps["href"]): boolean {
  if (typeof href !== "string") return false;
  return (
    /^https?:\/\//i.test(href) ||
    href.startsWith("//") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

/**
 * Next.js `Link` with a small loading affordance during client navigations
 * (`useTransition` + `router.push`). Preserves prefetch on hover; skips
 * interception for modified clicks, `target="_blank"`, `download`, and
 * external URLs. Runs optional `onClick` first — if it calls
 * `preventDefault`, the transition is skipped.
 */
export function NavLinkWithLoading({
  href,
  className,
  children,
  onClick,
  ...rest
}: ComponentProps<typeof Link>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Link
      href={href}
      {...rest}
      aria-busy={isPending}
      className={cn(
        isPending && "pointer-events-none cursor-wait opacity-80",
        className
      )}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (isModifiedClick(e)) return;
        if (rest.target === "_blank") return;
        if (rest.download != null && rest.download !== false) return;
        if (isExternalHref(href)) return;
        e.preventDefault();
        if (isPending) return;
        startTransition(() => {
          void router.push(href as Parameters<typeof router.push>[0]);
        });
      }}
    >
      {isPending ? (
        <Loader2
          className="mr-1.5 inline-block h-3.5 w-3.5 shrink-0 animate-spin align-middle text-current"
          aria-hidden
        />
      ) : null}
      {children}
    </Link>
  );
}
