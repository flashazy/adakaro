"use client";

import { useActionState, useTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  submitLinkRequest,
  cancelPendingLinkRequest,
  type LinkRequestState,
} from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-school-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-90 disabled:opacity-50"
    >
      {pending ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Sending…
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
          </svg>
          Send Request
        </>
      )}
    </button>
  );
}

interface PendingRequest {
  id: string;
  admission_number: string;
  status: string;
  created_at: string;
}

export default function LinkRequestForm({
  pendingRequests,
}: {
  pendingRequests: PendingRequest[];
}) {
  const router = useRouter();
  const [cancelPending, startCancel] = useTransition();
  const [cancelMessage, setCancelMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const [state, formAction] = useActionState<LinkRequestState, FormData>(
    submitLinkRequest,
    {}
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-school-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Link to a School
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          Enter your child&apos;s admission number to request access to their
          school records. The school admin will review your request.
        </p>
      </div>

      {/* Form */}
      <form action={formAction} className="px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="admission_number"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Child&apos;s Admission Number
            </label>
            <input
              id="admission_number"
              name="admission_number"
              type="text"
              required
              placeholder="e.g. ADM-2024-001"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>
          <SubmitButton />
        </div>

        {/* Feedback */}
        {state.error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800/50 dark:bg-red-950/30">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-400">
              {state.error}
            </p>
          </div>
        )}
        {state.success && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/50 dark:bg-emerald-950/30">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {state.success}
            </p>
          </div>
        )}
      </form>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div className="border-t border-slate-200 dark:border-zinc-800">
          <div className="px-6 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Pending Requests
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              Stuck? Cancel a request to send a new one. Your school admin must still approve
              new requests.
            </p>
          </div>
          {cancelMessage && (
            <div
              className={`mx-6 mb-2 rounded-lg border px-3 py-2 text-xs ${
                cancelMessage.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300"
              }`}
            >
              {cancelMessage.text}
            </div>
          )}
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/50">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/20">
                    <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {req.admission_number}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Submitted{" "}
                      {new Date(req.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    Pending
                  </span>
                  <button
                    type="button"
                    disabled={cancelPending}
                    onClick={() => {
                      setCancelMessage(null);
                      startCancel(async () => {
                        const out = await cancelPendingLinkRequest(req.id);
                        if (out.error) {
                          setCancelMessage({ type: "error", text: out.error });
                          return;
                        }
                        if (out.success) {
                          setCancelMessage({ type: "success", text: out.success });
                        }
                        router.refresh();
                      });
                    }}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {cancelPending ? "Cancelling…" : "Cancel request"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
