"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

export type ChatLine = {
  id: string;
  message: string;
  created_at: string;
  sender_id: string;
};

function formatChatTimestamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function dedupeAndSortLines(lines: ChatLine[]): ChatLine[] {
  const byId = new Map<string, ChatLine>();
  for (const line of lines) {
    if (!line?.id) continue;
    if (!byId.has(line.id)) byId.set(line.id, line);
  }
  return [...byId.values()].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function ChatThreadBody({
  lines,
  currentUserId,
  alwaysStickToBottom = false,
}: {
  lines: ChatLine[];
  currentUserId: string;
  /** When true, scroll to the latest message on every update (e.g. parent dashboard thread). */
  alwaysStickToBottom?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const prevLastIdRef = useRef("");

  const sortedLines = useMemo(
    () => dedupeAndSortLines(lines),
    [lines]
  );

  useLayoutEffect(() => {
    const len = sortedLines.length;
    const lastId = len > 0 ? sortedLines[len - 1]!.id : "";

    if (len === 0) {
      prevLenRef.current = 0;
      prevLastIdRef.current = "";
      return;
    }

    const el = scrollRef.current;
    if (!el) return;

    if (alwaysStickToBottom) {
      el.scrollTop = el.scrollHeight;
      prevLenRef.current = len;
      prevLastIdRef.current = lastId;
      return;
    }

    const prevLen = prevLenRef.current;

    const firstOpen = prevLen === 0 && len > 0;
    const grew = len > prevLen;

    prevLenRef.current = len;
    prevLastIdRef.current = lastId;

    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100;

    if (firstOpen || (grew && nearBottom)) {
      el.scrollTop = el.scrollHeight;
    }
  }, [sortedLines, alwaysStickToBottom]);

  if (sortedLines.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center text-sm text-slate-500 dark:text-zinc-400">
        No messages yet. Say hello below.
      </div>
    );
  }

  const selfId = String(currentUserId);

  return (
    <div
      ref={scrollRef}
      className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4"
    >
      {sortedLines.map((m) => {
        const mine = String(m.sender_id) === selfId;
        return (
          <div
            key={m.id}
            className={cn("flex w-full shrink-0", mine ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[min(100%,28rem)] rounded-2xl px-3 py-2 text-sm shadow-sm",
                mine
                  ? "rounded-br-md bg-school-primary text-white"
                  : "rounded-bl-md border border-slate-200 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.message}</p>
              <p
                className={cn(
                  "mt-1 text-[0.65rem] tabular-nums",
                  mine ? "text-white/80" : "text-slate-500 dark:text-zinc-400"
                )}
              >
                {formatChatTimestamp(m.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
