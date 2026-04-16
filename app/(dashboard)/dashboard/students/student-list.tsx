"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StudentRow } from "./student-row";
import {
  getStudentSubjects,
  getSubjectsForClass,
  updateStudent,
  updateStudentSubjects,
} from "./actions";
import {
  currentAcademicYear,
  type SubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";

interface ClassOption {
  id: string;
  name: string;
}

interface StudentData {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_id: string;
  class: ClassOption | null;
  gender: string | null;
  enrollment_date: string;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  /** Distinct subjects enrolled for the current calendar year (any term). */
  subject_enrollment_count?: number;
}

interface StudentListProps {
  students: StudentData[];
  classes: ClassOption[];
}

const ROW_OPTIONS = [10, 25, 50, 100] as const;

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 0) return [];
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];
  pages.push(1);

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) {
    pages.push("ellipsis");
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < total - 1) {
    pages.push("ellipsis");
  }

  if (total > 1) {
    pages.push(total);
  }

  return pages;
}

export function StudentList({ students, classes }: StudentListProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<StudentData>>({});
  const [inlineSaveError, setInlineSaveError] = useState<string | null>(null);
  const [inlineSaveSuccess, setInlineSaveSuccess] = useState<string | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [editClassSubjects, setEditClassSubjects] = useState<
    { id: string; name: string }[]
  >([]);
  const [editSubjectsLoading, setEditSubjectsLoading] = useState(false);
  const [editSubjectIds, setEditSubjectIds] = useState<string[]>([]);
  const [editSubjectYear, setEditSubjectYear] = useState(currentAcademicYear());
  const [editSubjectTerm, setEditSubjectTerm] =
    useState<SubjectEnrollmentTerm>("Term 1");

  const classNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) map.set(c.id, c.name);
    return map;
  }, [classes]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    return students.filter((s) => {
      if (classFilter && s.class_id !== classFilter) return false;

      if (!q) return true;

      const name = s.full_name?.toLowerCase() ?? "";
      const adm = (s.admission_number ?? "").toLowerCase();
      const className = (
        s.class?.name ?? classNameMap.get(s.class_id) ?? ""
      ).toLowerCase();
      const gender = (s.gender ?? "").toLowerCase();
      const parentName = (s.parent_name ?? "").toLowerCase();
      const parentEmail = (s.parent_email ?? "").toLowerCase();
      const parentPhone = (s.parent_phone ?? "").toLowerCase();

      return (
        name.includes(q) ||
        adm.includes(q) ||
        className.includes(q) ||
        gender.includes(q) ||
        parentName.includes(q) ||
        parentEmail.includes(q) ||
        parentPhone.includes(q)
      );
    });
  }, [students, query, classFilter, classNameMap]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [query, classFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageSlice = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filtered.slice(startIndex, startIndex + rowsPerPage);
  }, [filtered, currentPage, rowsPerPage]);

  const isFiltered = query !== "" || classFilter !== "";

  const rangeStart = totalFiltered === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const rangeEnd =
    totalFiltered === 0 ? 0 : Math.min(currentPage * rowsPerPage, totalFiltered);

  const pageNumbers = useMemo(
    () => getPageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const handleEdit = useCallback((student: StudentData) => {
    setInlineSaveError(null);
    setInlineSaveSuccess(null);
    setEditClassSubjects([]);
    setEditSubjectIds([]);
    setEditingId(student.id);
    setEditValues({
      full_name: student.full_name,
      admission_number: student.admission_number,
      class_id: student.class_id,
      gender: student.gender,
      enrollment_date: student.enrollment_date,
      parent_name: student.parent_name,
      parent_email: student.parent_email,
      parent_phone: student.parent_phone,
    });
    setEditSubjectYear(currentAcademicYear());
    setEditSubjectTerm("Term 1");
  }, []);

  useEffect(() => {
    if (!editingId) return;
    const cid = (editValues.class_id ?? "").trim();
    if (!cid) return;
    let cancelled = false;
    setEditSubjectsLoading(true);
    void (async () => {
      const [opts, enrolled] = await Promise.all([
        getSubjectsForClass(cid),
        getStudentSubjects(editingId, editSubjectYear, editSubjectTerm),
      ]);
      if (cancelled) return;
      setEditClassSubjects(opts);
      const allow = new Set(opts.map((o) => o.id));
      setEditSubjectIds(
        enrolled.map((e) => e.subject_id).filter((id) => allow.has(id))
      );
      setEditSubjectsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId, editValues.class_id, editSubjectYear, editSubjectTerm]);

  function handleChange(field: string, value: string) {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  }

  function toggleEditSubject(subjectId: string, checked: boolean) {
    setEditSubjectIds((prev) => {
      if (checked) return prev.includes(subjectId) ? prev : [...prev, subjectId];
      return prev.filter((id) => id !== subjectId);
    });
  }

  const handleInlineSave = useCallback(async () => {
    if (!editingId) return;

    const fullName = (editValues.full_name ?? "").trim();
    const genderRaw = (editValues.gender ?? "").trim();

    setInlineSaveError(null);
    setInlineSaveSuccess(null);

    if (!fullName) {
      setInlineSaveError("Student name is required.");
      return;
    }
    if (genderRaw !== "male" && genderRaw !== "female") {
      setInlineSaveError("Please select male or female for gender.");
      return;
    }

    const enrollmentDateRaw = (editValues.enrollment_date ?? "").trim();
    if (!enrollmentDateRaw) {
      setInlineSaveError("Enrollment date is required.");
      return;
    }

    const classId = (editValues.class_id ?? "").trim();
    if (!classId) {
      setInlineSaveError("Please select a class.");
      return;
    }

    const fd = new FormData();
    fd.set("full_name", fullName);
    fd.set(
      "admission_number",
      (editValues.admission_number ?? "").trim()
    );
    fd.set("class_id", classId);
    fd.set("gender", genderRaw);
    fd.set("enrollment_date", (editValues.enrollment_date ?? "").trim());
    fd.set("parent_name", (editValues.parent_name ?? "").trim());
    fd.set("parent_email", (editValues.parent_email ?? "").trim());
    fd.set("parent_phone", (editValues.parent_phone ?? "").trim());

    setIsSaving(true);
    try {
      const result = await updateStudent(editingId, fd);
      if (result.error) {
        setInlineSaveError(result.error);
        return;
      }
      const subResult = await updateStudentSubjects(
        editingId,
        editSubjectIds,
        editSubjectYear,
        editSubjectTerm
      );
      if (subResult.error) {
        setInlineSaveError(
          `${result.success ?? "Student updated."} Subject enrolment: ${subResult.error}`
        );
        router.refresh();
        return;
      }
      setInlineSaveSuccess(
        [result.success, subResult.success].filter(Boolean).join(" ") ||
          "Student updated."
      );
      setEditingId(null);
      setEditValues({});
      setEditClassSubjects([]);
      setEditSubjectIds([]);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }, [
    editingId,
    editValues,
    editSubjectIds,
    editSubjectYear,
    editSubjectTerm,
    router,
  ]);

  function handleInlineCancel() {
    setEditingId(null);
    setEditValues({});
    setEditClassSubjects([]);
    setEditSubjectIds([]);
    setInlineSaveError(null);
    setInlineSaveSuccess(null);
  }

  useEffect(() => {
    if (!inlineSaveSuccess) return;
    const t = window.setTimeout(() => setInlineSaveSuccess(null), 4000);
    return () => window.clearTimeout(t);
  }, [inlineSaveSuccess]);

  return (
    <div>
      {/* Search, filter & row limit */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xl">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students…"
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pl-3 pr-10 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-64 sm:flex-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
          />
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:w-auto"
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="flex w-full items-center gap-2 sm:w-auto">
          <span className="shrink-0 text-sm text-gray-500 dark:text-zinc-400">
            Rows
          </span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:w-auto"
          >
            {ROW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        </div>
      </div>

      {/* Showing range */}
      <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
        Showing{" "}
        <span className="font-medium text-slate-900 dark:text-white">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        of{" "}
        <span className="font-medium text-slate-900 dark:text-white">
          {totalFiltered}
        </span>{" "}
        student{totalFiltered !== 1 ? "s" : ""}
        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setClassFilter("");
            }}
            className="ml-2 text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Clear filters
          </button>
        )}
      </p>

      {inlineSaveError ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {inlineSaveError}
        </p>
      ) : null}
      {inlineSaveSuccess ? (
        <p
          className="mt-2 text-sm text-emerald-600 dark:text-emerald-400"
          role="status"
        >
          {inlineSaveSuccess}
        </p>
      ) : null}

      {/* Results */}
      {filtered.length > 0 ? (
        <>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="max-h-[min(70vh,720px)] overflow-x-auto overflow-y-auto">
              <table className="w-full table-fixed border-collapse">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 [&_th]:bg-white dark:[&_th]:bg-zinc-900">
                  <tr>
                    <th className="w-[120px] px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-zinc-400">
                      ADM #
                    </th>
                    <th className="w-[220px] px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Student
                    </th>
                    <th className="w-[120px] px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Class
                    </th>
                    <th className="w-[72px] px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Subjects
                    </th>
                    <th className="w-[118px] px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Enrolled
                    </th>
                    <th className="w-[80px] px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Gender
                    </th>
                    <th className="w-[280px] px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-zinc-400">
                      Parent
                    </th>
                    <th className="sticky right-0 z-30 w-[112px] min-w-[112px] border-l border-slate-200 bg-white px-2 py-3 text-left text-sm font-medium text-gray-500 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.35)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {pageSlice.map((student) => (
                    <StudentRow
                      key={student.id}
                      student={student}
                      classes={classes}
                      editingId={editingId}
                      editValues={editValues}
                      onInlineEdit={handleEdit}
                      onInlineChange={handleChange}
                      onInlineSave={handleInlineSave}
                      onInlineCancel={handleInlineCancel}
                      isSaving={isSaving}
                      onDeleted={() => {
                        if (editingId === student.id) {
                          handleInlineCancel();
                        }
                        router.refresh();
                      }}
                      subjectEnrollmentEdit={
                        editingId === student.id
                          ? {
                              academicYear: editSubjectYear,
                              term: editSubjectTerm,
                              classSubjects: editClassSubjects,
                              selectedIds: editSubjectIds,
                              loading: editSubjectsLoading,
                              onYearChange: setEditSubjectYear,
                              onTermChange: setEditSubjectTerm,
                              onToggleSubject: toggleEditSubject,
                            }
                          : undefined
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Previous
              </button>

              <div className="flex flex-wrap items-center justify-center gap-1">
                {pageNumbers.map((item, idx) =>
                  item === "ellipsis" ? (
                    <span
                      key={`e-${idx}`}
                      className="px-2 text-sm text-slate-400 dark:text-zinc-500"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      className={`min-w-[2.25rem] rounded-md border px-3 py-1 text-sm dark:border-zinc-600 ${
                        currentPage === item
                          ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-gray-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {isFiltered
              ? "No students match your search."
              : "No students yet. Add your first student above."}
          </p>
        </div>
      )}
    </div>
  );
}
