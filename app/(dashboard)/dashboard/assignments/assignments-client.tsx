"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { BackButton } from "@/components/dashboard/back-button";
import { useRouter } from "next/navigation";
import {
  AssignTeacherModal,
  type AssignModalState,
} from "../teachers/components/AssignTeacherModal";
import { AssignSingleClassSubjectForm } from "../teachers/components/AssignSingleClassSubjectForm";
import { BulkAssignClassSubjectSection } from "../teachers/components/BulkAssignClassSubjectSection";
import {
  assignTeacherToClassAction,
  bulkAssignTeacherClassesAction,
} from "../teachers/actions";
import type { TeacherActionState } from "../teachers/types";
import {
  bulkDeleteAssignmentsAction,
  deleteAssignmentAction,
  updateAssignmentAction,
  type AssignmentActionState,
} from "./actions";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";
import {
  TEACHER_ASSIGNMENTS_ROWS_STORAGE_KEY,
  parseStudentListRowsPerPage,
  STUDENT_LIST_ROW_OPTIONS,
  type StudentListRowOption,
} from "@/lib/student-list-pagination";

const SINGLE_ASSIGN_EXPANDED_STORAGE_KEY =
  "adakaro:assignments:singleAssignExpanded";
const BULK_ASSIGN_EXPANDED_STORAGE_KEY =
  "adakaro:assignments:bulkAssignExpanded";

export interface AssignmentRow {
  id: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  subject: string;
  subjectId: string | null;
  academicYear: string;
}

function filterAssignmentsBySearch(
  rows: AssignmentRow[],
  search: string
): AssignmentRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((a) => {
    const subj = (a.subject ?? "").toLowerCase();
    return (
      a.teacherName.toLowerCase().includes(q) ||
      a.className.toLowerCase().includes(q) ||
      subj.includes(q)
    );
  });
}

function formatFormerTeacherAssignmentDetails(row: AssignmentRow): string {
  const subject = row.subject?.trim() || "—";
  const year = row.academicYear?.trim() || "—";
  return `${row.teacherName} · ${row.className} · ${subject} · ${year}`;
}

function SectionCountBadge({ count }: { count: number }) {
  return (
    <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
      {count}
    </span>
  );
}

interface AssignmentsPageClientProps {
  assignments: AssignmentRow[];
  orphanAssignments: AssignmentRow[];
  classOptions: { id: string; name: string; parent_class_id: string | null }[];
  subjectOptionsByClassId: Record<
    string,
    { id: string; name: string; code: string | null }[]
  >;
  bulkAssignableTeachers: { userId: string; fullName: string }[];
  allSubjects: { id: string; name: string; code: string | null }[];
}

