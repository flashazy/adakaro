"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  newDutyBookEvent,
  normalizeEventTime,
} from "@/lib/duty-book/duty-book-report-events";
import {
  DUTY_BOOK_EVENT_TYPE_LABELS,
  DUTY_BOOK_EVENT_TYPES,
  type DutyBookEvent,
  type DutyBookReportPayload,
  type DutyBookReportPermissions,
} from "@/lib/duty-book/duty-book-report-types";
import { formatDateTimeStable } from "@/lib/school-timezone";
import {
  loadDutyBookReportAction,
  saveDutyBookReportAction,
  signDutyBookReportAction,
} from "./report-actions";

const fieldControlClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:[color-scheme:dark]";

const REMARKS_AUTOSAVE_MS = 2000;

function formatEventRecordedBy(event: DutyBookEvent): string {
  if (event.recordedByName?.trim()) return event.recordedByName.trim();
  if (event.recordedById) return "Unknown";
  return "Unknown";
}

export function DutyBookReportSection(props: {
  reportDate: string;
  initial: DutyBookReportPayload;
  initialPermissions: DutyBookReportPermissions;
  disabled?: boolean;
}) {
  const { reportDate, disabled } = props;
  const [payload, setPayload] = useState(props.initial);
  const [permissions, setPermissions] = useState(props.initialPermissions);
  const [events, setEvents] = useState<DutyBookEvent[]>(
    props.initial.report?.events ?? []
  );
  const [remarks, setRemarks] = useState(props.initial.report?.remarks ?? "");
  const [headTeacherComment, setHeadTeacherComment] = useState(
    props.initial.report?.headTeacherComment ?? ""
  );
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DutyBookEvent | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSavingRemarks, setIsSavingRemarks] = useState(false);

  const dirtyRef = useRef(false);
  const remarksRef = useRef(remarks);
  const eventsRef = useRef(events);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  remarksRef.current = remarks;
  eventsRef.current = events;

  const signed = !!payload.report?.signedAt;
  const readOnly = signed || !permissions.canEdit || !!disabled;
  const canEditHeadTeacherComment =
    permissions.canSign && !signed && !disabled;
  const headTeacherCommentReadOnly = signed || !canEditHeadTeacherComment;

  const applyServerState = useCallback(
    (res: {
      data: DutyBookReportPayload;
      permissions: DutyBookReportPermissions;
    }) => {
      setPayload(res.data);
      setPermissions(res.permissions);
      setEvents(res.data.report?.events ?? []);
      setRemarks(res.data.report?.remarks ?? "");
      setHeadTeacherComment(res.data.report?.headTeacherComment ?? "");
      setEditingEventId(null);
      setDraft(null);
      dirtyRef.current = false;
    },
    []
  );

  const persistReport = useCallback(
    async (opts?: { silent?: boolean }) => {
      const res = await saveDutyBookReportAction({
        reportDate,
        events: eventsRef.current,
        remarks: remarksRef.current,
      });
      if (!res.ok) {
        setError(res.error);
        return false;
      }
      applyServerState(res);
      if (!opts?.silent) {
        setMessage("Report saved.");
      }
      setError(null);
      return true;
    },
    [reportDate, applyServerState]
  );

  // Load report for the selected date; skip overwriting while the user is editing.
  useEffect(() => {
    dirtyRef.current = false;
    setError(null);
    setMessage(null);

    let cancelled = false;
    startTransition(async () => {
      const res = await loadDutyBookReportAction(reportDate);
      if (cancelled || !res.ok) {
        if (!cancelled && !res.ok) setError(res.error);
        return;
      }
      if (!dirtyRef.current) {
        applyServerState(res);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [reportDate, applyServerState]);

  // Sync server-provided initial data when parent revalidates (same date).
  useEffect(() => {
    if (dirtyRef.current) return;
    if (props.initial.report?.reportDate !== reportDate) return;
    setPayload(props.initial);
    setEvents(props.initial.report?.events ?? []);
    setRemarks(props.initial.report?.remarks ?? "");
    setHeadTeacherComment(props.initial.report?.headTeacherComment ?? "");
  }, [props.initial, reportDate]);

  // Debounced auto-save for remarks (and keeps events in sync).
  useEffect(() => {
    if (readOnly || !dirtyRef.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      setIsSavingRemarks(true);
      void persistReport({ silent: true }).finally(() => {
        setIsSavingRemarks(false);
        setMessage("Report saved.");
      });
    }, REMARKS_AUTOSAVE_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [remarks, readOnly, persistReport]);

  const saveReport = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      await persistReport();
    });
  };

  const signReport = () => {
    if (
      !window.confirm(
        "Sign this duty book report? It will be locked and cannot be edited afterward."
      )
    ) {
      return;
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      await persistReport({ silent: true });
      const res = await signDutyBookReportAction({
        reportDate,
        headTeacherComment,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Report signed.");
      const reload = await loadDutyBookReportAction(reportDate);
      if (reload.ok) applyServerState(reload);
    });
  };

  const startAddEvent = () => {
    const ev = newDutyBookEvent();
    setDraft(ev);
    setEditingEventId(ev.id);
  };

  const startEditEvent = (ev: DutyBookEvent) => {
    setDraft({ ...ev });
    setEditingEventId(ev.id);
  };

  const cancelDraft = () => {
    setDraft(null);
    setEditingEventId(null);
  };

  const commitDraft = () => {
    if (!draft) return;
    if (!draft.description.trim()) {
      setError("Event description is required.");
      return;
    }
    const normalized: DutyBookEvent = {
      ...draft,
      time: normalizeEventTime(draft.time),
    };
    setError(null);
    const exists = events.some((e) => e.id === normalized.id);
    const next = exists
      ? events.map((e) => (e.id === normalized.id ? normalized : e))
      : [...events, normalized];
    next.sort((a, b) => a.time.localeCompare(b.time));
    setEvents(next);
    eventsRef.current = next;
    setDraft(null);
    setEditingEventId(null);
    dirtyRef.current = true;
    startTransition(async () => {
      await persistReport({ silent: true });
      setMessage("Report saved.");
    });
  };

  const removeEvent = (id: string) => {
    setEvents((prev) => {
      const next = prev.filter((e) => e.id !== id);
      eventsRef.current = next;
      return next;
    });
    dirtyRef.current = true;
    if (editingEventId === id) cancelDraft();
  };

  const handleRemarksChange = (value: string) => {
    dirtyRef.current = true;
    setRemarks(value);
  };

  const signerName =
    payload.signer?.fullName ||
    payload.report?.headTeacherSignature ||
    "Head teacher";

  return (
    <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Duty Book Report
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          Record daily events and remarks. The head teacher may add an optional
          comment before signing. Teacher remarks auto-save shortly after you stop
          typing.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-green-700 dark:text-green-400">{message}</p>
      ) : null}
      {isPending || isSavingRemarks ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          {isSavingRemarks ? "Saving…" : "Loading…"}
        </p>
      ) : null}

      {/* Events */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
            Events
          </h3>
          {!readOnly ? (
            <button
              type="button"
              disabled={isPending || !!draft}
              onClick={startAddEvent}
              className="inline-flex items-center gap-1.5 rounded-lg border border-school-primary/30 bg-school-primary/10 px-3 py-1.5 text-sm font-medium text-school-primary hover:bg-school-primary/15 disabled:opacity-50 dark:border-school-primary/40 dark:bg-school-primary/20"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add event
            </button>
          ) : null}
        </div>

        {draft ? (
          <EventEditor
            draft={draft}
            onChange={setDraft}
            onCancel={cancelDraft}
            onSave={commitDraft}
            isNew={!events.some((e) => e.id === draft.id)}
          />
        ) : null}

        {events.length === 0 && !draft ? (
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            No events recorded for this day.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-zinc-800 dark:border-zinc-700">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-start justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    {ev.time} · {DUTY_BOOK_EVENT_TYPE_LABELS[ev.type]} ·
                    {" Recorded by "}
                    {formatEventRecordedBy(ev)}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-900 dark:text-zinc-100">
                    {ev.description}
                  </p>
                </div>
                {!readOnly && editingEventId !== ev.id ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEditEvent(ev)}
                      className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      aria-label="Edit event"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEvent(ev.id)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      aria-label="Delete event"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Remarks */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
          Remarks
        </h3>
        <textarea
          value={remarks}
          onChange={(e) => handleRemarksChange(e.target.value)}
          disabled={readOnly || isPending}
          rows={4}
          placeholder="Teacher on duty: daily summary, follow-ups, etc."
          className={cn(
            fieldControlClass,
            "h-auto min-h-[6rem] resize-y py-2"
          )}
        />
        {remarks.trim() ? (
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Last updated by{" "}
            {payload.report?.remarksLastModifiedByName?.trim() ||
              (payload.report?.remarksLastModifiedById ? "Unknown" : "Unknown")}
          </p>
        ) : null}
      </div>

      {/* Head teacher comment */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
          Head teacher&apos;s comment
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Optional official note from the head teacher. Saved when you sign the
          report.
        </p>
        <textarea
          value={headTeacherComment}
          onChange={(e) => setHeadTeacherComment(e.target.value)}
          disabled={headTeacherCommentReadOnly || isPending}
          rows={3}
          placeholder="Head teacher: approval notes, follow-ups for administration, etc."
          className={cn(
            fieldControlClass,
            "h-auto min-h-[5rem] resize-y py-2",
            headTeacherCommentReadOnly && "bg-slate-50 dark:bg-zinc-900/60"
          )}
        />
      </div>

      {/* Signature */}
      <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-zinc-700">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
          Head teacher signature
        </h3>
        {signed && payload.report?.signedAt ? (
          <p className="text-sm text-slate-700 dark:text-zinc-300">
            Signed by{" "}
            <span className="font-medium text-slate-900 dark:text-white">
              {signerName}
            </span>{" "}
            on {formatDateTimeStable(payload.report.signedAt)}
          </p>
        ) : (
          <p className="text-sm text-slate-500 dark:text-zinc-400">Not signed</p>
        )}
        {permissions.canSign && !signed ? (
          <button
            type="button"
            disabled={isPending}
            onClick={signReport}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Sign as Head Teacher
          </button>
        ) : null}
        {signed ? (
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            This report is locked after sign-off.
          </p>
        ) : null}
      </div>

      {/* Save report */}
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 dark:border-zinc-700">
          <button
            type="button"
            disabled={isPending || isSavingRemarks}
            onClick={saveReport}
            className="rounded-lg bg-school-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save report"}
          </button>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Saves events and remarks. Remarks also auto-save after you pause
            typing. The head teacher comment is saved when you sign.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function EventEditor(props: {
  draft: DutyBookEvent;
  onChange: (ev: DutyBookEvent) => void;
  onCancel: () => void;
  onSave: () => void;
  isNew: boolean;
}) {
  const { draft, onChange, onCancel, onSave, isNew } = props;
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-school-primary/40 bg-school-primary/5 p-4 dark:border-school-primary/30 dark:bg-school-primary/10">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
            Time
          </span>
          <input
            type="time"
            value={draft.time}
            onChange={(e) =>
              onChange({ ...draft, time: normalizeEventTime(e.target.value) })
            }
            className={fieldControlClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
            Type
          </span>
          <select
            value={draft.type}
            onChange={(e) =>
              onChange({
                ...draft,
                type: e.target.value as DutyBookEvent["type"],
              })
            }
            className={cn(fieldControlClass, "cursor-pointer")}
          >
            {DUTY_BOOK_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {DUTY_BOOK_EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
          Description
        </span>
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          rows={3}
          className={cn(fieldControlClass, "h-auto min-h-[4rem] resize-y py-2")}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          className="rounded-lg bg-school-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          {isNew ? "Add" : "Update"} event
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
