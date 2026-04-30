"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { ClassTeacherMessageParentRow } from "@/lib/class-teacher-messages";
import {
  ensureChatConversationAction,
  insertChatMessageAction,
  listChatMessagesAction,
  listTeacherChatConversationsAction,
  markChatConversationReadAction,
} from "@/lib/chat/chat-server-actions";
import type { TeacherInboxPollOk } from "@/lib/chat/poll-data";
import { ChatThreadBody, type ChatLine } from "@/components/chat/chat-thread-body";
import { cn } from "@/lib/utils";
import { enqueueOrRun } from "@/lib/offline/enqueue-or-run";
import { useOfflineMessagesForConversation } from "@/lib/offline/use-sync";

type ConversationRow = {
  id: string;
  parent_id: string;
  class_id: string;
  last_message: string | null;
  last_message_at: string;
};

const POLL_MS = 15_000;

/** One-line preview for the parent list (not the full thread). */
function sidebarPreview(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const single = String(raw).replace(/\s+/g, " ").trim();
  const max = 48;
  return single.length <= max ? single : `${single.slice(0, max)}…`;
}

function pickInitialParentRow(
  rows: ClassTeacherMessageParentRow[],
  initialParentId?: string,
  _initialStudentName?: string
): ClassTeacherMessageParentRow | null {
  if (rows.length === 0) return null;
  const pid = initialParentId?.trim();
  if (!pid) return rows[0] ?? null;
  const matches = rows.filter((r) => r.parentId === pid);
  if (matches.length === 0) return rows[0] ?? null;
  return matches[0]!;
}

