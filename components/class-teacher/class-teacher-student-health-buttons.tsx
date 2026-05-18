"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateStudentAttendanceStatusAction } from "@/app/(dashboard)/teacher-dashboard/class-teacher/actions";
import {
  ILL_STATUS_DISPLAY,
  ILL_STATUS_DISPLAY_LOWER,
  type StudentHealthAttendanceStatus,
} from "@/lib/student-attendance-status";

type HealthAction = "ill" | "permitted" | "clear";

const SUCCESS_TOAST_MS = 3000;
const CHECKMARK_MS = 1500;

function HealthActionButton(props: {
  label: string;
  title: string;
  active?: boolean;
  isPending: boolean;
  showSuccess: boolean;
  disabled: boolean;
  onClick: () => void;
  className: string;
  activeClassName: string;
}) {
  const {
    label,
    title,
    isPending,
    showSuccess,
    disabled,
    onClick,
    className,
    activeClassName,
    active,
  } = props;

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      aria-busy={isPending}
      className={cn(
        "inline-flex min-w-[4.5rem] items-center justify-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active ? activeClassName : className
      )}
    >
      {isPending ? (
        <>
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
          <span>Updating…</span>
        </>
      ) : showSuccess ? (
        <>
          <Check className="h-3 w-3 shrink-0" aria-hidden />
          <span>{label}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}

export function ClassTeacherStudentHealthButtons(props: {
  studentId: string;
  healthStatus: StudentHealthAttendanceStatus | null;
}) {
  const { studentId, healthStatus } = props;
  const [status, setStatus] = useState<StudentHealthAttendanceStatus | null>(
    healthStatus
  );
  const [pendingAction, setPendingAction] = useState<HealthAction | null>(null);
  const [successAction, setSuccessAction] = useState<HealthAction | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setStatus(healthStatus);
  }, [healthStatus]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const run = async (
    action: HealthAction,
    nextStatus: StudentHealthAttendanceStatus | null
  ) => {
    if (pendingAction) return;

    setPendingAction(action);
    setSuccessAction(null);

    const res = await updateStudentAttendanceStatusAction({
      studentId,
      status: nextStatus,
    });

    setPendingAction(null);

    if (!res.ok) {
      toast.error(res.error, { duration: SUCCESS_TOAST_MS });
      return;
    }

    setStatus(nextStatus);

    const message =
      action === "ill"
        ? `Student marked as ${ILL_STATUS_DISPLAY}`
        : action === "permitted"
          ? "Student marked as Permitted"
          : "Status cleared";

    toast.success(message, { duration: SUCCESS_TOAST_MS });

    setSuccessAction(action);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(
      () => setSuccessAction(null),
      CHECKMARK_MS
    );
  };

  const busy = pendingAction !== null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap items-center justify-center gap-1">
        <HealthActionButton
          label={ILL_STATUS_DISPLAY}
          title={`Mark as ${ILL_STATUS_DISPLAY_LOWER}`}
          active={status === "ill"}
          isPending={pendingAction === "ill"}
          showSuccess={successAction === "ill"}
          disabled={busy}
          onClick={() => run("ill", "ill")}
          className="border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-orange-900 dark:hover:bg-orange-950/30"
          activeClassName="border-orange-400 bg-orange-100 text-orange-900 shadow-sm dark:border-orange-700 dark:bg-orange-950/60 dark:text-orange-100"
        />
        <HealthActionButton
          label="Permitted"
          title="Mark as permitted absence"
          active={status === "permitted"}
          isPending={pendingAction === "permitted"}
          showSuccess={successAction === "permitted"}
          disabled={busy}
          onClick={() => run("permitted", "permitted")}
          className="border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-blue-900 dark:hover:bg-blue-950/30"
          activeClassName="border-blue-400 bg-blue-100 text-blue-900 shadow-sm dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-100"
        />
        {status ? (
          <HealthActionButton
            label="Clear status"
            title="Clear health / excused status"
            isPending={pendingAction === "clear"}
            showSuccess={successAction === "clear"}
            disabled={busy}
            onClick={() => run("clear", null)}
            className="border-slate-300 bg-transparent text-slate-600 hover:bg-slate-50 dark:border-zinc-500 dark:text-zinc-300 dark:hover:bg-zinc-800"
            activeClassName="border-slate-300 bg-transparent text-slate-600 dark:border-zinc-500 dark:text-zinc-300"
          />
        ) : null}
      </div>
    </div>
  );
}
