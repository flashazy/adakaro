"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { broadcastClassTeacherMessageToLinkedParentsAction } from "@/lib/chat/chat-server-actions";
import { classTeacherQuickActionButtonClass } from "@/components/class-teacher/class-teacher-dashboard-nav-buttons";

const NO_LINKED_COPY =
  "No linked parents in this class. Parents must be linked to students before receiving messages.";

export function ClassTeacherMessageAllParentsButton(props: {
  classId: string;
  linkedParentCount: number;
}) {
  const { classId, linkedParentCount } = props;
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setRendered(false), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  const resetForm = useCallback(() => {
    setSubject("");
    setBody("");
    setSendError(null);
    setSuccessCount(null);
  }, []);

  const handleClose = useCallback(() => {
    if (sending) return;
    setOpen(false);
    resetForm();
  }, [sending, resetForm]);

  useEffect(() => {
    if (!open || !rendered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rendered, sending, handleClose]);

  const handleOpen = () => {
    resetForm();
    setOpen(true);
  };

  const handleSend = async () => {
    if (linkedParentCount === 0) return;
    setSendError(null);
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setSendError("Please enter a message.");
      return;
    }
    setSending(true);
    try {
      const r = await broadcastClassTeacherMessageToLinkedParentsAction(
        classId,
        subject,
        body
      );
      if (!r.ok) {
        setSendError(r.error);
        toast.error(r.error);
        return;
      }
      setSuccessCount(r.sentCount);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={sending}
        aria-busy={sending}
        className={classTeacherQuickActionButtonClass}
      >
        {sending ? (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-white"
            aria-hidden
          />
        ) : (
          <span className="text-base leading-none" aria-hidden>
            📧
          </span>
        )}
        <span className="whitespace-nowrap md:min-w-0 md:truncate">
          Message all parents
        </span>
      </button>

      {rendered ? (
        <div
          className="fixed inset-0 z-[210] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out dark:bg-black/70 ${
              visible ? "opacity-100" : "opacity-0"
            }`}
            aria-label="Close"
            onClick={sending ? undefined : handleClose}
            disabled={sending}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="broadcast-parents-title"
            className={`relative mx-4 mb-0 w-full max-w-lg rounded-t-2xl border border-slate-200 bg-white shadow-xl transition-all duration-200 ease-out dark:border-zinc-700 dark:bg-zinc-900 sm:mb-0 sm:rounded-2xl ${
              visible
                ? "translate-y-0 scale-100 opacity-100"
                : "translate-y-2 scale-[0.98] opacity-0 sm:translate-y-0"
            }`}
          >
            <div className="relative border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <button
                type="button"
                onClick={sending ? undefined : handleClose}
                disabled={sending}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
              <h2
                id="broadcast-parents-title"
                className="pr-10 text-base font-semibold text-slate-900 dark:text-white"
              >
                Message all parents
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                This class · only parents linked to students here will receive
                this message.
              </p>
            </div>

            <div className="px-4 py-4 sm:px-5">
              {linkedParentCount === 0 ? (
                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                  {NO_LINKED_COPY}
                </p>
              ) : successCount != null ? (
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Message sent to {successCount}{" "}
                  {successCount === 1 ? "parent" : "parents"}
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="broadcast-subject"
                      className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400"
                    >
                      Subject
                    </label>
                    <input
                      id="broadcast-subject"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={sending}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-school-primary focus:border-school-primary focus:ring-2 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                      placeholder="e.g. Upcoming meeting"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="broadcast-body"
                      className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400"
                    >
                      Message
                    </label>
                    <textarea
                      id="broadcast-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      disabled={sending}
                      rows={6}
                      className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-school-primary focus:border-school-primary focus:ring-2 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                      placeholder="Write your message…"
                    />
                  </div>
                  {sendError ? (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {sendError}
                    </p>
                  ) : null}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                {linkedParentCount === 0 ? (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 dark:bg-school-primary sm:w-auto"
                  >
                    Close
                  </button>
                ) : successCount != null ? (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 dark:bg-school-primary sm:w-auto"
                  >
                    Done
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={sending}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:w-auto"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={sending}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60 dark:bg-school-primary sm:w-auto"
                    >
                      {sending ? (
                        <>
                          <Loader2
                            className="mr-2 h-4 w-4 shrink-0 animate-spin"
                            aria-hidden
                          />
                          Sending…
                        </>
                      ) : (
                        "Send to all linked parents"
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
