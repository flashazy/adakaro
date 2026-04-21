"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PREFIX_RE = /^[A-Z]{3,4}$/;

interface Props {
  schoolId: string;
  /** Empty if the school has no prefix yet (should be rare after migration). */
  currentPrefix: string;
}

export function SchoolAdmissionPrefixForm({
  schoolId,
  currentPrefix,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(currentPrefix);
  const [busy, setBusy] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(currentPrefix);
  }, [currentPrefix]);

  useEffect(() => {
    const p = value.trim().toUpperCase();
    if (p === currentPrefix) {
      setAvailable(true);
      setAlternatives([]);
      setCheckLoading(false);
      return;
    }
    if (p === "") {
      setAvailable(false);
      setAlternatives([]);
      setCheckLoading(false);
      return;
    }
    if (!PREFIX_RE.test(p)) {
      setAvailable(false);
      setAlternatives([]);
      setCheckLoading(false);
      return;
    }
    const t = window.setTimeout(() => {
      setCheckLoading(true);
      void (async () => {
        try {
          const res = await fetch(
            `/api/schools/set-prefix?mode=check&prefix=${encodeURIComponent(
              p
            )}&excludeSchoolId=${encodeURIComponent(schoolId)}`
          );
          const data = (await res.json()) as {
            available?: boolean;
            alternatives?: string[];
          };
          if (res.ok) {
            setAvailable(Boolean(data.available));
            setAlternatives(data.alternatives ?? []);
          } else {
            setAvailable(false);
            setAlternatives([]);
          }
        } catch {
          setAvailable(false);
          setAlternatives([]);
        } finally {
          setCheckLoading(false);
        }
      })();
    }, 350);
    return () => window.clearTimeout(t);
  }, [value, currentPrefix]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const p = value.trim().toUpperCase();
    if (!PREFIX_RE.test(p)) {
      setError("Use 3–4 letters A–Z.");
      return;
    }
    if (p === currentPrefix) {
      setMessage("No changes to save.");
      return;
    }
    if (!available) {
      setError("That prefix is not available.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/schools/set-prefix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: p }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        alternatives?: string[];
        prefix?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not update prefix.");
        if (data.alternatives?.length) {
          setAlternatives(data.alternatives);
        }
        return;
      }
      setMessage("Prefix updated. New students will use this prefix.");
      router.refresh();
    } catch {
      setError("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  const canSave =
    PREFIX_RE.test(value.trim().toUpperCase()) &&
    available &&
    value.trim().toUpperCase() !== currentPrefix;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-zinc-400">
        Admission number format:{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800 dark:bg-zinc-800 dark:text-zinc-200">
          {currentPrefix ? `${currentPrefix}-001` : "PREFIX-001"}
        </code>
        . Changing the prefix only affects{" "}
        <strong className="text-slate-700 dark:text-zinc-300">
          future
        </strong>{" "}
        auto-generated numbers; existing students are unchanged.
      </p>
      <div>
        <label
          htmlFor="school_admission_prefix"
          className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
        >
          Admission prefix
        </label>
        <input
          id="school_admission_prefix"
          type="text"
          maxLength={4}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          className="mt-1.5 block w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />
        <div className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400">
          {checkLoading ? (
            "Checking…"
          ) : value.trim().toUpperCase() === currentPrefix ? (
            "Current prefix"
          ) : value.trim() === "" ? (
            "Prefix cannot be empty"
          ) : !PREFIX_RE.test(value.trim().toUpperCase()) ? (
            "3–4 letters A–Z"
          ) : available ? (
            <span className="text-emerald-700 dark:text-emerald-400">
              Available
            </span>
          ) : (
            <span className="text-red-600 dark:text-red-400">Taken</span>
          )}
        </div>
        {!available && alternatives.length > 0 ? (
          <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">
            Try:{" "}
            {alternatives.map((a) => (
              <button
                key={a}
                type="button"
                className="mr-2 font-medium text-school-primary hover:underline dark:text-school-primary"
                onClick={() => setValue(a)}
              >
                {a}
              </button>
            ))}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={busy || !canSave}
        className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save prefix"}
      </button>
      {message ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </form>
  );
}
