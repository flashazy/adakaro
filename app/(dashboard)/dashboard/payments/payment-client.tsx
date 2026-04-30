"use client";

import {
  useState,
  useEffect,
  useMemo,
  useTransition,
  type FormEvent,
} from "react";
import { recordPayment, type PaymentActionState } from "./actions";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { enqueueOrRun } from "@/lib/offline/enqueue-or-run";
import { makeTempReceiptNumber } from "@/lib/offline/temp-ids";
import { useOfflinePaymentByUuid } from "@/lib/offline/use-sync";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";
import {
  RECORD_PAYMENT_STUDENTS_ROWS_STORAGE_KEY,
  parseStudentListRowsPerPage,
  STUDENT_LIST_ROW_OPTIONS,
  type StudentListRowOption,
} from "@/lib/student-list-pagination";

// ─── Types ───────────────────────────────────────────────

interface StudentOption {
  id: string;
  full_name: string;
  admission_number: string | null;
  class: { name: string } | null;
}

interface BalanceRow {
  student_id: string;
  fee_structure_id: string;
  fee_name: string;
  total_fee: number;
  total_paid: number;
  balance: number;
  due_date: string | null;
}

interface PaymentRow {
  id: string;
  student_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference_number: string | null;
  fee_structure_id: string | null;
  receipt: { id: string; receipt_number: string } | null;
}

interface Props {
  students: StudentOption[];
  balances: BalanceRow[];
  payments: PaymentRow[];
  currencyCode: string;
}

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "clickpesa", label: "ClickPesa (online)" },
] as const;

// ─── Submit button ───────────────────────────────────────

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {pending ? "Recording…" : "Record payment"}
    </button>
  );
}

// ─── Main component ──────────────────────────────────────

/**
 * Local extension of `PaymentActionState` for the offline-aware UI:
 *   - `queuedUuid` ties the current success message to the offline row
 *     so the receipt-swap effect can find it.
 *   - `tempReceipt` is the `OFFLINE-…` number shown until sync replaces
 *     it with the real `RCP-…` number.
 */
type LocalPaymentState = PaymentActionState & {
  queuedUuid?: string;
  tempReceipt?: string;
};

const initialState: LocalPaymentState = {};

