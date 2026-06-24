"use client";

import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AINavLink } from "./ai-nav-link";

// Matches either a markdown link [label](href) or inline bold **text**.
const INLINE_RE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;

function renderInline(text: string, linkClassName: string) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(INLINE_RE.source, "g");

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const boldText = match[3];
    if (boldText !== undefined) {
      // Inline bold (e.g. "**Overall completion:** 100%").
      parts.push(
        <strong key={`b-${match.index}`} className="font-semibold">
          {boldText}
        </strong>
      );
    } else {
      const label = match[1]!;
      const href = match[2]!;
      const isExternal =
        href.startsWith("http://") || href.startsWith("https://");
      if (isExternal) {
        parts.push(
          <a
            key={`l-${match.index}-${href}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            {label}
          </a>
        );
      } else {
        parts.push(
          <AINavLink key={`l-${match.index}-${href}`} href={href} className={linkClassName}>
            {label}
          </AINavLink>
        );
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export function AIMessageContent({
  content,
  isUser = false,
}: {
  content: string;
  isUser?: boolean;
}) {
  const lines = content.split("\n");
  const linkClass = isUser
    ? "font-medium underline underline-offset-2 hover:text-indigo-100"
    : "font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-400";

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" aria-hidden />;

        // Full-line bold = section heading (only when the whole line is bold).
        const headingMatch = trimmed.match(/^\*\*([^*]+)\*\*$/);
        if (headingMatch) {
          return (
            <p
              key={i}
              className={cn(
                "text-sm font-semibold text-slate-900 dark:text-white",
                i > 0 && "mt-1"
              )}
            >
              {headingMatch[1]}
            </p>
          );
        }

        const ctaMatch = trimmed.match(/^[✓→]\s*(.+)$/);
        if (ctaMatch) {
          const inner = ctaMatch[1]!.trim();
          const linkOnly = inner.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
          if (linkOnly) {
            const href = linkOnly[2]!;
            const label = linkOnly[1]!;
            const isArrow = trimmed.startsWith("→");
            const CtaIcon = isArrow ? ArrowRight : Check;
            return (
              <div key={i} className="pt-0.5">
                <AINavLink
                  href={href}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 transition hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-950"
                >
                  <CtaIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {label}
                </AINavLink>
              </div>
            );
          }
        }

        const bulletMatch = trimmed.match(/^[•\-]\s+(.+)$/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex gap-2 pl-0.5">
              <span
                className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-400"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                {renderInline(bulletMatch[1]!, linkClass)}
              </span>
            </div>
          );
        }

        return (
          <p key={i} className="min-w-0">
            {renderInline(trimmed, linkClass)}
          </p>
        );
      })}
    </div>
  );
}
