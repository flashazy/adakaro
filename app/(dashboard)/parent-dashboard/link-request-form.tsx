"use client";

import { useActionState, useEffect, useTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Loader2, Send } from "lucide-react";
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
      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-school-primary to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-105 disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2.5 dark:to-indigo-500"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          Sending…
        </>
      ) : (
        <>
          <Send className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
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

  useEffect(() => {
    if (state.toastError) {
      toast.error(state.toastError, { duration: 8000 });
    }
  }, [state.toastError]);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-slate-100 px-4 py-4 dark:border-zinc-800 sm:px-6 sm:py-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-school-primary shadow-inner ring-1 ring-indigo-100/80 dark:bg-indigo-950/40 dark:ring-indigo-900/50">
            <Link2 className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Link to a School
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
              Request access with your child&apos;s admission number. Your
              school admin will review it.
            </p>
          </div>
        </div>
      </div>

      <form action={formAction} className="px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="admission_number"
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Child&apos;s Admission Number
            </label>
            <input
              id="admission_number"
              name="admission_number"
              type="text"
              required
              placeholder="e.g. ADM-2024-001"
              className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-school-primary/25 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 sm:min-h-0 sm:py-2.5 sm:text-sm"
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
        <div className="border-t border-slate-100 dark:border-zinc-800">
          <div className="px-4 py-3 sm:px-6">
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
              className={`mx-4 mb-2 rounded-lg border px-3 py-2 text-xs sm:mx-6 ${
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
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
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
