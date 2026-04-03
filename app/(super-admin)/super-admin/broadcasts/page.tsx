"use client";

import { useState } from "react";
import Link from "next/link";
import { SendBroadcastForm } from "./components/SendBroadcastForm";
import { BroadcastList } from "./components/BroadcastList";

export default function SuperAdminBroadcastsPage() {
  const [listKey, setListKey] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [reminder, setReminder] = useState<{
    targetUserIds: string[];
    title: string;
    message: string;
  } | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Broadcast messages
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Send one message to every school admin dashboard.
            </p>
          </div>
          <Link
            href="/super-admin"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div id="new-broadcast-form">
          <SendBroadcastForm
            key={formKey}
            defaultTitle={reminder?.title ?? ""}
            defaultMessage={reminder?.message ?? ""}
            defaultUrgent={false}
            targetUserIds={reminder?.targetUserIds ?? null}
            onSent={() => {
              setListKey((k) => k + 1);
              setReminder(null);
            }}
          />
        </div>
        <BroadcastList
          refreshKey={listKey}
          onConfigureReminder={(payload) => {
            setReminder({
              targetUserIds: payload.targetUserIds,
              title: payload.title,
              message: payload.message,
            });
            setFormKey((k) => k + 1);
            requestAnimationFrame(() =>
              document.getElementById("new-broadcast-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            );
          }}
        />
      </main>
    </div>
  );
}
