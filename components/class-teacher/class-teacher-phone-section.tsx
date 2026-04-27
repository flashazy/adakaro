"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { updateClassTeacherOwnPhoneAction } from "@/lib/class-teacher-phone-actions";

export function ClassTeacherPhoneSection(props: {
  initialPhone: string | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(props.initialPhone);
  const [modalOpen, setModalOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPhone(props.initialPhone);
  }, [props.initialPhone]);

  useEffect(() => {
    if (modalOpen) {
      setRendered(true);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setRendered(false), 200);
    return () => window.clearTimeout(t);
  }, [modalOpen]);

  const openModal = () => {
    setDraft(phone ?? "");
    setError(null);
    setModalOpen(true);
  };

  const closeModal = useCallback(() => {
    if (saving) return;
    setModalOpen(false);
    setError(null);
  }, [saving]);

  useEffect(() => {
    if (!modalOpen || !rendered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        e.preventDefault();
        closeModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, rendered, saving, closeModal]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await updateClassTeacherOwnPhoneAction(draft);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPhone(r.phone);
      setModalOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const display =
    phone != null && phone.trim().length > 0 ? phone.trim() : "Not set yet";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
        Your phone number
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
        Parents in your class can use this to call you from their dashboard.
      </p>
      <p className="mt-3 text-base font-medium tabular-nums text-slate-900 dark:text-white">
        {display}
      </p>
      <button
        type="button"
        onClick={openModal}
        className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-school-primary shadow-sm transition hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      >
        Edit phone number
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
            onClick={saving ? undefined : closeModal}
            disabled={saving}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-phone-title"
            className={`relative mx-4 mb-0 w-full max-w-md rounded-t-2xl border border-slate-200 bg-white shadow-xl transition-all duration-200 ease-out dark:border-zinc-700 dark:bg-zinc-900 sm:mb-0 sm:rounded-2xl ${
              visible
                ? "translate-y-0 scale-100 opacity-100"
                : "translate-y-2 scale-[0.98] opacity-0 sm:translate-y-0"
            }`}
          >
            <div className="relative border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <button
                type="button"
                onClick={saving ? undefined : closeModal}
                disabled={saving}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
              <h2
                id="edit-phone-title"
                className="pr-10 text-base font-semibold text-slate-900 dark:text-white"
              >
                Edit phone number
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Leave blank and save to remove your number.
              </p>
            </div>
            <div className="px-4 py-4 sm:px-5">
              <label
                htmlFor="class-teacher-phone-input"
                className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400"
              >
                Phone number
              </label>
              <input
                id="class-teacher-phone-input"
                type="tel"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={saving}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-school-primary focus:border-school-primary focus:ring-2 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                placeholder="e.g. +255712345678"
                autoComplete="tel"
              />
              {error ? (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60 dark:bg-school-primary sm:w-auto"
                >
                  {saving ? (
                    <>
                      <Loader2
                        className="mr-2 h-4 w-4 shrink-0 animate-spin"
                        aria-hidden
                      />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