export function PaymentClient({
  students,
  balances,
  payments,
  currencyCode,
}: Props) {
  const money = (n: number) => formatCurrency(n, currencyCode);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentListPage, setStudentListPage] = useState(1);
  const [studentRowsPerPage, setStudentRowsPerPage] =
    useState<StudentListRowOption>(5);
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [state, setState] = useState<LocalPaymentState>(initialState);
  const [submitting, startSubmit] = useTransition();

  // When a payment is queued, watch the corresponding offline row. Once
  // sync runs and the server returns the real receipt number, swap it in
  // place of the temporary `OFFLINE-…` so the UI stays accurate without
  // requiring a navigation.
  const offlinePaymentRow = useOfflinePaymentByUuid(state.queuedUuid ?? null);
  useEffect(() => {
    if (!offlinePaymentRow?.realReceipt) return;
    setState((prev) =>
      prev.queuedUuid === offlinePaymentRow.uuid
        ? {
            ...prev,
            success: `Synced — receipt ${offlinePaymentRow.realReceipt}.`,
            receiptNumber: offlinePaymentRow.realReceipt ?? undefined,
            // Keep tempReceipt around so the conditional banner clearly
            // shows "OFFLINE-… → RCP-…" if you're inspecting later.
          }
        : prev
    );
  }, [offlinePaymentRow]);

  /**
   * Offline-aware submit. When online, calls `recordPayment` directly
   * and surfaces the server result. When offline (or when the call
   * throws a network error mid-flight), enqueues with a temp receipt so
   * the user gets immediate feedback.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    // Capture the field values up-front so we can both reconstruct
    // payload-as-object (for the offline replay) and call the server
    // action with the original FormData (for the online happy path).
    const payload: Record<string, string> = {};
    formData.forEach((v, k) => {
      if (typeof v === "string") payload[k] = v;
    });

    const tempReceipt = makeTempReceiptNumber();
    const studentId = payload["student_id"] ?? "";
    const amountNum = Number(payload["amount"] ?? "0");

    setState({});
    startSubmit(() => {
      void (async () => {
        try {
          const wrapped = await enqueueOrRun({
            kind: "record-payment",
            payload,
            run: () => recordPayment({}, formData),
            hint: {
              label: `Payment · ${studentId.slice(0, 8)} · ${amountNum.toLocaleString()}`,
              payments: {
                studentId,
                amount: amountNum,
                tempReceipt,
              },
            },
          });

          if (!wrapped.ok) {
            setState({ error: wrapped.error });
            return;
          }

          if (wrapped.queued) {
            setState({
              success: `Saved offline – will sync when online. Temporary receipt: ${tempReceipt}.`,
              receiptNumber: tempReceipt,
              queuedUuid: wrapped.uuid,
              tempReceipt,
            });
            return;
          }

          // Online happy path — surface the real server state.
          setState(wrapped.result);
        } catch (e) {
          setState({
            error: e instanceof Error ? e.message : "Something went wrong.",
          });
        }
      })();
    });
  };

  useEffect(() => {
    const stored = parseStudentListRowsPerPage(
      localStorage.getItem(RECORD_PAYMENT_STUDENTS_ROWS_STORAGE_KEY)
    );
    if (stored != null) setStudentRowsPerPage(stored);
  }, []);

  // Reset fee selection when student changes
  useEffect(() => {
    setSelectedFeeId("");
  }, [selectedStudentId]);

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.admission_number?.toLowerCase().includes(q) ?? false) ||
        (s.class?.name.toLowerCase().includes(q) ?? false)
    );
  }, [students, studentSearch]);

  useEffect(() => {
    setStudentListPage(1);
  }, [studentSearch]);

  const studentTotalFiltered = filteredStudents.length;
  const studentTotalPages = Math.max(
    1,
    Math.ceil(studentTotalFiltered / studentRowsPerPage)
  );

  useEffect(() => {
    if (studentListPage > studentTotalPages)
      setStudentListPage(studentTotalPages);
  }, [studentListPage, studentTotalPages]);

  const studentSafePage = Math.min(studentListPage, studentTotalPages);
  const studentPageStart = (studentSafePage - 1) * studentRowsPerPage;
  const pagedStudents = useMemo(
    () =>
      filteredStudents.slice(
        studentPageStart,
        studentPageStart + studentRowsPerPage
      ),
    [filteredStudents, studentPageStart, studentRowsPerPage]
  );

  const studentPaginationItems = useMemo(
    () => getCompactPaginationItems(studentSafePage, studentTotalPages),
    [studentSafePage, studentTotalPages]
  );

  const studentShowingFrom =
    studentTotalFiltered === 0
      ? 0
      : Math.min(studentPageStart + 1, studentTotalFiltered);
  const studentShowingTo =
    studentTotalFiltered === 0
      ? 0
      : Math.min(studentPageStart + studentRowsPerPage, studentTotalFiltered);

  // Balances for the selected student with outstanding amounts
  const studentBalances = useMemo(
    () =>
      balances.filter(
        (b) => b.student_id === selectedStudentId && b.balance > 0
      ),
    [balances, selectedStudentId]
  );

  // Recent payments for the selected student
  const studentPayments = useMemo(
    () => payments.filter((p) => p.student_id === selectedStudentId),
    [payments, selectedStudentId]
  );

  // Selected balance row
  const selectedBalance = studentBalances.find(
    (b) => b.fee_structure_id === selectedFeeId
  );

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-8">
      {/* ─── Student selector ─── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Select a student
        </h2>
        <input
          type="text"
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
          placeholder="Search by name, admission # or class…"
          className="mt-3 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-zinc-700">
          <p className="min-w-0 text-sm text-slate-600 dark:text-zinc-400">
            {studentTotalFiltered === 0 ? (
              studentSearch.trim()
                ? "No students match your search."
                : "No students to display."
            ) : (
              <>
                Showing{" "}
                <span className="font-medium text-slate-900 dark:text-white">
                  {studentShowingFrom}–{studentShowingTo}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-900 dark:text-white">
                  {studentTotalFiltered}
                </span>{" "}
                student{studentTotalFiltered !== 1 ? "s" : ""}
              </>
            )}
          </p>
          <label className="flex shrink-0 items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-zinc-400">
              Rows per page:
            </span>
            <select
              value={studentRowsPerPage}
              onChange={(e) => {
                const n = Number(e.target.value) as StudentListRowOption;
                setStudentRowsPerPage(n);
                setStudentListPage(1);
                localStorage.setItem(
                  RECORD_PAYMENT_STUDENTS_ROWS_STORAGE_KEY,
                  String(n)
                );
              }}
              aria-label="Rows per page for student list"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              {STUDENT_LIST_ROW_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-slate-300 dark:border-zinc-700">
          {filteredStudents.length > 0 ? (
            pagedStudents.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStudentId(s.id)}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedStudentId === s.id
                    ? "bg-[rgb(var(--school-primary-rgb)/0.10)] text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.14)] dark:text-school-primary"
                    : "text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-zinc-800"
                }`}
              >
                <span>
                  {s.full_name}
                  {s.admission_number ? ` (${s.admission_number})` : ""}
                </span>
                {s.class && (
                  <span className="ml-2 shrink-0 text-xs text-slate-500 dark:text-zinc-400">
                    {s.class.name}
                  </span>
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-sm text-slate-500 dark:text-zinc-400">
              No students found
            </p>
          )}
        </div>
        {studentTotalPages > 1 ? (
          <nav
            className="mt-3 flex flex-wrap items-center justify-center gap-2"
            aria-label="Student list pagination"
          >
            <button
              type="button"
              onClick={() =>
                setStudentListPage((p) => Math.max(1, p - 1))
              }
              disabled={studentSafePage <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Previous
            </button>
            {studentPaginationItems.map((item, idx) =>
              item === "ellipsis" ? (
                <span
                  key={`pay-ellipsis-${idx}`}
                  className="px-2 text-sm text-slate-400 dark:text-zinc-500"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStudentListPage(item)}
                  aria-current={item === studentSafePage ? "page" : undefined}
                  className={
                    item === studentSafePage
                      ? "rounded-lg border border-school-primary bg-school-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                      : "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() =>
                setStudentListPage((p) =>
                  Math.min(studentTotalPages, p + 1)
                )
              }
              disabled={studentSafePage >= studentTotalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Next
            </button>
          </nav>
        ) : null}
      </div>

      {/* ─── Outstanding fees ─── */}
      {selectedStudentId && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Outstanding fees for {selectedStudent?.full_name}
            </h2>
          </div>

          {studentBalances.length > 0 ? (
            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {studentBalances.map((b) => (
                <button
                  key={b.fee_structure_id}
                  type="button"
                  onClick={() => setSelectedFeeId(b.fee_structure_id)}
                  className={`flex w-full items-center justify-between px-6 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800 ${
                    selectedFeeId === b.fee_structure_id
                      ? "bg-[rgb(var(--school-primary-rgb)/0.10)] dark:bg-[rgb(var(--school-primary-rgb)/0.12)]"
                      : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {b.fee_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Total: {money(Number(b.total_fee))} · Paid:{" "}
                      {money(Number(b.total_paid))}
                      {b.due_date ? ` · Due: ${b.due_date}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {money(Number(b.balance))}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-6 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
              No outstanding fees for this student.
            </p>
          )}
        </div>
      )}

      {/* ─── Payment form ─── */}
      {selectedFeeId && selectedBalance && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Record payment — {selectedBalance.fee_name}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Balance: {money(Number(selectedBalance.balance))}
          </p>

          <input type="hidden" name="student_id" value={selectedStudentId} />
          <input type="hidden" name="fee_structure_id" value={selectedFeeId} />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Amount ({currencyCode}){" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                max={Number(selectedBalance.balance)}
                defaultValue={Number(selectedBalance.balance)}
                required
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="payment_method"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Payment method <span className="text-red-500">*</span>
              </label>
              <select
                id="payment_method"
                name="payment_method"
                required
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="reference_number"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Reference number
              </label>
              <input
                id="reference_number"
                name="reference_number"
                type="text"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="e.g. MPesa code"
              />
            </div>

            <div>
              <label
                htmlFor="payment_date"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Payment date
              </label>
              <input
                id="payment_date"
                name="payment_date"
                type="date"
                defaultValue={today}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="Optional notes"
              />
            </div>
          </div>

          <div className="mt-5">
            <SubmitButton pending={submitting} />
          </div>

          {state.error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          {state.success && (
            <div
              className={`mt-3 rounded-lg border p-3 ${
                state.queuedUuid && !offlinePaymentRow?.realReceipt
                  ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  state.queuedUuid && !offlinePaymentRow?.realReceipt
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {state.success}
              </p>
              {state.queuedUuid && !offlinePaymentRow?.realReceipt && (
                <Link
                  href="/teacher-dashboard/sync-status"
                  className="mt-1 inline-block text-sm font-medium text-school-primary underline hover:opacity-90 dark:text-school-primary"
                >
                  View pending sync →
                </Link>
              )}
              {state.paymentId && (
                <Link
                  href={`/dashboard/receipts/${state.paymentId}`}
                  className="mt-1 inline-block text-sm font-medium text-school-primary underline hover:opacity-90 dark:text-school-primary"
                >
                  View receipt →
                </Link>
              )}
            </div>
          )}
        </form>
      )}

      {/* ─── Payment history ─── */}
      {selectedStudentId && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Payment history
            </h2>
          </div>

          {studentPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-zinc-800">
                <thead className="bg-slate-50 dark:bg-zinc-800/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
                      Receipt #
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {studentPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap px-6 py-3 text-slate-700 dark:text-zinc-300">
                        {p.payment_date}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 font-medium text-slate-900 dark:text-white">
                        {money(Number(p.amount))}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-slate-700 dark:text-zinc-300">
                        {p.payment_method?.replace(/_/g, " ") ?? "N/A"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 font-mono text-slate-700 dark:text-zinc-300">
                        {p.receipt?.receipt_number ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right">
                        <Link
                          href={`/dashboard/receipts/${p.id}`}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          View receipt
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-6 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
              No payment records available.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
