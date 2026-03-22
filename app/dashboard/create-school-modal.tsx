"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, useState } from "react";
import { SchoolCurrencySelect } from "@/components/SchoolCurrencySelect";

interface CreateSchoolModalProps {
  /** When false, modal cannot open (user already has a school). */
  enabled: boolean;
}

export function CreateSchoolModal({ enabled }: CreateSchoolModalProps) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    if (!pending) {
      setOpen(false);
      setError(null);
    }
  }, [pending]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!enabled || pending) return;

    const form = e.currentTarget;
    const fd = new FormData(form);
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/schools/create", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });

      const raw = await res.text();
      let body: {
        error?: string;
        school_id?: string;
        ok?: boolean;
        code?: string;
        details?: string;
        hint?: string;
      } = {};

      if (raw) {
        try {
          body = JSON.parse(raw) as typeof body;
        } catch {
          const preview = raw.slice(0, 280);
          const msg = `Invalid response (${res.status}). ${preview}`;
          setError(msg);
          window.alert(msg);
          return;
        }
      }

      if (!res.ok) {
        const parts = [
          body.error,
          body.details,
          body.hint,
          body.code ? `code: ${body.code}` : "",
        ].filter(Boolean);
        const msg =
          parts.join("\n") || `Request failed with status ${res.status}`;
        setError(msg);
        window.alert(msg);
        return;
      }

      if (!body.school_id && !body.ok) {
        const msg = "Unexpected success response (missing school_id).";
        setError(msg);
        window.alert(msg);
        return;
      }

      form.reset();
      setOpen(false);
      setError(null);
      router.refresh();
      // Hard navigation avoids stale RSC payload if refresh alone doesn’t refetch membership.
      window.location.assign("/dashboard");
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Network error — could not reach the server.";
      setError(msg);
      window.alert(msg);
    } finally {
      setPending(false);
    }
  }

  if (!enabled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-start gap-4 rounded-xl border-2 border-indigo-400 bg-indigo-50/80 p-5 text-left shadow-sm transition-all hover:border-indigo-500 hover:bg-indigo-50 hover:shadow-md dark:border-indigo-600 dark:bg-indigo-950/40 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/60"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white dark:bg-indigo-500">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-indigo-900 group-hover:text-indigo-800 dark:text-indigo-100 dark:group-hover:text-white">
            Create School
          </p>
          <p className="mt-0.5 text-xs text-indigo-800/80 dark:text-indigo-200/80">
            Set up your organisation to unlock classes, students, and fees.
          </p>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${formId}-title`}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2
                id={`${formId}-title`}
                className="text-lg font-semibold text-slate-900 dark:text-white"
              >
                Create your school
              </h2>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor={`${formId}-name`}
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  School name <span className="text-red-500">*</span>
                </label>
                <input
                  id={`${formId}-name`}
                  name="name"
                  type="text"
                  required
                  disabled={pending}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                  placeholder="e.g. Greenfield Academy"
                />
              </div>

              <div>
                <label
                  htmlFor={`${formId}-address`}
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Address
                </label>
                <input
                  id={`${formId}-address`}
                  name="address"
                  type="text"
                  disabled={pending}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                  placeholder="123 School Road"
                />
              </div>

              <div>
                <label
                  htmlFor={`${formId}-currency`}
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  School currency <span className="text-red-500">*</span>
                </label>
                <SchoolCurrencySelect
                  id={`${formId}-currency`}
                  required
                  disabled={pending}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`${formId}-phone`}
                    className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                  >
                    Phone
                  </label>
                  <input
                    id={`${formId}-phone`}
                    name="phone"
                    type="tel"
                    disabled={pending}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                    placeholder="+254 700 000 000"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${formId}-email`}
                    className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                  >
                    Email
                  </label>
                  <input
                    id={`${formId}-email`}
                    name="email"
                    type="email"
                    disabled={pending}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                    placeholder="info@school.com"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${formId}-logo`}
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Logo{" "}
                  <span className="font-normal text-slate-400 dark:text-zinc-500">
                    (optional, max 2 MB)
                  </span>
                </label>
                <input
                  id={`${formId}-logo`}
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  disabled={pending}
                  className="mt-1.5 block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-60 dark:text-zinc-400 dark:file:bg-indigo-950/50 dark:file:text-indigo-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Creating…" : "Create school"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
