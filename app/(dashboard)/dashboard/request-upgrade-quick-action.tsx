"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  showAdminErrorToast,
  showAdminSuccessToast,
} from "@/components/dashboard/dashboard-feedback-provider";
import { createClient } from "@/lib/supabase/client";
import { isPaidPlanId } from "@/lib/plans";

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
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [livePlanRaw, setLivePlanRaw] = useState<string | null>(null);

  const effectiveSchoolId = typeof schoolId === "string" ? schoolId.trim() : "";

  // Re-fetch the authoritative plan once on mount so the card reflects any
  // server-side approval that happened while the user had this page open.
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

  const onPaid = isPaidPlanId(livePlanRaw ?? currentPlan);

  return (
    <>
      <button
        type="button"
        disabled={onPaid}
        onClick={() => {
          setMsg(null);
          setSuccess(false);
          setOpen(true);
        }}
        className="group flex w-full touch-manipulation items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-[rgb(var(--school-primary-rgb)/0.35)] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-[rgb(var(--school-primary-rgb)/0.45)]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--school-primary-rgb)/0.10)] text-school-primary transition-colors group-hover:bg-[rgb(var(--school-primary-rgb)/0.16)] group-disabled:opacity-50 dark:bg-[rgb(var(--school-primary-rgb)/0.14)] dark:text-school-primary dark:group-hover:bg-[rgb(var(--school-primary-rgb)/0.16)]">
          {plansIcon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 group-hover:text-school-primary dark:text-white dark:group-hover:text-school-primary">
            {onPaid ? "You are on the paid plan" : "Upgrade to Paid"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            {onPaid
              ? "Unlimited students and admins are unlocked."
              : "Free tier is capped at 20 students. Request an upgrade to go unlimited."}
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
              Upgrade to Paid
            </h2>
            {!effectiveSchoolId ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                No school is linked to your account. Finish school setup from the dashboard, then try again.
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                Submit a request and a platform admin will review it. Once
                approved, your school moves from <strong>Free</strong> to{" "}
                <strong>Paid</strong> with unlimited students and admins.
              </p>
            )}
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
                    const errText =
                      "No school ID found. Refresh the page or complete school setup.";
                    setMsg(errText);
                    showAdminErrorToast(errText);
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
                      // Backend still expects a specific tier > current. Any
                      // paid tier works under the new model; "basic" is the
                      // minimum that satisfies the rank check.
                      body: JSON.stringify({
                        schoolId: effectiveSchoolId,
                        requestedPlan: "basic",
                        currentPlan: "free",
                      }),
                    });
                    const body = (await res.json().catch(() => ({}))) as {
                      error?: string;
                    };
                    if (!res.ok) {
                      const errText = body.error || "Request failed.";
                      setMsg(errText);
                      showAdminErrorToast(errText);
                      return;
                    }
                    setSuccess(true);
                    showAdminSuccessToast(
                      "Request submitted. A platform admin will review it shortly."
                    );
                    window.setTimeout(() => {
                      setOpen(false);
                      setSuccess(false);
                      router.refresh();
                    }, 1800);
                  } catch (e) {
                    const errText =
                      e instanceof Error
                        ? e.message
                        : "Network error — could not reach the server.";
                    setMsg(errText);
                    showAdminErrorToast(errText);
                  } finally {
                    setPending(false);
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? (
                  <>
                    <Loader2
                      className="h-4 w-4 shrink-0 animate-spin"
                      aria-hidden
                    />
                    Loading…
                  </>
                ) : (
                  "Submit request"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
