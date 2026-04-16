"use client";

import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import type { Database } from "@/types/supabase";
import {
  upsertStudentAcademicRecord,
  upsertStudentDisciplineRecord,
  upsertStudentFinanceRecord,
  upsertStudentHealthRecord,
} from "./profile-actions";
import { StudentProfileAvatar } from "./student-profile-avatar";

type AcademicRow =
  Database["public"]["Tables"]["student_academic_records"]["Row"];
type DisciplineRow =
  Database["public"]["Tables"]["student_discipline_records"]["Row"];
type HealthRow = Database["public"]["Tables"]["student_health_records"]["Row"];
type FinanceRow =
  Database["public"]["Tables"]["student_finance_records"]["Row"];

type TabId = "academic" | "discipline" | "health" | "finance";

const tabLabels: { id: TabId; label: string }[] = [
  { id: "academic", label: "Academic" },
  { id: "discipline", label: "Discipline" },
  { id: "health", label: "Health" },
  { id: "finance", label: "Finance" },
];

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy · h:mm a");
  } catch {
    return iso;
  }
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

function incidentLabel(t: DisciplineRow["incident_type"]): string {
  const map: Record<DisciplineRow["incident_type"], string> = {
    warning: "Warning",
    detention: "Detention",
    suspension: "Suspension",
    expulsion: "Expulsion",
    other: "Other",
  };
  return map[t] ?? t;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white";
const labelClass = "block text-sm font-medium text-slate-700 dark:text-zinc-300";

interface StudentProfileClientProps {
  studentId: string;
  studentName: string;
  className: string | null;
  avatarUrl: string | null;
  academicRecords: AcademicRow[];
  disciplineRecords: DisciplineRow[];
  healthRecords: HealthRow[];
  financeRecords: FinanceRow[];
}

export function StudentProfileClient({
  studentId,
  studentName,
  className,
  avatarUrl,
  academicRecords,
  disciplineRecords,
  healthRecords,
  financeRecords,
}: StudentProfileClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("academic");
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const [academicModal, setAcademicModal] = useState<AcademicRow | "new" | null>(
    null
  );
  const [disciplineModal, setDisciplineModal] = useState<
    DisciplineRow | "new" | null
  >(null);
  const [healthModal, setHealthModal] = useState<HealthRow | "new" | null>(null);
  const [financeModal, setFinanceModal] = useState<FinanceRow | "new" | null>(
    null
  );

  const defaultYear = useMemo(() => new Date().getFullYear(), []);

  function closeAllModals() {
    setAcademicModal(null);
    setDisciplineModal(null);
    setHealthModal(null);
    setFinanceModal(null);
    setFormError(null);
  }

  function submitForm(
    action: (fd: FormData) => Promise<{ error?: string; success?: true }>
  ) {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError(null);
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        const res = await action(fd);
        if (res.error) {
          setFormError(res.error);
          return;
        }
        closeAllModals();
        router.refresh();
      });
    };
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <StudentProfileAvatar
          studentId={studentId}
          studentName={studentName}
          classLabel={className}
          avatarUrl={avatarUrl}
        />
        <p className="mt-6 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-zinc-800 dark:text-zinc-400">
          As a school admin you can add or update academic, discipline, health,
          and finance records below. Other staff cannot open this page yet.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-zinc-800">
        {tabLabels.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "academic" && (
        <section className="space-y-4" aria-labelledby="academic-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="academic-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Academic records
            </h2>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setAcademicModal("new");
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Add record
            </button>
          </div>
          {academicRecords.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No academic notes yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {academicRecords.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {r.academic_year} · {r.term}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        Updated {formatTs(r.updated_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setAcademicModal(r);
                      }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      Edit
                    </button>
                  </div>
                  {r.notes ? (
                    <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                      <span className="font-medium text-slate-800 dark:text-zinc-200">
                        Notes:{" "}
                      </span>
                      {r.notes}
                    </p>
                  ) : null}
                  {r.special_needs ? (
                    <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                      <span className="font-medium text-slate-800 dark:text-zinc-200">
                        Special needs:{" "}
                      </span>
                      {r.special_needs}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "discipline" && (
        <section className="space-y-4" aria-labelledby="discipline-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="discipline-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Discipline
            </h2>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setDisciplineModal("new");
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Add record
            </button>
          </div>
          {disciplineRecords.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No discipline incidents recorded.
            </p>
          ) : (
            <ul className="space-y-3">
              {disciplineRecords.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatDateOnly(r.incident_date)} ·{" "}
                        {incidentLabel(r.incident_type)}
                      </p>
                      <p className="mt-1 text-xs capitalize text-slate-500 dark:text-zinc-400">
                        Status: {r.status} · Logged {formatTs(r.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setDisciplineModal(r);
                      }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                    {r.description}
                  </p>
                  {r.action_taken ? (
                    <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                      <span className="font-medium">Action: </span>
                      {r.action_taken}
                    </p>
                  ) : null}
                  {r.resolved_date ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      Resolved {formatDateOnly(r.resolved_date)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "health" && (
        <section className="space-y-4" aria-labelledby="health-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="health-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Health
            </h2>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setHealthModal("new");
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Add record
            </button>
          </div>
          {healthRecords.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No health information on file.
            </p>
          ) : (
            <ul className="space-y-3">
              {healthRecords.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {r.condition}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        {r.severity ? `${r.severity} · ` : ""}
                        Updated {formatTs(r.updated_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setHealthModal(r);
                      }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      Edit
                    </button>
                  </div>
                  {r.medication ? (
                    <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                      <span className="font-medium">Medication: </span>
                      {r.medication}
                    </p>
                  ) : null}
                  {r.special_care_notes ? (
                    <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                      <span className="font-medium">Care notes: </span>
                      {r.special_care_notes}
                    </p>
                  ) : null}
                  {r.emergency_contact_phone ? (
                    <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                      <span className="font-medium">Emergency phone: </span>
                      {r.emergency_contact_phone}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "finance" && (
        <section className="space-y-4" aria-labelledby="finance-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="finance-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Finance
            </h2>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setFinanceModal("new");
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Add record
            </button>
          </div>
          {financeRecords.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No term finance snapshots yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {financeRecords.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {r.academic_year} · {r.term}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        Updated {formatTs(r.updated_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setFinanceModal(r);
                      }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                    Fee balance:{" "}
                    <span className="font-mono font-medium">
                      {Number(r.fee_balance).toFixed(2)}
                    </span>
                    {" · "}
                    Scholarship:{" "}
                    <span className="font-mono font-medium">
                      {Number(r.scholarship_amount).toFixed(2)}
                    </span>
                  </p>
                  {r.scholarship_type ? (
                    <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                      Type: {r.scholarship_type}
                    </p>
                  ) : null}
                  {r.payment_notes ? (
                    <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                      {r.payment_notes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Academic modal */}
      {academicModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setAcademicModal(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="academic-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <h3
                id="academic-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {academicModal === "new" ? "Add academic record" : "Edit academic record"}
              </h3>
            </div>
            <form
              className="space-y-4 px-4 py-4 sm:px-5"
              onSubmit={submitForm(upsertStudentAcademicRecord)}
            >
              <input type="hidden" name="student_id" value={studentId} />
              {academicModal !== "new" ? (
                <input type="hidden" name="id" value={academicModal.id} />
              ) : null}
              <div>
                <label className={labelClass} htmlFor="academic_year">
                  Academic year
                </label>
                <input
                  id="academic_year"
                  name="academic_year"
                  type="number"
                  required
                  min={2000}
                  max={2100}
                  defaultValue={
                    academicModal === "new"
                      ? defaultYear
                      : academicModal.academic_year
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="academic_term">
                  Term
                </label>
                <select
                  id="academic_term"
                  name="term"
                  required
                  defaultValue={
                    academicModal === "new" ? "Term 1" : academicModal.term
                  }
                  className={inputClass}
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="academic_notes">
                  Notes
                </label>
                <textarea
                  id="academic_notes"
                  name="notes"
                  rows={3}
                  defaultValue={
                    academicModal === "new" ? "" : academicModal.notes ?? ""
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="academic_sn">
                  Special needs
                </label>
                <textarea
                  id="academic_sn"
                  name="special_needs"
                  rows={2}
                  defaultValue={
                    academicModal === "new"
                      ? ""
                      : academicModal.special_needs ?? ""
                  }
                  className={inputClass}
                />
              </div>
              {formError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setAcademicModal(null)}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Discipline modal */}
      {disciplineModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) {
              setDisciplineModal(null);
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discipline-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <h3
                id="discipline-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {disciplineModal === "new"
                  ? "Add discipline record"
                  : "Edit discipline record"}
              </h3>
            </div>
            <form
              className="space-y-4 px-4 py-4 sm:px-5"
              onSubmit={submitForm(upsertStudentDisciplineRecord)}
            >
              <input type="hidden" name="student_id" value={studentId} />
              {disciplineModal !== "new" ? (
                <input type="hidden" name="id" value={disciplineModal.id} />
              ) : null}
              <div>
                <label className={labelClass} htmlFor="incident_date">
                  Incident date
                </label>
                <input
                  id="incident_date"
                  name="incident_date"
                  type="date"
                  required
                  defaultValue={
                    disciplineModal === "new"
                      ? new Date().toISOString().slice(0, 10)
                      : disciplineModal.incident_date.slice(0, 10)
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="incident_type">
                  Type
                </label>
                <select
                  id="incident_type"
                  name="incident_type"
                  required
                  defaultValue={
                    disciplineModal === "new"
                      ? "warning"
                      : disciplineModal.incident_type
                  }
                  className={inputClass}
                >
                  <option value="warning">Warning</option>
                  <option value="detention">Detention</option>
                  <option value="suspension">Suspension</option>
                  <option value="expulsion">Expulsion</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="discipline_desc">
                  Description
                </label>
                <textarea
                  id="discipline_desc"
                  name="description"
                  required
                  rows={3}
                  defaultValue={
                    disciplineModal === "new" ? "" : disciplineModal.description
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="action_taken">
                  Action taken
                </label>
                <textarea
                  id="action_taken"
                  name="action_taken"
                  rows={2}
                  defaultValue={
                    disciplineModal === "new"
                      ? ""
                      : disciplineModal.action_taken ?? ""
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="discipline_status">
                  Status
                </label>
                <select
                  id="discipline_status"
                  name="status"
                  required
                  defaultValue={
                    disciplineModal === "new" ? "pending" : disciplineModal.status
                  }
                  className={inputClass}
                >
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="appealed">Appealed</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="resolved_date">
                  Resolved date (optional)
                </label>
                <input
                  id="resolved_date"
                  name="resolved_date"
                  type="date"
                  defaultValue={
                    disciplineModal !== "new" && disciplineModal.resolved_date
                      ? disciplineModal.resolved_date.slice(0, 10)
                      : ""
                  }
                  className={inputClass}
                />
              </div>
              {formError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDisciplineModal(null)}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Health modal */}
      {healthModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setHealthModal(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="health-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <h3
                id="health-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {healthModal === "new" ? "Add health record" : "Edit health record"}
              </h3>
            </div>
            <form
              className="space-y-4 px-4 py-4 sm:px-5"
              onSubmit={submitForm(upsertStudentHealthRecord)}
            >
              <input type="hidden" name="student_id" value={studentId} />
              {healthModal !== "new" ? (
                <input type="hidden" name="id" value={healthModal.id} />
              ) : null}
              <div>
                <label className={labelClass} htmlFor="health_condition">
                  Condition
                </label>
                <input
                  id="health_condition"
                  name="condition"
                  required
                  defaultValue={
                    healthModal === "new" ? "" : healthModal.condition
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="health_severity">
                  Severity
                </label>
                <select
                  id="health_severity"
                  name="severity"
                  defaultValue={
                    healthModal === "new" ? "" : healthModal.severity ?? ""
                  }
                  className={inputClass}
                >
                  <option value="">Not specified</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="health_medication">
                  Medication
                </label>
                <textarea
                  id="health_medication"
                  name="medication"
                  rows={2}
                  defaultValue={
                    healthModal === "new" ? "" : healthModal.medication ?? ""
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="health_care">
                  Special care notes
                </label>
                <textarea
                  id="health_care"
                  name="special_care_notes"
                  rows={2}
                  defaultValue={
                    healthModal === "new"
                      ? ""
                      : healthModal.special_care_notes ?? ""
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="health_emergency">
                  Emergency contact phone
                </label>
                <input
                  id="health_emergency"
                  name="emergency_contact_phone"
                  type="tel"
                  defaultValue={
                    healthModal === "new"
                      ? ""
                      : healthModal.emergency_contact_phone ?? ""
                  }
                  className={inputClass}
                />
              </div>
              {formError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setHealthModal(null)}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Finance modal */}
      {financeModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setFinanceModal(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <h3
                id="finance-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {financeModal === "new" ? "Add finance record" : "Edit finance record"}
              </h3>
            </div>
            <form
              className="space-y-4 px-4 py-4 sm:px-5"
              onSubmit={submitForm(upsertStudentFinanceRecord)}
            >
              <input type="hidden" name="student_id" value={studentId} />
              {financeModal !== "new" ? (
                <input type="hidden" name="id" value={financeModal.id} />
              ) : null}
              <div>
                <label className={labelClass} htmlFor="finance_year">
                  Academic year
                </label>
                <input
                  id="finance_year"
                  name="academic_year"
                  type="number"
                  required
                  min={2000}
                  max={2100}
                  defaultValue={
                    financeModal === "new"
                      ? defaultYear
                      : financeModal.academic_year
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="finance_term">
                  Term
                </label>
                <select
                  id="finance_term"
                  name="term"
                  required
                  defaultValue={
                    financeModal === "new" ? "Term 1" : financeModal.term
                  }
                  className={inputClass}
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="fee_balance">
                  Fee balance
                </label>
                <input
                  id="fee_balance"
                  name="fee_balance"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  defaultValue={
                    financeModal === "new" ? "0" : String(financeModal.fee_balance)
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="scholarship_amount">
                  Scholarship amount
                </label>
                <input
                  id="scholarship_amount"
                  name="scholarship_amount"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  defaultValue={
                    financeModal === "new"
                      ? "0"
                      : String(financeModal.scholarship_amount)
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="scholarship_type">
                  Scholarship type
                </label>
                <input
                  id="scholarship_type"
                  name="scholarship_type"
                  type="text"
                  defaultValue={
                    financeModal === "new"
                      ? ""
                      : financeModal.scholarship_type ?? ""
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="payment_notes">
                  Payment notes
                </label>
                <textarea
                  id="payment_notes"
                  name="payment_notes"
                  rows={2}
                  defaultValue={
                    financeModal === "new"
                      ? ""
                      : financeModal.payment_notes ?? ""
                  }
                  className={inputClass}
                />
              </div>
              {formError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setFinanceModal(null)}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
}