export function AssignmentsPageClient({
  assignments,
  orphanAssignments,
  classOptions,
  subjectOptionsByClassId,
  bulkAssignableTeachers,
  allSubjects,
}: AssignmentsPageClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<StudentListRowOption>(5);
  const [editModal, setEditModal] = useState<AssignModalState | null>(null);
  const [orphanRemoveTarget, setOrphanRemoveTarget] =
    useState<AssignmentRow | null>(null);
  const [orphanRemoveError, setOrphanRemoveError] = useState<string | null>(
    null
  );
  const [selectedOrphanIds, setSelectedOrphanIds] = useState<Set<string>>(
    () => new Set()
  );
  const [orphanBulkRemoveOpen, setOrphanBulkRemoveOpen] = useState(false);
  const [orphanBulkRemoveError, setOrphanBulkRemoveError] = useState<
    string | null
  >(null);
  const orphanDeleteSubmittedRef = useRef(false);
  const orphanBulkDeleteSubmittedRef = useRef(false);
  const orphanSelectAllRef = useRef<HTMLInputElement>(null);
  const [singleAssignExpanded, setSingleAssignExpanded] = useState(true);
  const [bulkAssignExpanded, setBulkAssignExpanded] = useState(false);

  useEffect(() => {
    const stored = parseStudentListRowsPerPage(
      localStorage.getItem(TEACHER_ASSIGNMENTS_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  useEffect(() => {
    try {
      const b = localStorage.getItem(BULK_ASSIGN_EXPANDED_STORAGE_KEY);
      /** Bulk open is the only flag that hides Add one; otherwise Add one is open. */
      const bulk = b === null || b === undefined ? false : b === "true";
      if (bulk) {
        setBulkAssignExpanded(true);
        setSingleAssignExpanded(false);
        localStorage.setItem(SINGLE_ASSIGN_EXPANDED_STORAGE_KEY, "false");
        localStorage.setItem(BULK_ASSIGN_EXPANDED_STORAGE_KEY, "true");
      } else {
        setBulkAssignExpanded(false);
        setSingleAssignExpanded(true);
        localStorage.setItem(SINGLE_ASSIGN_EXPANDED_STORAGE_KEY, "true");
        localStorage.setItem(BULK_ASSIGN_EXPANDED_STORAGE_KEY, "false");
      }
    } catch {
      /* ignore */
    }
  }, []);

  function toggleSingleAssign() {
    setSingleAssignExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          SINGLE_ASSIGN_EXPANDED_STORAGE_KEY,
          next ? "true" : "false"
        );
        if (next) {
          setBulkAssignExpanded(false);
          localStorage.setItem(BULK_ASSIGN_EXPANDED_STORAGE_KEY, "false");
        }
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleBulkAssign() {
    setBulkAssignExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          BULK_ASSIGN_EXPANDED_STORAGE_KEY,
          next ? "true" : "false"
        );
        if (next) {
          setSingleAssignExpanded(false);
          localStorage.setItem(SINGLE_ASSIGN_EXPANDED_STORAGE_KEY, "false");
        } else {
          setSingleAssignExpanded(true);
          localStorage.setItem(SINGLE_ASSIGN_EXPANDED_STORAGE_KEY, "true");
        }
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const [updateState, updateAction, updatePending] = useActionState(
    updateAssignmentAction,
    null as AssignmentActionState | null
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAssignmentAction,
    null as AssignmentActionState | null
  );
  const [bulkDeleteState, bulkDeleteAction, bulkDeletePending] = useActionState(
    bulkDeleteAssignmentsAction,
    null as AssignmentActionState | null
  );
  const [bulkAssignState, bulkAssignAction, bulkAssignPending] = useActionState(
    bulkAssignTeacherClassesAction,
    null as TeacherActionState | null
  );
  const [singleAssignState, singleAssignAction, singleAssignPending] =
    useActionState(
      assignTeacherToClassAction,
      null as TeacherActionState | null
    );

  useEffect(() => {
    if (updateState?.ok) {
      setEditModal(null);
      router.refresh();
    }
  }, [updateState, router]);

  useEffect(() => {
    if (!deleteState) return;
    if (orphanDeleteSubmittedRef.current) {
      orphanDeleteSubmittedRef.current = false;
      if (deleteState.ok) {
        setOrphanRemoveTarget(null);
        setOrphanRemoveError(null);
        setSelectedOrphanIds((prev) => {
          if (!orphanRemoveTarget || !prev.has(orphanRemoveTarget.id)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(orphanRemoveTarget.id);
          return next;
        });
        router.refresh();
      } else {
        setOrphanRemoveError(
          "Could not remove this assignment. Please try again."
        );
      }
      return;
    }
    if (deleteState.ok) {
      router.refresh();
    }
  }, [deleteState, orphanRemoveTarget, router]);

  useEffect(() => {
    if (!bulkDeleteState) return;
    if (!orphanBulkDeleteSubmittedRef.current) return;
    orphanBulkDeleteSubmittedRef.current = false;
    if (bulkDeleteState.ok) {
      setOrphanBulkRemoveOpen(false);
      setOrphanBulkRemoveError(null);
      setSelectedOrphanIds(new Set());
      router.refresh();
    } else {
      setOrphanBulkRemoveError(
        bulkDeleteState.error ??
          "Could not remove these assignments. Please try again."
      );
    }
  }, [bulkDeleteState, router]);

  const isOrphanRemovePending = deletePending && orphanRemoveTarget != null;

  function openOrphanRemoveModal(row: AssignmentRow) {
    setOrphanRemoveError(null);
    setOrphanRemoveTarget(row);
  }

  function closeOrphanRemoveModal() {
    if (isOrphanRemovePending) return;
    setOrphanRemoveTarget(null);
    setOrphanRemoveError(null);
  }

  useEffect(() => {
    if (bulkAssignState?.ok) {
      router.refresh();
    }
  }, [bulkAssignState, router]);

  useEffect(() => {
    if (singleAssignState?.ok) {
      router.refresh();
    }
  }, [singleAssignState, router]);

  const filteredActive = useMemo(
    () => filterAssignmentsBySearch(assignments, search),
    [assignments, search]
  );

  const filteredOrphans = useMemo(
    () => filterAssignmentsBySearch(orphanAssignments, search),
    [orphanAssignments, search]
  );

  const isOrphanBulkRemovePending =
    bulkDeletePending && orphanBulkRemoveOpen;
  const isOrphanDeleteBusy = deletePending || bulkDeletePending;
  const selectedOrphanCount = selectedOrphanIds.size;
  const allFilteredOrphansSelected =
    filteredOrphans.length > 0 &&
    filteredOrphans.every((a) => selectedOrphanIds.has(a.id));
  const someFilteredOrphansSelected = filteredOrphans.some((a) =>
    selectedOrphanIds.has(a.id)
  );

  useEffect(() => {
    const validIds = new Set(orphanAssignments.map((a) => a.id));
    setSelectedOrphanIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [orphanAssignments]);

  useEffect(() => {
    const el = orphanSelectAllRef.current;
    if (!el) return;
    el.indeterminate =
      someFilteredOrphansSelected && !allFilteredOrphansSelected;
  }, [someFilteredOrphansSelected, allFilteredOrphansSelected]);

  function toggleOrphanSelection(id: string) {
    setSelectedOrphanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFilteredOrphans() {
    setSelectedOrphanIds((prev) => {
      const next = new Set(prev);
      if (allFilteredOrphansSelected) {
        for (const row of filteredOrphans) next.delete(row.id);
      } else {
        for (const row of filteredOrphans) next.add(row.id);
      }
      return next;
    });
  }

  function openOrphanBulkRemoveModal() {
    if (selectedOrphanCount === 0) return;
    setOrphanBulkRemoveError(null);
    setOrphanBulkRemoveOpen(true);
  }

  function closeOrphanBulkRemoveModal() {
    if (isOrphanBulkRemovePending) return;
    setOrphanBulkRemoveOpen(false);
    setOrphanBulkRemoveError(null);
  }

  const searchQuery = search.trim();
  const hasSearch = searchQuery.length > 0;
  const hasAnyAssignments =
    assignments.length > 0 || orphanAssignments.length > 0;
  const totalMatching = filteredActive.length + filteredOrphans.length;
  const showNeedsReviewSection =
    orphanAssignments.length > 0 &&
    (!hasSearch || filteredOrphans.length > 0);
  const showOrphanBanner =
    orphanAssignments.length > 0 &&
    (!hasSearch || filteredOrphans.length > 0);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalFiltered = filteredActive.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * rowsPerPage;
  const pageRows = filteredActive.slice(start, start + rowsPerPage);

  const paginationItems = useMemo(
    () => getCompactPaginationItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const showingFrom =
    totalFiltered === 0 ? 0 : Math.min(start + 1, totalFiltered);
  const showingTo =
    totalFiltered === 0 ? 0 : Math.min(start + rowsPerPage, totalFiltered);

  return (
    <div className="space-y-6">
      <div>
        <BackButton
          href="/dashboard"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back to dashboard
        </BackButton>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Teacher Assignments
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage teacher class and subject assignments.
        </p>
      </div>

      {deleteState && !deleteState.ok ? (
        <p className="rounded border border-red-200 bg-white px-3 py-2 text-sm text-red-800">
          {deleteState.error}
        </p>
      ) : null}

      <AssignSingleClassSubjectForm
        expanded={singleAssignExpanded}
        onToggle={toggleSingleAssign}
        assignableTeachers={bulkAssignableTeachers}
        classOptions={classOptions}
        subjectOptionsByClassId={subjectOptionsByClassId}
        formAction={singleAssignAction}
        pending={singleAssignPending}
        flashState={singleAssignState}
      />

      <BulkAssignClassSubjectSection
        expanded={bulkAssignExpanded}
        onToggle={toggleBulkAssign}
        assignableTeachers={bulkAssignableTeachers}
        classOptions={classOptions}
        subjectOptionsByClassId={subjectOptionsByClassId}
        allSubjects={allSubjects}
        formAction={bulkAssignAction}
        pending={bulkAssignPending}
        flashState={bulkAssignState}
      />

      {showOrphanBanner ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
          Some assignments are linked to teachers who are no longer in your
          school.
        </p>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">
            Active assignments
            <SectionCountBadge count={filteredActive.length} />
          </h2>
        </div>
        <div className="border-b border-gray-200 p-4">
          <label className="block text-sm text-slate-700">
            <span className="sr-only">Search by teacher, class, or subject</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by teacher, class, or subject..."
              className="w-full max-w-md rounded-md border border-gray-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </label>
        </div>
        {hasSearch && totalMatching === 0 && hasAnyAssignments ? (
          <p className="border-b border-gray-200 px-4 py-6 text-center text-sm text-slate-500 dark:text-zinc-400">
            No assignments match your search.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 text-sm text-slate-600">
          <p className="min-w-0">
            {totalFiltered > 0 ? (
              <>
                Showing{" "}
                <span className="font-medium text-slate-900">
                  {showingFrom}–{showingTo}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-900">
                  {totalFiltered}
                </span>{" "}
                active assignment{totalFiltered !== 1 ? "s" : ""}
              </>
            ) : assignments.length === 0 && !hasSearch ? (
              "No assignments yet."
            ) : hasSearch && filteredOrphans.length > 0 ? (
              "No active assignments match your search."
            ) : null}
          </p>
          <label className="flex shrink-0 items-center gap-2">
            <span className="text-slate-500">Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                const n = Number(e.target.value) as StudentListRowOption;
                setRowsPerPage(n);
                setPage(1);
                localStorage.setItem(
                  TEACHER_ASSIGNMENTS_ROWS_STORAGE_KEY,
                  String(n)
                );
              }}
              aria-label="Rows per page"
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {STUDENT_LIST_ROW_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="bg-white">
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-700">
                  Teacher
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-700">
                  Class
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-700">
                  Subject
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-700">
                  Year
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {pageRows.length === 0 ? (
                assignments.length === 0 && !hasSearch ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No assignments yet.
                    </td>
                  </tr>
                ) : null
              ) : (
                pageRows.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-900">
                      {a.teacherName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                      {a.className}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                      {a.subject || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {a.academicYear?.trim() ? a.academicYear : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditModal({
                              mode: "edit",
                              row: {
                                id: a.id,
                                classId: a.classId,
                                subjectId: a.subjectId,
                                subjectName: a.subject,
                                academicYear: a.academicYear,
                              },
                            })
                          }
                          className="rounded border border-gray-200 px-2 py-1 text-sm text-slate-800 hover:bg-gray-50"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <form
                          action={deleteAction}
                          className="inline"
                          onSubmit={(e) => {
                            if (!confirm("Are you sure?")) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <input
                            type="hidden"
                            name="assignment_id"
                            value={a.id}
                          />
                          <button
                            type="submit"
                            disabled={deletePending}
                            className="rounded border border-gray-200 px-2 py-1 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50"
                            title="Delete"
                          >
                            {deletePending ? "…" : "🗑️"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && totalFiltered > 0 ? (
          <nav
            className="flex flex-wrap items-center justify-center gap-2 border-t border-gray-200 px-4 py-3"
            aria-label="Assignments pagination"
          >
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            {paginationItems.map((item, idx) =>
              item === "ellipsis" ? (
                <span
                  key={`asg-ellipsis-${idx}`}
                  className="px-2 text-sm text-slate-400"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  aria-current={item === safePage ? "page" : undefined}
                  className={
                    item === safePage
                      ? "rounded-lg border border-school-primary bg-school-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                      : "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-gray-50"
                  }
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        ) : null}
      </div>

      {showNeedsReviewSection ? (
        <div className="rounded-lg border border-amber-200/70 bg-white shadow-sm dark:border-amber-900/30 dark:bg-zinc-900/40">
          <div className="border-b border-amber-200/60 px-4 py-3 dark:border-amber-900/30">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">
              Assignments from former teachers
              <SectionCountBadge count={filteredOrphans.length} />
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
              These assignments belong to teachers who are no longer in your
              school. Remove them if they are no longer needed.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/60 px-4 py-3 dark:border-amber-900/30">
            <p
              className="text-sm font-medium tabular-nums text-slate-600 dark:text-zinc-400"
              aria-live="polite"
            >
              {selectedOrphanCount > 0
                ? allFilteredOrphansSelected && filteredOrphans.length > 0
                  ? `All ${filteredOrphans.length} assignment${filteredOrphans.length === 1 ? "" : "s"} selected`
                  : `${selectedOrphanCount} selected`
                : null}
            </p>
            <button
              type="button"
              onClick={openOrphanBulkRemoveModal}
              disabled={selectedOrphanCount === 0 || isOrphanDeleteBusy}
              className="rounded-xl border border-red-200 bg-white px-3.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Remove selected ({selectedOrphanCount})
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="bg-amber-50/40 dark:bg-amber-950/20">
                  <th className="whitespace-nowrap px-4 py-3 text-left">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        ref={orphanSelectAllRef}
                        type="checkbox"
                        checked={allFilteredOrphansSelected}
                        onChange={toggleSelectAllFilteredOrphans}
                        disabled={
                          filteredOrphans.length === 0 || isOrphanDeleteBusy
                        }
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-school-primary focus:ring-school-primary disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                        Select all
                      </span>
                    </label>
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-700">
                    Teacher
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-700">
                    Class
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-700">
                    Subject
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-700">
                    Year
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:bg-zinc-900/20">
                {filteredOrphans.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedOrphanIds.has(a.id)}
                        onChange={() => toggleOrphanSelection(a.id)}
                        disabled={isOrphanDeleteBusy}
                        aria-label={`Select assignment for ${a.teacherName}, ${a.className}`}
                        className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-900">
                      {a.teacherName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                      {a.className}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                      {a.subject || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {a.academicYear?.trim() ? a.academicYear : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {selectedOrphanCount === 0 ? (
                        <button
                          type="button"
                          onClick={() => openOrphanRemoveModal(a)}
                          disabled={isOrphanDeleteBusy}
                          className="rounded border border-gray-200 px-2 py-1 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                        >
                          Remove assignment
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {orphanBulkRemoveOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-former-assignments-bulk-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40 disabled:cursor-not-allowed"
            aria-label="Close dialog"
            onClick={closeOrphanBulkRemoveModal}
            disabled={isOrphanBulkRemovePending}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl dark:border-zinc-700/80 dark:bg-zinc-900">
            <h2
              id="remove-former-assignments-bulk-title"
              className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50"
            >
              Remove selected former-teacher assignments?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
              You are about to permanently remove {selectedOrphanCount}{" "}
              assignment{selectedOrphanCount === 1 ? "" : "s"} linked to former
              teachers.
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
              This action cannot be undone.
            </p>

            {orphanBulkRemoveError ? (
              <p
                className="mt-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                {orphanBulkRemoveError}
              </p>
            ) : null}

            <form
              action={bulkDeleteAction}
              className="mt-5 flex flex-wrap justify-end gap-2"
              onSubmit={() => {
                orphanBulkDeleteSubmittedRef.current = true;
              }}
            >
              {[...selectedOrphanIds].map((id) => (
                <input key={id} type="hidden" name="assignment_ids" value={id} />
              ))}
              <button
                type="button"
                onClick={closeOrphanBulkRemoveModal}
                disabled={isOrphanBulkRemovePending}
                className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isOrphanBulkRemovePending}
                className="rounded-xl border border-red-200 bg-white px-3.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                {isOrphanBulkRemovePending
                  ? "Removing..."
                  : `Remove ${selectedOrphanCount} assignment${selectedOrphanCount === 1 ? "" : "s"}`}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {orphanRemoveTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-former-assignment-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40 disabled:cursor-not-allowed"
            aria-label="Close dialog"
            onClick={closeOrphanRemoveModal}
            disabled={isOrphanRemovePending}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl dark:border-zinc-700/80 dark:bg-zinc-900">
            <h2
              id="remove-former-assignment-title"
              className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50"
            >
              Remove assignment from former teacher?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
              This assignment is linked to a teacher who is no longer in your
              school.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
              Remove it only if it is no longer needed.
            </p>
            <p className="mt-2.5 text-xs font-medium text-slate-700 dark:text-zinc-300">
              {formatFormerTeacherAssignmentDetails(orphanRemoveTarget)}
            </p>

            {orphanRemoveError ? (
              <p
                className="mt-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                {orphanRemoveError}
              </p>
            ) : null}

            <form
              action={deleteAction}
              className="mt-5 flex flex-wrap justify-end gap-2"
              onSubmit={() => {
                orphanDeleteSubmittedRef.current = true;
              }}
            >
              <input
                type="hidden"
                name="assignment_id"
                value={orphanRemoveTarget.id}
              />
              <button
                type="button"
                onClick={closeOrphanRemoveModal}
                disabled={isOrphanRemovePending}
                className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isOrphanRemovePending}
                className="rounded-xl border border-red-200 bg-white px-3.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                {isOrphanRemovePending ? "Removing..." : "Remove assignment"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {editModal ? (
        <AssignTeacherModal
          modal={editModal}
          onClose={() => setEditModal(null)}
          classOptions={classOptions}
          subjectOptionsByClassId={subjectOptionsByClassId}
          modalFormAction={updateAction}
          modalPending={updatePending}
          modalFlash={updateState}
        />
      ) : null}
    </div>
  );
}