export function ClassTeacherMessagesClient({
  teacherId,
  parentRows,
  initialParentId,
  initialStudentName,
}: {
  teacherId: string;
  parentRows: ClassTeacherMessageParentRow[];
  /** From `/messages?parentId=…` (class teacher student list). */
  initialParentId?: string;
  initialStudentName?: string;
}) {
  const [selected, setSelected] = useState<ClassTeacherMessageParentRow | null>(
    () => pickInitialParentRow(parentRows, initialParentId, initialStudentName)
  );
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [pollRefreshing, setPollRefreshing] = useState(false);
  const [unreadByConversationId, setUnreadByConversationId] = useState<
    Record<string, number>
  >({});

  const mountedRef = useRef(true);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const appliedUrlSelectionRef = useRef<{ pid: string; sn: string }>({
    pid: "",
    sn: "",
  });
  useEffect(() => {
    const pid = initialParentId?.trim() ?? "";
    const sn = initialStudentName?.trim() ?? "";
    if (!pid && !sn) return;
    const prev = appliedUrlSelectionRef.current;
    if (prev.pid === pid && prev.sn === sn) return;
    appliedUrlSelectionRef.current = { pid, sn };
    const next = pickInitialParentRow(parentRows, initialParentId, initialStudentName);
    if (next) setSelected(next);
    // Only re-apply when the URL query changes, not when parentRows is a new array reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialParentId, initialStudentName]);

  const convByKey = useMemo(() => {
    const m = new Map<string, ConversationRow>();
    for (const c of conversations) {
      m.set(`${c.parent_id}:${c.class_id}`, c);
    }
    return m;
  }, [conversations]);

  const refreshConversations = useCallback(async () => {
    const r = await listTeacherChatConversationsAction();
    if (r.ok) {
      setConversations(r.conversations);
    }
  }, []);

  const loadMessages = useCallback(async (cid: string) => {
    const r = await listChatMessagesAction(cid);
    if (r.ok) {
      setMessages(r.messages as ChatLine[]);
    }
  }, []);

  const markRead = useCallback(async (cid: string | null) => {
    if (!cid) return;
    await markChatConversationReadAction(cid);
  }, []);

  const applyTeacherPollPayload = useCallback(
    (data: TeacherInboxPollOk, requestedCid: string | null) => {
      if (!mountedRef.current) return;
      if (requestedCid !== conversationIdRef.current) return;
      setConversations(data.conversations as ConversationRow[]);
      if (requestedCid && data.messages !== null) {
        setMessages(data.messages as ChatLine[]);
      }
      setUnreadByConversationId(data.unreadByConversationId);
    },
    []
  );

  const fetchTeacherPoll = useCallback(
    async (
      signal: AbortSignal,
      requestedCid: string | null,
      options?: { ignoreVisibility?: boolean }
    ): Promise<void> => {
      if (!mountedRef.current) return;
      if (
        !options?.ignoreVisibility &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      try {
        const u = new URL("/api/chat/teacher-inbox-poll", window.location.origin);
        if (requestedCid) u.searchParams.set("conversationId", requestedCid);
        const res = await fetch(u.toString(), {
          credentials: "include",
          signal,
        });
        if (!mountedRef.current || signal.aborted) return;
        if (!res.ok) return;
        const body = (await res.json()) as TeacherInboxPollOk | { ok?: false };
        if (!body || (body as TeacherInboxPollOk).ok !== true) return;
        applyTeacherPollPayload(body as TeacherInboxPollOk, requestedCid);
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
    [applyTeacherPollPayload]
  );

  const openThread = useCallback(
    async (row: ClassTeacherMessageParentRow) => {
      setSelected(row);
      setSendError(null);
      setLoadingThread(true);
      try {
        const r = await ensureChatConversationAction(
          teacherId,
          row.parentId,
          row.classId
        );
        if (!r.ok) {
          setConversationId(null);
          setMessages([]);
          setSendError(r.error);
          return;
        }
        setConversationId(r.conversationId);
        await loadMessages(r.conversationId);
        await markRead(r.conversationId);
        await refreshConversations();
      } finally {
        setLoadingThread(false);
      }
    },
    [teacherId, loadMessages, markRead, refreshConversations]
  );

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (!selected) return;
    void openThread(selected);
  }, [selected, openThread]);

  useEffect(() => {
    mountedRef.current = true;
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
      if (!mountedRef.current) return;
      if (document.visibilityState !== "visible") return;
      if (pollRunning) return;
      pollRunning = true;
      abort?.abort();
      abort = new AbortController();
      const requestedCid = conversationIdRef.current;
      const sig = abort.signal;
      void fetchTeacherPoll(sig, requestedCid).finally(() => {
        pollRunning = false;
      });
    };

    const onVisibility = () => {
      if (!mountedRef.current) return;
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
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimers();
    };
  }, [fetchTeacherPoll]);

  const handleManualRefresh = useCallback(async () => {
    if (pollRefreshing) return;
    setPollRefreshing(true);
    const ac = new AbortController();
    try {
      const requestedCid = conversationIdRef.current;
      await fetchTeacherPoll(ac.signal, requestedCid, {
        ignoreVisibility: true,
      });
    } finally {
      setPollRefreshing(false);
    }
  }, [fetchTeacherPoll, pollRefreshing]);

  // Merge server-confirmed messages with locally-queued ones for the
  // active conversation. Queued messages render with a "pending" badge
  // and disappear once `messages_offline` removes them after sync.
  const offlinePending = useOfflineMessagesForConversation(conversationId);
  const mergedMessages = useMemo<ChatLine[]>(() => {
    if (offlinePending.length === 0) return messages;
    const pendingLines: ChatLine[] = offlinePending.map((row) => ({
      id: `pending:${row.uuid}`,
      message: row.body,
      created_at: new Date(row.createdAt).toISOString(),
      sender_id: row.senderId,
      pending: true,
    }));
    return [...messages, ...pendingLines];
  }, [messages, offlinePending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !conversationId || sending) return;
    setSending(true);
    setSendError(null);
    try {
      // Offline-aware path: when online → server action runs as before;
      // when offline → message is queued in IndexedDB and rendered as a
      // pending bubble. The dispatcher replays it once the network
      // returns.
      const wrapped = await enqueueOrRun({
        kind: "send-message",
        payload: { conversationId, message: text },
        run: () => insertChatMessageAction(conversationId, text),
        hint: {
          label: `Message · ${conversationId.slice(0, 8)}`,
          messages: {
            conversationId,
            senderId: teacherId,
            body: text,
          },
        },
      });

      if (!wrapped.ok) {
        setSendError(wrapped.error);
        toast.error(wrapped.error);
        return;
      }

      if (wrapped.queued) {
        // Pending bubble appears via the live-query merge below; just
        // clear the draft and inform the user.
        setDraft("");
        toast.message("Saved offline – will sync when online");
        return;
      }

      const r = wrapped.result;
      if (!r.ok) {
        setSendError(r.error);
        toast.error(r.error);
        return;
      }
      setDraft("");
      await loadMessages(conversationId);
      await refreshConversations();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[min(36rem,72vh)] min-h-[22rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:flex-row">
      <aside className="flex h-auto max-h-[40%] min-h-0 w-full shrink-0 flex-col border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:h-full lg:max-h-none lg:w-[18rem] lg:max-w-[18rem] lg:border-b-0 lg:border-r">
        <div className="shrink-0 border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
          Parents
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:min-h-0">
          {parentRows.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-slate-500 dark:text-zinc-400">
              No linked parents in your classes yet.
            </li>
          ) : (
            parentRows.map((row) => {
              const conv = convByKey.get(`${row.parentId}:${row.classId}`);
              const preview = sidebarPreview(conv?.last_message);
              const active =
                selected?.parentId === row.parentId &&
                selected?.classId === row.classId;
              const unread = conv ? unreadByConversationId[conv.id] ?? 0 : 0;
              return (
                <li key={`${row.parentId}:${row.classId}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(row)}
                    aria-label={[
                      `Open chat with ${row.parentName}`,
                      row.className,
                      preview ? `Last message preview: ${preview}` : "No messages yet",
                    ].join(". ")}
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-b border-slate-100 px-3 py-2.5 text-left text-sm transition-colors dark:border-zinc-800",
                      active
                        ? "bg-slate-100 dark:bg-zinc-800/80"
                        : "hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                    )}
                  >
                    <span className="font-medium text-slate-900 dark:text-white">
                      {row.parentName}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      {row.className}
                    </span>
                    {preview ? (
                      <span
                        className="line-clamp-1 break-words text-xs text-slate-500 dark:text-zinc-400"
                        title={conv?.last_message ?? undefined}
                      >
                        {preview}
                      </span>
                    ) : (
                      <span className="text-xs italic text-slate-400 dark:text-zinc-500">
                        No messages yet
                      </span>
                    )}
                    {unread > 0 ? (
                      <span className="mt-0.5 inline-flex w-fit rounded-full bg-rose-500 px-2 py-0.5 text-[0.65rem] font-semibold text-white">
                        {unread} new
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50/80 dark:bg-zinc-950/40">
        {selected ? (
          <>
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {selected.parentName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {selected.className}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleManualRefresh()}
                disabled={pollRefreshing || loadingThread || sending}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                title="Check for new messages"
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5",
                    pollRefreshing && "animate-spin"
                  )}
                  aria-hidden
                />
                Refresh
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {loadingThread ? (
                <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
                  Loading…
                </p>
              ) : (
                <ChatThreadBody
                  key={conversationId ?? "none"}
                  lines={mergedMessages}
                  currentUserId={teacherId}
                />
              )}
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              {sendError ? (
                <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">
                  {sendError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  rows={2}
                  className="min-h-[2.75rem] flex-1 resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  disabled={!conversationId || loadingThread || sending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!sending) void send();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={
                    !conversationId ||
                    loadingThread ||
                    sending ||
                    !draft.trim()
                  }
                  aria-busy={sending}
                  className="inline-flex shrink-0 items-center justify-center gap-2 self-end rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <Loader2
                        className="h-4 w-4 shrink-0 animate-spin"
                        aria-hidden
                      />
                      Sending…
                    </>
                  ) : (
                    "Send"
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="flex flex-1 items-center justify-center px-4 py-12 text-sm text-slate-500 dark:text-zinc-400">
            Select a parent to start messaging.
          </p>
        )}
      </section>
    </div>
  );
}
