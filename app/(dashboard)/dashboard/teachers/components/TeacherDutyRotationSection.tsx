"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeacherDutyAssignment } from "@/lib/teacher-on-duty/types";
import type { TeacherActionState } from "../types";
import {
  revokeTeacherDutyAssignmentAction,
  revokeTeacherDutyAssignmentsBulkAction,
} from "../duty-rotation-actions";
import { AssignDutyRotationModal } from "./AssignDutyRotationModal";
import type { TeacherRow } from "../teachers-page-client";

const STATUS_STYLES: Record<
  TeacherDutyAssignment["status"],
  string
> = {
  active:
    "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800",
  upcoming:
    "bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-800",
  completed:
    "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700",
  revoked:
    "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ] as const;
  return `${d} ${months[m - 1]} ${y}`;
}

function flash(state: TeacherActionState | null) {
  if (!state) return null;
  if (state.ok && state.message) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
        {state.message}
      </p>
    );
  }
  if (!state.ok) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
        {state.error}
      </p>
    );
  }
  return null;
}

export function TeacherDutyRotationSection(props: {
  teachers: TeacherRow[];
  initialAssignments: TeacherDutyAssignment[];
  assignAction: (
    prev: TeacherActionState | null,
    formData: FormData
  ) => Promise<TeacherActionState>;
}) {
  const { teachers, initialAssignments, assignAction } = props;
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignments, setAssignments] =
    useState<TeacherDutyAssignment[]>(initialAssignments);
  const [selectedRevoke, setSelectedRevoke] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  const [assignState, assignFormAction, assignPending] = useActionState(
    assignAction,
    null as TeacherActionState | null
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeTeacherDutyAssignmentAction,
    null as TeacherActionState | null
  );
  const [bulkRevokeState, bulkRevokeAction, bulkRevokePending] = useActionState(
    revokeTeacherDutyAssignmentsBulkAction,
    null as TeacherActionState | null
  );

  useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments]);

  useEffect(() => {
    if (assignState?.ok) {
      setAssignOpen(false);
      router.refresh();
    }
  }, [assignState, router]);

  useEffect(() => {
    if (revokeState?.ok || bulkRevokeState?.ok) {
      router.refresh();
    }
  }, [revokeState, bulkRevokeState, router]);

  const sorted = useMemo(() => {
    const order = { active: 0, upcoming: 1, completed: 2, revoked: 3 };
    return [...assignments].sort((a, b) => {
      const s = order[a.status] - order[b.status];
      if (s !== 0) return s;
      return b.startDate.localeCompare(a.startDate);
    });
  }, [assignments]);

  const currentAndUpcoming = sorted.filter(
    (a) => a.status === "active" || a.status === "upcoming"
  );

  const detail = detailId
    ? assignments.find((a) => a.id === detailId) ?? null
    : null;

  const toggleRevokeSelect = (id: string) => {
    setSelectedRevoke((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <CalendarRange className="h-5 w-5 text-school-primary" aria-hidden />
            Duty rotation
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Assign teachers on duty for temporary duty book access. Does not
            change their permanent role.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAssignOpen(true)}
          className="shrink-0 rounded-lg bg-school-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Assign duty rotation
        </button>
      </div>

      {flash(revokeState) ?? flash(bulkRevokeState)}

      {currentAndUpcoming.length > 0 ? (
        <form action={bulkRevokeAction} className="mt-4 space-y-3">
          {selectedRevoke.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {Array.from(selectedRevoke).map((id) => (
                <input key={id} type="hidden" name="assignment_ids" value={id} />
              ))}
              <button
                type="submit"
                disabled={bulkRevokePending}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              >
                {bulkRevokePending
                  ? "Revoking…"
                  : `Revoke selected (${selectedRevoke.size})`}
              </button>
            </div>
          ) : null}

          <div className="space-y-2">
            {sorted.map((a) => (
              <article
                key={a.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-zinc-700 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {(a.status === "active" || a.status === "upcoming") &&
                    !a.revokedAt ? (
                      <input
                        type="checkbox"
                        checked={selectedRevoke.has(a.id)}
                        onChange={() => toggleRevokeSelect(a.id)}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label={`Select ${a.teacherName}`}
                      />
                    ) : null}
                    <p className="font-medium text-slate-900 dark:text-white">
                      {a.teacherName}
                    </p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset",
                        STATUS_STYLES[a.status]
                      )}
                    >
                      {a.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                    {formatDate(a.startDate)} – {formatDate(a.endDate)}
                    {a.remainingDays != null && a.status === "active"
                      ? ` · ${a.remainingDays} day${a.remainingDays === 1 ? "" : "s"} left`
                      : null}
                  </p>
                  {a.notes ? (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-zinc-500">
                      {a.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDetailId((id) => (id === a.id ? null : a.id))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {detailId === a.id ? "Hide" : "Details"}
                  </button>
                  {(a.status === "active" || a.status === "upcoming") &&
                  !a.revokedAt ? (
                    <button
                      type="button"
                      disabled={revokePending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("assignment_id", a.id);
                        revokeAction(fd);
                      }}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate-500 dark:text-zinc-400">
          No current or upcoming duty assignments.
        </p>
      )}

      {detail ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
          <p className="font-medium text-slate-900 dark:text-white">
            {detail.teacherName}
          </p>
          <p className="mt-1 text-slate-600 dark:text-zinc-400">
            {formatDate(detail.startDate)} – {formatDate(detail.endDate)}
          </p>
          {detail.notes ? (
            <p className="mt-2 text-slate-700 dark:text-zinc-300">{detail.notes}</p>
          ) : (
            <p className="mt-2 text-slate-500">No notes.</p>
          )}
        </div>
      ) : null}

      {assignOpen ? (
        <AssignDutyRotationModal
          teachers={teachers}
          onClose={() => setAssignOpen(false)}
          formAction={assignFormAction}
          pending={assignPending}
          flash={assignState}
        />
      ) : null}
    </section>
  );
}
