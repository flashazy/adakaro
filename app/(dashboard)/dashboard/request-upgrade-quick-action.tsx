"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  normalizePlanId,
  planDisplayName,
  type PlanId,
} from "@/lib/plans";

const PLANS: PlanId[] = ["free", "basic", "pro", "enterprise"];

function planRank(p: PlanId): number {
  return PLANS.indexOf(p);
}

const plansIcon = (
  <svg
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </svg>
);

interface RequestUpgradeQuickActionProps {
  schoolId: string | null | undefined;
  currentPlan: string;
}

function parsePlanFromDashboardRpc(
  raw: unknown,
  expectedSchoolId: string
): string | null {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "null") return null;
    try {
      value = JSON.parse(t) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const o = value as Record<string, unknown>;
  const sid =
    typeof o.school_id === "string"
      ? o.school_id
      : o.school_id != null
        ? String(o.school_id)
        : "";
  if (!sid || sid !== expectedSchoolId) return null;
  const p = o.plan;
  if (typeof p !== "string" || !p.trim()) return null;
  return p.trim();
}

export function RequestUpgradeQuickAction({
  schoolId,
  currentPlan,
}: RequestUpgradeQuickActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<PlanId>("basic");
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [livePlanRaw, setLivePlanRaw] = useState<string | null>(null);

  const effectiveSchoolId = typeof schoolId === "string" ? schoolId.trim() : "";

  useEffect(() => {
    if (!effectiveSchoolId) {
      setLivePlanRaw(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_my_school_for_dashboard");
      if (cancelled || error) return;
      const parsed = parsePlanFromDashboardRpc(data, effectiveSchoolId);
      if (!cancelled && parsed) {
        setLivePlanRaw(parsed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveSchoolId]);

  const current = normalizePlanId(livePlanRaw ?? currentPlan);
  const atMax = current === "enterprise";
  const higherPlans = PLANS.filter((p) => planRank(p) > planRank(current));

  return (
    <>
      <button
        type="button"
        disabled={atMax}
        onClick={() => {
          setMsg(null);
          setSuccess(false);
          setTarget(higherPlans[0] ?? "basic");
          setOpen(true);
        }}
        className="group flex w-full items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100 group-disabled:opacity-50 dark:bg-indigo-950/30 dark:text-indigo-400 dark:group-hover:bg-indigo-950/50">
          {plansIcon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
            Request upgrade
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            {atMax
              ? "You are on the highest plan."
              : "Ask a platform admin to approve a higher plan."}
          </p>
        </div>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 dark:bg-black/60"
            aria-label="Close"
            onClick={() => {
              setOpen(false);
              setSuccess(false);
            }}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Request plan upgrade
            </h2>
            {!effectiveSchoolId ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                No school is linked to your account. Finish school setup from the dashboard, then try again.
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                Current plan:{" "}
                <span className="font-medium text-slate-900 dark:text-white">
                  {planDisplayName(current)}
                </span>
                . Super admins will review your request.
              </p>
            )}
            <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-zinc-300">
              Desired plan
            </label>
            <select
              value={target}
              onChange={(e) => setTarget(normalizePlanId(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            >
              {higherPlans.map((p) => (
                <option key={p} value={p}>
                  {planDisplayName(p)}
                </option>
              ))}
            </select>
            {success ? (
              <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Request submitted. A platform admin will review it shortly.
              </p>
            ) : msg ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {msg}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSuccess(false);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || success || !effectiveSchoolId}
                onClick={async () => {
                  if (!effectiveSchoolId) {
                    setMsg(
                      "No school ID found. Refresh the page or complete school setup."
                    );
                    return;
                  }
                  setPending(true);
                  setMsg(null);
                  setSuccess(false);
                  try {
                    const res = await fetch("/api/schools/upgrade-request", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "same-origin",
                      body: JSON.stringify({
                        schoolId: effectiveSchoolId,
                        requestedPlan: target,
                        currentPlan: current,
                      }),
                    });
                    const body = (await res.json().catch(() => ({}))) as {
                      error?: string;
                    };
                    if (!res.ok) {
                      setMsg(body.error || "Request failed.");
                      return;
                    }
                    setSuccess(true);
                    window.setTimeout(() => {
                      setOpen(false);
                      setSuccess(false);
                      router.refresh();
                    }, 1800);
                  } finally {
                    setPending(false);
                  }
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
