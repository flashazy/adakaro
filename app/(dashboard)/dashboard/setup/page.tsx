"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { SchoolCurrencySelect } from "@/components/SchoolCurrencySelect";
import { createSchool, type SetupState } from "./actions";

const PREFIX_RE = /^[A-Z]{3,4}$/;

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <svg
          className="h-5 w-5 animate-spin text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        "Create school"
      )}
    </button>
  );
}

const initialState: SetupState = {};

export default function SchoolSetupPage() {
  const [state, formAction] = useActionState(createSchool, initialState);
  const [schoolName, setSchoolName] = useState("");
  const [admissionPrefix, setAdmissionPrefix] = useState("");
  const [prefixManual, setPrefixManual] = useState(false);
  const [prefixCheckLoading, setPrefixCheckLoading] = useState(false);
  const [prefixAvailable, setPrefixAvailable] = useState(true);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const suggestAbort = useRef<AbortController | null>(null);
  const checkAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const name = schoolName.trim();
    if (name.length < 2 || prefixManual) {
      return;
    }
    const t = window.setTimeout(() => {
      suggestAbort.current?.abort();
      const ac = new AbortController();
      suggestAbort.current = ac;
      void (async () => {
        try {
          const res = await fetch(
            `/api/schools/set-prefix?mode=suggest&name=${encodeURIComponent(name)}`,
            { signal: ac.signal }
          );
          const data = (await res.json()) as {
            suggested?: string;
            error?: string;
          };
          if (!res.ok) {
            return;
          }
          if (data.suggested) {
            setAdmissionPrefix(data.suggested);
          }
        } catch {
          /* aborted or network */
        }
      })();
    }, 450);
    return () => window.clearTimeout(t);
  }, [schoolName, prefixManual]);

  useEffect(() => {
    const p = admissionPrefix.trim().toUpperCase();
    if (p === "") {
      setPrefixAvailable(true);
      setAlternatives([]);
      setPrefixCheckLoading(false);
      return;
    }
    if (!PREFIX_RE.test(p)) {
      setPrefixAvailable(false);
      setAlternatives([]);
      setPrefixCheckLoading(false);
      return;
    }
    const t = window.setTimeout(() => {
      checkAbort.current?.abort();
      const ac = new AbortController();
      checkAbort.current = ac;
      setPrefixCheckLoading(true);
      void (async () => {
        try {
          const res = await fetch(
            `/api/schools/set-prefix?mode=check&prefix=${encodeURIComponent(p)}`,
            { signal: ac.signal }
          );
          const data = (await res.json()) as {
            available?: boolean;
            alternatives?: string[];
          };
          if (!res.ok) {
            setPrefixAvailable(false);
            setAlternatives([]);
            return;
          }
          setPrefixAvailable(Boolean(data.available));
          setAlternatives(data.alternatives ?? []);
        } catch {
          setPrefixAvailable(false);
          setAlternatives([]);
        } finally {
          setPrefixCheckLoading(false);
        }
      })();
    }, 350);
    return () => window.clearTimeout(t);
  }, [admissionPrefix]);

  const prefixOk =
    admissionPrefix.trim() === "" ||
    (PREFIX_RE.test(admissionPrefix.trim().toUpperCase()) && prefixAvailable);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12 dark:from-zinc-950 dark:to-zinc-900">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Set up your school
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            Tell us about your school to get started. You can update these
            details later.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <form action={formAction} className="space-y-5">
            {state.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
                {state.error}
              </div>
            )}

            <input
              type="hidden"
              name="admission_prefix"
              value={admissionPrefix.trim().toUpperCase()}
              readOnly
            />

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                School name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={schoolName}
                onChange={(e) => {
                  setSchoolName(e.target.value);
                }}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                placeholder="e.g. Greenfield Academy"
              />
            </div>

            <div>
              <label
                htmlFor="admission_prefix_visible"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                School admission prefix (3–4 letters)
              </label>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                Used for student admission numbers: PREFIX-001. Leave blank to
                auto-generate from the school name.
              </p>
              <input
                id="admission_prefix_visible"
                type="text"
                maxLength={4}
                autoComplete="off"
                value={admissionPrefix}
                onChange={(e) => {
                  setPrefixManual(true);
                  setAdmissionPrefix(e.target.value.toUpperCase());
                }}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 uppercase shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                placeholder="e.g. MTZ"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                {admissionPrefix.trim() === "" ? (
                  <span className="text-slate-500 dark:text-zinc-400">
                    Auto-generate from name on create
                  </span>
                ) : prefixCheckLoading ? (
                  <span className="text-slate-500 dark:text-zinc-400">
                    Checking…
                  </span>
                ) : !PREFIX_RE.test(admissionPrefix.trim()) ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    Use 3–4 letters A–Z only
                  </span>
                ) : prefixAvailable ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Available
                  </span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">
                    Already taken
                  </span>
                )}
              </div>
              {!prefixAvailable && alternatives.length > 0 ? (
                <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">
                  Try:{" "}
                  {alternatives.map((a, i) => (
                    <button
                      key={a}
                      type="button"
                      className="mr-2 font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
                      onClick={() => {
                        setAdmissionPrefix(a);
                        setPrefixManual(true);
                      }}
                    >
                      {a}
                      {i < alternatives.length - 1 ? "," : ""}
                    </button>
                  ))}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="address"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Address
              </label>
              <input
                id="address"
                name="address"
                type="text"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                placeholder="123 School Road, Nairobi"
              />
            </div>

            <div>
              <label
                htmlFor="currency"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                School currency <span className="text-red-500">*</span>
              </label>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                All fees and balances will display in this currency.
              </p>
              <SchoolCurrencySelect id="currency" required />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                  placeholder="+254 700 000 000"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                  placeholder="info@school.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="logo"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                School logo{" "}
                <span className="font-normal text-slate-400 dark:text-zinc-500">
                  (optional, max 2 MB)
                </span>
              </label>
              <input
                id="logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="mt-1.5 block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:text-zinc-400 dark:file:bg-indigo-950/50 dark:file:text-indigo-400"
              />
            </div>

            <SubmitButton disabled={!prefixOk} />
          </form>
        </div>
      </div>
    </div>
  );
}
