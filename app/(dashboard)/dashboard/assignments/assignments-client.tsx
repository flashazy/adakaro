"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AssignTeacherModal,
  type AssignModalState,
} from "../teachers/components/AssignTeacherModal";
import {
  deleteAssignmentAction,
  updateAssignmentAction,
  type AssignmentActionState,
} from "./actions";

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

const PAGE_SIZE = 20;

interface AssignmentsPageClientProps {
  assignments: AssignmentRow[];
  classOptions: { id: string; name: string }[];
  subjectOptionsByClassId: Record<
    string,
    { id: string; name: string; code: string | null }[]
  >;
}

export function AssignmentsPageClient({
  assignments,
  classOptions,
  subjectOptionsByClassId,
}: AssignmentsPageClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editModal, setEditModal] = useState<AssignModalState | null>(null);

  const [updateState, updateAction, updatePending] = useActionState(
    updateAssignmentAction,
    null as AssignmentActionState | null
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAssignmentAction,
    null as AssignmentActionState | null
  );

  useEffect(() => {
    if (updateState?.ok) {
      setEditModal(null);
      router.refresh();
    }
  }, [updateState, router]);

  useEffect(() => {
    if (deleteState?.ok) {
      router.refresh();
    }
  }, [deleteState, router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) =>
      a.teacherName.toLowerCase().includes(q)
    );
  }, [assignments, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back to dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Teacher Assignments
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          View and update class assignments. Add or remove teachers from the{" "}
          <Link href="/dashboard/teachers" className="underline">
            Teachers
          </Link>{" "}
          page.
        </p>
      </div>

      {deleteState && !deleteState.ok ? (
        <p className="rounded border border-red-200 bg-white px-3 py-2 text-sm text-red-800">
          {deleteState.error}
        </p>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <label className="block text-sm text-slate-700">
          <span className="sr-only">Search by teacher name</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by teacher name…"
            className="w-full max-w-md rounded-md border border-gray-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </label>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
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
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    {assignments.length === 0
                      ? "No assignments yet."
                      : "No assignments match your search."}
                  </td>
                </tr>
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

        {filtered.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm text-slate-600">
            <span>
              {filtered.length === 0
                ? "0 of 0"
                : `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-gray-200 bg-white px-3 py-1.5 text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
                className="rounded border border-gray-200 bg-white px-3 py-1.5 text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

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
