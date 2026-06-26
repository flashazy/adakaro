"use client";

import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AINavLink } from "./ai-nav-link";

const INLINE_RE =
  /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

type Block =
  | { type: "paragraph"; lines: string[] }
  | { type: "bullet-list"; items: string[] }
  | { type: "numbered-list"; items: string[] }
  | { type: "code"; language: string; code: string }
  | { type: "table"; headers: string[]; rows: string[][] };

function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) {
        codeLines.push(lines[i]!);
        i++;
      }
      blocks.push({ type: "code", language, code: codeLines.join("\n") });
      i++;
      continue;
    }

    if (trimmed.includes("|") && trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      const start = i;
      while (i < lines.length) {
        const t = lines[i]!.trim();
        if (!t.includes("|") || !t.startsWith("|")) break;
        tableLines.push(t);
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (row: string) =>
          row
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim());
        const headers = parseRow(tableLines[0]!);
        const dataRows = tableLines
          .slice(2)
          .filter((r) => !/^[\|\s:-]+$/.test(r))
          .map(parseRow);
        if (headers.length > 0 && dataRows.length > 0) {
          blocks.push({ type: "table", headers, rows: dataRows });
          continue;
        }
      }
      i = start;
    }

    if (/^[-•*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-•*]\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^[-•*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "bullet-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "numbered-list", items });
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const t = lines[i]!.trim();
      if (
        !t ||
        t.startsWith("```") ||
        (t.includes("|") && t.startsWith("|")) ||
        /^[-•*]\s+/.test(t) ||
        /^\d+\.\s+/.test(t)
      ) {
        break;
      }
      paraLines.push(t);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", lines: paraLines });
    }
  }

  return blocks;
}

function renderInline(text: string, linkClassName: string, isUser: boolean) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(INLINE_RE.source, "g");

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const codeText = match[1];
    const linkLabel = match[2];
    const linkHref = match[3];
    const boldText = match[4];
    const italicText = match[5];

    if (codeText !== undefined) {
      parts.push(
        <code
          key={`c-${match.index}`}
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[0.85em]",
            isUser
              ? "bg-indigo-500/40 text-indigo-50"
              : "bg-slate-100 text-indigo-700 dark:bg-zinc-800 dark:text-indigo-300"
          )}
        >
          {codeText}
        </code>
      );
    } else if (boldText !== undefined) {
      parts.push(
        <strong key={`b-${match.index}`} className="font-semibold">
          {boldText}
        </strong>
      );
    } else if (italicText !== undefined) {
      parts.push(
        <em key={`i-${match.index}`} className="italic">
          {italicText}
        </em>
      );
    } else if (linkLabel && linkHref) {
      const isExternal =
        linkHref.startsWith("http://") || linkHref.startsWith("https://");
      if (isExternal) {
        parts.push(
          <a
            key={`l-${match.index}-${linkHref}`}
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            {linkLabel}
          </a>
        );
      } else {
        parts.push(
          <AINavLink
            key={`l-${match.index}-${linkHref}`}
            href={linkHref}
            className={linkClassName}
          >
            {linkLabel}
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

function renderLine(line: string, linkClass: string, isUser: boolean) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const headingMatch = trimmed.match(/^\*\*([^*]+)\*\*$/);
  if (headingMatch) {
    return (
      <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
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
        <div className="pt-0.5">
          <AINavLink
            href={href}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 transition duration-150 hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-950"
          >
            <CtaIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {label}
          </AINavLink>
        </div>
      );
    }
  }

  return (
    <p className="min-w-0">{renderInline(trimmed, linkClass, isUser)}</p>
  );
}

export function AIMessageContent({
  content,
  isUser = false,
}: {
  content: string;
  isUser?: boolean;
}) {
  const linkClass = isUser
    ? "font-medium underline underline-offset-2 hover:text-indigo-100"
    : "font-medium text-indigo-600 underline underline-offset-2 transition-colors duration-150 hover:text-indigo-500 dark:text-indigo-400";

  const blocks = parseBlocks(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, bi) => {
        if (block.type === "code") {
          return (
            <div key={bi} className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-zinc-700">
              {block.language ? (
                <div className="border-b border-slate-200/80 bg-slate-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                  {block.language}
                </div>
              ) : null}
              <pre className="overflow-x-auto bg-slate-50 p-3 font-mono text-[13px] leading-relaxed text-slate-800 dark:bg-zinc-950 dark:text-zinc-200">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        if (block.type === "table") {
          return (
            <div
              key={bi}
              className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-zinc-700"
            >
              <table className="w-full min-w-[240px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/60">
                    {block.headers.map((h, hi) => (
                      <th
                        key={hi}
                        className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300"
                      >
                        {renderInline(h, linkClass, isUser)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, ri) => (
                    <tr
                      key={ri}
                      className="border-b border-slate-100 last:border-0 dark:border-zinc-800"
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="px-3 py-2 align-top text-slate-700 dark:text-zinc-300"
                        >
                          {renderInline(cell, linkClass, isUser)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "bullet-list") {
          return (
            <ul key={bi} className="space-y-2 pl-1">
              {block.items.map((item, ii) => (
                <li key={ii} className="flex gap-2.5">
                  <span
                    className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    {renderInline(item, linkClass, isUser)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "numbered-list") {
          return (
            <ol key={bi} className="space-y-2 pl-1">
              {block.items.map((item, ii) => (
                <li key={ii} className="flex gap-2.5">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"
                    aria-hidden
                  >
                    {ii + 1}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    {renderInline(item, linkClass, isUser)}
                  </span>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <div key={bi} className="space-y-2">
            {block.lines.map((line, li) => (
              <div key={li}>{renderLine(line, linkClass, isUser)}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
