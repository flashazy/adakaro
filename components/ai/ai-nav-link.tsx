"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useAIChatNavigate } from "./ai-chat-ui-context";

type AINavLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onClick"> & {
  href: string;
  children: ReactNode;
};

export function AINavLink({ href, children, ...props }: AINavLinkProps) {
  const navigateAndClose = useAIChatNavigate();
  const isExternal = href.startsWith("http://") || href.startsWith("https://");

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }

  if (!navigateAndClose) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        navigateAndClose(href);
      }}
    >
      {children}
    </Link>
  );
}
