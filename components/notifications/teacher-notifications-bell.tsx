"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClassMovementNotificationMetadataClient } from "@/lib/notifications/in-app-notification-types";
import { ClassMovementNotificationBody } from "@/components/notifications/class-movement-notification-body";

const POLL_MS = 30_000;

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  helper_text: string | null;
  type: string;
  metadata: ClassMovementNotificationMetadataClient | null;
  read_at: string | null;
  created_at: string;
}

function formatNotificationDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TeacherNotificationsBell({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/teacher-notifications", {
        credentials: "include",
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        unreadCount?: number;
        notifications?: NotificationItem[];
      };
      if (typeof body.unreadCount === "number") {
        setUnreadCount(body.unreadCount);
      }
      if (Array.isArray(body.notifications)) {
        setItems(body.notifications);
      }
    } catch {
      /* ignore poll errors */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      setItems([]);
      return;
    }
    void fetchNotifications();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchNotifications();
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const markRead = async (id: string) => {
    await fetch("/api/teacher-notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      await fetch("/api/teacher-notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void fetchNotifications();
        }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-school-primary px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-[60] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Notifications
            </p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={loading}
                className="text-xs font-medium text-school-primary hover:opacity-90 disabled:opacity-50"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-zinc-400">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
                {items.map((n) => {
                  const unread = !n.read_at;
                  const isClassMovement =
                    n.type === "class_movement" && n.metadata?.moves?.length;

                  return (
                    <li key={n.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (unread) void markRead(n.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (unread) void markRead(n.id);
                          }
                        }}
                        className={cn(
                          "w-full cursor-default px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60",
                          unread && "bg-slate-50/80 dark:bg-zinc-800/40"
                        )}
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {n.title}
                        </p>
                        {isClassMovement ? (
                          <ClassMovementNotificationBody
                            title={n.title}
                            message={n.message}
                            metadata={n.metadata}
                            onStudentNavigate={() => {
                              if (unread) void markRead(n.id);
                              setOpen(false);
                            }}
                          />
                        ) : (
                          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                            {n.message}
                          </p>
                        )}
                        {n.helper_text ? (
                          <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                            {n.helper_text}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[11px] text-slate-400 dark:text-zinc-500">
                          {formatNotificationDate(n.created_at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
