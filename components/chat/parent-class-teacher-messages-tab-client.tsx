"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  ensureChatConversationAction,
  insertChatMessageAction,
  listChatMessagesAction,
  markChatConversationReadAction,
} from "@/lib/chat/chat-server-actions";
import type { ParentThreadPollOk } from "@/lib/chat/poll-data";
import { ChatThreadBody, type ChatLine } from "@/components/chat/chat-thread-body";
import { cn } from "@/lib/utils";

const POLL_MS = 15_000;

export function ParentClassTeacherMessagesTabClient({
  parentId,
  classId,
  classTeacherId,
  studentName,
  onMessagesUnreadChange,
}: {
  parentId: string;
  classId: string;
  classTeacherId: string | null;
  studentName: string;
  onMessagesUnreadChange?: (count: number) => void;
}) {
  const onUnreadRef = useRef(onMessagesUnreadChange);
  useEffect(() => {
    onUnreadRef.current = onMessagesUnreadChange;
  }, [onMessagesUnreadChange]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollRefreshing, setPollRefreshing] = useState(false);

  const conversationIdRef = useRef<string | null>(null);
  const lastUnreadReported = useRef<number | null>(null);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const loadMessages = useCallback(async (cid: string) => {
    const res = await listChatMessagesAction(cid);
    if (res.ok) {
      setMessages(res.messages as ChatLine[]);
    }
  }, []);

  const reportUnread = useCallback((count: number) => {
    const cb = onUnreadRef.current;
    if (!cb) return;
    if (lastUnreadReported.current === count) return;
    lastUnreadReported.current = count;
    cb(count);
  }, []);

  useEffect(() => {
    lastUnreadReported.current = null;
  }, [parentId, classId, classTeacherId]);

  const applyParentPollPayload = useCallback(
    (data: ParentThreadPollOk, requestedCid: string) => {
      if (requestedCid !== conversationIdRef.current) return;
      setMessages(data.messages as ChatLine[]);
      reportUnread(data.unreadCount);
    },
    [reportUnread]
  );

  const fetchParentPoll = useCallback(
    async (
      signal: AbortSignal,
      requestedCid: string,
      options?: { ignoreVisibility?: boolean }
    ): Promise<void> => {
      if (
        !options?.ignoreVisibility &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      try {
        const u = new URL("/api/chat/parent-thread-poll", window.location.origin);
        u.searchParams.set("conversationId", requestedCid);
        const res = await fetch(u.toString(), {
          credentials: "include",
          signal,
        });
        if (signal.aborted) return;
        if (!res.ok) return;
        const body = (await res.json()) as ParentThreadPollOk | { ok?: false };
        if (!body || (body as ParentThreadPollOk).ok !== true) return;
        applyParentPollPayload(body as ParentThreadPollOk, requestedCid);
      } catch (e: unknown) {
        if (
          e &&
          typeof e === "object" &&
          (e as { name?: string }).name === "AbortError"
        ) {
          return;
        }
      }
    },
    [applyParentPollPayload]
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!classTeacherId?.trim()) {
        setLoading(false);
        setConversationId(null);
        setMessages([]);
        onUnreadRef.current?.(0);
        return;
      }
      setLoading(true);
      setError(null);
      const r = await ensureChatConversationAction(
        classTeacherId.trim(),
        parentId,
        classId
      );
      if (cancelled) return;
      if (!r.ok) {
        setConversationId(null);
        setMessages([]);
        setError(r.error);
        setLoading(false);
        return;
      }
      setConversationId(r.conversationId);
      await markChatConversationReadAction(r.conversationId);
      if (cancelled) return;
      await loadMessages(r.conversationId);
      if (cancelled) return;
      const res = await fetch(
        `/api/chat/parent-thread-poll?conversationId=${encodeURIComponent(r.conversationId)}`,
        { credentials: "include" }
      );
      if (cancelled) return;
      if (res.ok) {
        const body = (await res.json()) as ParentThreadPollOk | { ok?: false };
        if (body && (body as ParentThreadPollOk).ok === true) {
          const p = body as ParentThreadPollOk;
          setMessages(p.messages as ChatLine[]);
          const cb = onUnreadRef.current;
          if (cb) {
            lastUnreadReported.current = p.unreadCount;
            cb(p.unreadCount);
          }
        }
      }
      if (cancelled) return;
      setLoading(false);
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId, classId, classTeacherId]);

  useEffect(() => {
    if (!conversationId) return;
    let intervalId: number | null = null;
    let abort: AbortController | null = null;

    const clearTimers = () => {
      if (intervalId != null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      abort?.abort();
      abort = null;
    };

    let pollRunning = false;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const cid = conversationIdRef.current;
      if (!cid) return;
      if (pollRunning) return;
      pollRunning = true;
      abort?.abort();
      abort = new AbortController();
      const sig = abort.signal;
      void fetchParentPoll(sig, cid).finally(() => {
        pollRunning = false;
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        if (intervalId == null) {
          intervalId = window.setInterval(tick, POLL_MS);
        }
      } else {
        clearTimers();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState === "visible") {
      tick();
      intervalId = window.setInterval(tick, POLL_MS);
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimers();
    };
  }, [conversationId, fetchParentPoll]);

  const handleManualRefresh = useCallback(async () => {
    const cid = conversationIdRef.current;
    if (!cid || pollRefreshing) return;
    setPollRefreshing(true);
    const ac = new AbortController();
    try {
      await fetchParentPoll(ac.signal, cid, { ignoreVisibility: true });
    } finally {
      setPollRefreshing(false);
    }
  }, [fetchParentPoll, pollRefreshing]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !conversationId) return;
    setError(null);
    const r = await insertChatMessageAction(conversationId, text);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDraft("");
    await loadMessages(conversationId);
    const ac = new AbortController();
    await fetchParentPoll(ac.signal, conversationId, { ignoreVisibility: true });
  };

  if (!classTeacherId?.trim()) {
    return (
      <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-zinc-400">
        No class teacher is assigned for {studentName}&apos;s class yet. When
        your school assigns one, you can message them here.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-zinc-400">
        Loading messages…
      </div>
    );
  }

  if (error && !conversationId) {
    return (
      <div className="px-6 py-10 text-center text-sm text-rose-600 dark:text-rose-400">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col border-t border-slate-100 dark:border-zinc-800">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="min-w-0 text-xs text-slate-500 dark:text-zinc-400">
          Messages with your child&apos;s class teacher ({studentName})
        </p>
        <button
          type="button"
          onClick={() => void handleManualRefresh()}
          disabled={pollRefreshing || !conversationId}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          title="Check for new messages"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", pollRefreshing && "animate-spin")}
            aria-hidden
          />
          Refresh
        </button>
      </div>
      <div className="h-[400px] min-h-0 w-full shrink-0 overflow-hidden">
        <ChatThreadBody
          lines={messages}
          currentUserId={parentId}
          alwaysStickToBottom
        />
      </div>
      <div className="shrink-0 border-t border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        {error ? (
          <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
        ) : null}
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message…"
            rows={2}
            className="min-h-[2.75rem] flex-1 resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            disabled={!conversationId}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!conversationId || !draft.trim()}
            className="shrink-0 self-end rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
