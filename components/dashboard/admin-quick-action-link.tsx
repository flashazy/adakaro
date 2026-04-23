"use client";

import Link, { type LinkProps } from "next/link";
import { forwardRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDashboardFeedback } from "./dashboard-feedback-provider";

type Props = Omit<LinkProps, "className"> & {
  className?: string;
};

export const AdminQuickActionLink = forwardRef<
  HTMLAnchorElement,
  Props & { children: React.ReactNode }
>(function AdminQuickActionLink({ href, className, children, ...rest }, ref) {
  const pathname = usePathname();
  const { startNavigation } = useDashboardFeedback();

  function maybeStartNav() {
    if (typeof href !== "string") return;
    let targetPath = href;
    try {
      targetPath = new URL(
        href,
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost"
      ).pathname;
    } catch {
      targetPath = href.split("?")[0] ?? href;
    }
    if (targetPath !== pathname) startNavigation();
  }

  return (
    <Link
      ref={ref}
      href={href}
      className={cn(
        "touch-manipulation transition-transform duration-150 ease-out active:scale-[0.98]",
        className
      )}
      onPointerDown={maybeStartNav}
      {...rest}
    >
      {children}
    </Link>
  );
});
