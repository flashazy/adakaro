"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SchoolCurrencySelect } from "@/components/SchoolCurrencySelect";
import { planDisplayName } from "@/lib/plans";

const PLANS = ["free", "basic", "pro", "enterprise"] as const;

const inputClass =
  "mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20";

const labelClass = "block text-sm font-medium text-slate-700 dark:text-zinc-300";

export function CreateSchoolForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const adminEmail = String(fd.get("adminEmail") ?? "").trim().toLowerCase();
    const currency = String(fd.get("currency") ?? "TZS").trim().toUpperCase();
    const plan = String(fd.get("plan") ?? "free").trim().toLowerCase();
    const address = String(fd.get("address") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const schoolEmail = String(fd.get("schoolEmail") ?? "").trim();

    try {
      const res = await fetch("/api/super-admin/schools/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name,
          adminEmail,
          currency,
          plan,
          ...(address ? { address } : {}),
          ...(phone ? { phone } : {}),
          ...(schoolEmail ? { email: schoolEmail } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        schoolId?: string;
      };
      if (!res.ok) {
        setError(body.error || "Could not create school.");
        return;
      }
      if (body.schoolId) {
        router.push(`/super-admin/schools/${body.schoolId}`);
        router.refresh();
        return;
      }
      setError("School created but no id returned. Check the dashboard.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
    >
      <div className="space-y-6">
        <div>
          <label htmlFor="create-school-name" className={labelClass}>
            School name <span className="text-red-500">*</span>
          </label>
          <input
            id="create-school-name"
            name="name"
            type="text"
            required
            className={inputClass}
            placeholder="e.g. Sunrise Academy"
            disabled={pending}
          />
        </div>

        <div>
          <label htmlFor="create-school-admin-email" className={labelClass}>
            Founding admin email <span className="text-red-500">*</span>
          </label>
          <input
            id="create-school-admin-email"
            name="adminEmail"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
            placeholder="admin@example.com"
            disabled={pending}
          />
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
            User must sign up first so a profile exists for this email.
          </p>
        </div>

        <div>
          <label htmlFor="create-school-plan" className={labelClass}>
            Plan
          </label>
          <select
            id="create-school-plan"
            name="plan"
            className={inputClass}
            disabled={pending}
            defaultValue="free"
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {planDisplayName(p)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="create-school-currency" className={labelClass}>
            Currency
          </label>
          <SchoolCurrencySelect
            id="create-school-currency"
            name="currency"
            defaultValue="TZS"
            required
            disabled={pending}
            className={inputClass}
          />
        </div>

        <div className="border-t border-slate-200 pt-6 dark:border-zinc-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Optional contact
          </p>
          <div className="mt-4 space-y-5">
            <div>
              <label htmlFor="create-school-address" className={labelClass}>
                Address
              </label>
              <input
                id="create-school-address"
                name="address"
                type="text"
                className={inputClass}
                disabled={pending}
              />
            </div>
            <div>
              <label htmlFor="create-school-phone" className={labelClass}>
                Phone
              </label>
              <input
                id="create-school-phone"
                name="phone"
                type="tel"
                className={inputClass}
                disabled={pending}
              />
            </div>
            <div>
              <label htmlFor="create-school-email" className={labelClass}>
                School email
              </label>
              <input
                id="create-school-email"
                name="schoolEmail"
                type="email"
                autoComplete="off"
                className={inputClass}
                disabled={pending}
              />
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-center dark:border-zinc-800">
        <Link
          href="/super-admin"
          className="inline-flex justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create school"}
        </button>
      </div>
    </form>
  );
}
