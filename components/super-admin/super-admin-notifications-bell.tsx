"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

interface SuperAdminNotificationItem {
  id: string;
  title: string;
  message: string;
  metadata: {
    demo_request_id?: string;
    school_name?: string;
    full_name?: string;
    student_count?: number | null;
  } | null;
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

export function SuperAdminNotificationsBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<SuperAdminNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/notifications", {
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        unreadCount?: number;
        notifications?: SuperAdminNotificationItem[];
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
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchNotifications();
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void fetchNotifications().finally(() => setLoading(false));
  }, [open, fetchNotifications]);

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
    const item = items.find((n) => n.id === id);
    if (!item || item.read_at) return;
    const res = await fetch("/api/super-admin/notifications", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "read" }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const markAllRead = async () => {
    const res = await fetch("/api/super-admin/notifications", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/80 text-slate-700",
          "transition-all duration-200 ease-out hover:bg-slate-100/80",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary",
          "dark:border-zinc-700/80 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
        )}
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : "Notifications"
        }
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-[70] mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Notifications
            </p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                Loading…
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
                {items.map((item) => {
                  const demoId = item.metadata?.demo_request_id;
                  const href = demoId
                    ? `/super-admin/demo-requests?lead=${demoId}`
                    : "/super-admin/demo-requests";
                  const unread = !item.read_at;
                  return (
                    <li key={item.id}>
                      <Link
                        href={href}
                        onClick={() => {
                          void markRead(item.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "block px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60",
                          unread && "bg-indigo-50/50 dark:bg-indigo-950/20"
                        )}
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          🔔 {item.title}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-zinc-300">
                          {item.message}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatNotificationDate(item.created_at)}
                        </p>
                      </Link>
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
