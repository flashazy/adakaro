"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";
import type {
  ClassTeacherAttendanceRow,
  ClassTeacherGradeRow,
  ClassTeacherStudentParentRow,
} from "./class-teacher-table-types";

const ROW_OPTIONS = [5, 10, 25, 50] as const;
type RowOption = (typeof ROW_OPTIONS)[number];

function matchesHaystack(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle);
}

function PaginationBar(props: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  const { page, totalPages, onPage } = props;
  const items = getCompactPaginationItems(page, totalPages);
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-zinc-800 sm:px-4">
      <button
        type="button"
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Previous
      </button>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {items.map((p, idx) =>
          p === "ellipsis" ? (
            <span
              key={`e-${idx}`}
              className="px-2 text-xs text-slate-400 dark:text-zinc-500"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
              className={`min-w-[2rem] rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                p === page
                  ? "bg-school-primary text-white shadow-sm hover:brightness-105"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button
        type="button"
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Next
      </button>
    </div>
  );
}

function TableToolbar(props: {
  searchId: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (v: string) => void;
  rowsPerPage: RowOption;
  onRowsPerPage: (n: RowOption) => void;
  summary: ReactNode;
}) {
  const {
    searchId,
    searchPlaceholder,
    query,
    onQueryChange,
    rowsPerPage,
    onRowsPerPage,
    summary,
  } = props;
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-zinc-800 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 3.38 9.85l3.39 3.39a.75.75 0 1 0 1.06-1.06l-3.39-3.39A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
            clipRule="evenodd"
          />
        </svg>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <span>Rows</span>
          <select
            value={rowsPerPage}
            onChange={(e) => onRowsPerPage(Number(e.target.value) as RowOption)}
            aria-label="Rows per page"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          >
            {ROW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-500 dark:text-zinc-400">{summary}</p>
      </div>
    </div>
  );
}

const CLASS_TEACHER_SECTION_STORAGE = {
  students: "classTeacher-studentsSection",
  attendance: "classTeacher-attendanceSection",
  marks: "classTeacher-marksSection",
} as const;

function ClassTeacherCollapsibleSection(props: {
  sectionDomId: string;
  storageKey: string;
  headingId: string;
  panelId: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const {
    sectionDomId,
    storageKey,
    headingId,
    panelId,
    title,
    description,
    children,
  } = props;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === "false") setExpanded(false);
      else if (raw === "true") setExpanded(true);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? "true" : "false");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <section
      id={sectionDomId}
      className="scroll-mt-24 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          <button
            type="button"
            id={headingId}
            onClick={toggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/80"
          >
            <span className="min-w-0 flex-1">
              <span className="block">{title}</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-zinc-400">
                {description}
              </span>
            </span>
            <span
              aria-hidden
              className="inline-flex shrink-0 justify-center text-slate-600 dark:text-zinc-300"
            >
              {expanded ? (
                <ChevronDown className="h-5 w-5" strokeWidth={2.25} />
              ) : (
                <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
              )}
            </span>
          </button>
        </h2>
      </div>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headingId}
        hidden={!expanded}
      >
        {children}
      </div>
    </section>
  );
}

function ScrollTableWithOverlay(props: {
  children: ReactNode;
  isFiltering: boolean;
}) {
  return (
    <div className="relative max-h-[28rem] overflow-auto overflow-x-auto">
      {props.isFiltering ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-zinc-950/60"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-md dark:bg-zinc-900 dark:text-zinc-300">
            Updating…
          </span>
        </div>
      ) : null}
      {props.children}
    </div>
  );
}

export function ClassTeacherClassDetailTablesClient(props: {
  students: ClassTeacherStudentParentRow[];
  attendance: ClassTeacherAttendanceRow[];
  grades: ClassTeacherGradeRow[];
}) {
  const { students, attendance, grades } = props;

  /* ── Students ─────────────────────────────────────────── */
  const [studentQuery, setStudentQuery] = useState("");
  const deferredStudentQuery = useDeferredValue(studentQuery);
  const [studentPage, setStudentPage] = useState(1);
  const [studentRows, setStudentRows] = useState<RowOption>(5);

  const filteredStudents = useMemo(() => {
    const q = deferredStudentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const hay = [
        s.studentName,
        s.admissionNumber ?? "",
        s.parentName,
        s.parentPhone ?? "",
        s.parentEmail ?? "",
      ].join(" ");
      return matchesHaystack(hay, q);
    });
  }, [students, deferredStudentQuery]);

  const studentTotalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / studentRows)
  );
  const safeStudentPage = Math.min(studentPage, studentTotalPages);

  useEffect(() => {
    setStudentPage((p) => Math.min(p, studentTotalPages));
  }, [studentTotalPages]);

  useEffect(() => {
    setStudentPage(1);
  }, [deferredStudentQuery, studentRows]);

  const studentSlice = useMemo(() => {
    const start = (safeStudentPage - 1) * studentRows;
    return filteredStudents.slice(start, start + studentRows);
  }, [filteredStudents, safeStudentPage, studentRows]);

  const studentStart =
    filteredStudents.length === 0 ? 0 : (safeStudentPage - 1) * studentRows + 1;
  const studentEnd =
    filteredStudents.length === 0
      ? 0
      : Math.min(
          safeStudentPage * studentRows,
          filteredStudents.length
        );

  const studentStale =
    studentQuery.trim() !== deferredStudentQuery.trim();

  /* ── Attendance ───────────────────────────────────────── */
  const [attQuery, setAttQuery] = useState("");
  const deferredAttQuery = useDeferredValue(attQuery);
  const [attPage, setAttPage] = useState(1);
  const [attRows, setAttRows] = useState<RowOption>(5);

  const filteredAtt = useMemo(() => {
    const q = deferredAttQuery.trim().toLowerCase();
    if (!q) return attendance;
    return attendance.filter((a) => {
      const hay = [
        a.studentName,
        a.subjectName,
        a.status,
        a.recordedByName ?? "",
      ].join(" ");
      return matchesHaystack(hay, q);
    });
  }, [attendance, deferredAttQuery]);

  const attTotalPages = Math.max(1, Math.ceil(filteredAtt.length / attRows));
  const safeAttPage = Math.min(attPage, attTotalPages);

  useEffect(() => {
    setAttPage((p) => Math.min(p, attTotalPages));
  }, [attTotalPages]);

  useEffect(() => {
    setAttPage(1);
  }, [deferredAttQuery, attRows]);

  const attSlice = useMemo(() => {
    const start = (safeAttPage - 1) * attRows;
    return filteredAtt.slice(start, start + attRows);
  }, [filteredAtt, safeAttPage, attRows]);

  const attStart =
    filteredAtt.length === 0 ? 0 : (safeAttPage - 1) * attRows + 1;
  const attEnd =
    filteredAtt.length === 0
      ? 0
      : Math.min(safeAttPage * attRows, filteredAtt.length);

  const attStale = attQuery.trim() !== deferredAttQuery.trim();

  /* ── Grades ───────────────────────────────────────────── */
  const [gradeQuery, setGradeQuery] = useState("");
  const deferredGradeQuery = useDeferredValue(gradeQuery);
  const [gradePage, setGradePage] = useState(1);
  const [gradeRows, setGradeRows] = useState<RowOption>(5);

  const filteredGrades = useMemo(() => {
    const q = deferredGradeQuery.trim().toLowerCase();
    if (!q) return grades;
    return grades.filter((g) => {
      const hay = [
        g.studentName,
        g.subject,
        g.assignmentTitle,
        g.teacherName ?? "",
      ].join(" ");
      return matchesHaystack(hay, q);
    });
  }, [grades, deferredGradeQuery]);

  const gradeTotalPages = Math.max(
    1,
    Math.ceil(filteredGrades.length / gradeRows)
  );
  const safeGradePage = Math.min(gradePage, gradeTotalPages);

  useEffect(() => {
    setGradePage((p) => Math.min(p, gradeTotalPages));
  }, [gradeTotalPages]);

  useEffect(() => {
    setGradePage(1);
  }, [deferredGradeQuery, gradeRows]);

  const gradeSlice = useMemo(() => {
    const start = (safeGradePage - 1) * gradeRows;
    return filteredGrades.slice(start, start + gradeRows);
  }, [filteredGrades, safeGradePage, gradeRows]);

  const gradeStart =
    filteredGrades.length === 0 ? 0 : (safeGradePage - 1) * gradeRows + 1;
  const gradeEnd =
    filteredGrades.length === 0
      ? 0
      : Math.min(safeGradePage * gradeRows, filteredGrades.length);

  const gradeStale = gradeQuery.trim() !== deferredGradeQuery.trim();

  return (
    <>
      <ClassTeacherCollapsibleSection
        sectionDomId="students"
        storageKey={CLASS_TEACHER_SECTION_STORAGE.students}
        headingId="class-teacher-students-heading"
        panelId="class-teacher-students-panel"
        title="Students and guardian contacts"
        description="Linked parents or guardians from the school directory."
      >
        <TableToolbar
          searchId="class-teacher-students-search"
          searchPlaceholder="Search students, admission, guardians…"
          query={studentQuery}
          onQueryChange={setStudentQuery}
          rowsPerPage={studentRows}
          onRowsPerPage={setStudentRows}
          summary={
            filteredStudents.length === 0
              ? "Showing 0 of 0 students"
              : `Showing ${studentStart}–${studentEnd} of ${filteredStudents.length} students`
          }
        />
        <ScrollTableWithOverlay isFiltering={studentStale}>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Student</th>
                <th className="px-4 py-2">Admission</th>
                <th className="px-4 py-2">Guardian name(s)</th>
                <th className="px-4 py-2">Phone</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {students.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500 dark:text-zinc-400"
                  >
                    No active students in this class.
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500 dark:text-zinc-400"
                  >
                    No students match your search.
                  </td>
                </tr>
              ) : (
                studentSlice.map((s) => (
                  <tr key={s.studentId}>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                      {s.studentName}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-zinc-300">
                      {s.admissionNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-zinc-300">
                      {s.parentName}
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-zinc-300">
                      {s.parentPhone ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-zinc-300">
                      {s.parentEmail ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-center align-middle">
                      {s.linkedParentId ? (
                        <Link
                          href={`/teacher-dashboard/class-teacher/messages?parentId=${encodeURIComponent(s.linkedParentId)}&studentName=${encodeURIComponent(s.studentName)}`}
                          className="inline-flex min-h-[2.25rem] min-w-[2.25rem] items-center justify-center rounded-lg text-lg leading-none text-school-primary transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary dark:text-school-primary"
                          aria-label="Send message to parent"
                          title="Send message to parent"
                        >
                          <span aria-hidden>💬</span>
                        </Link>
                      ) : (
                        <span
                          role="img"
                          className="inline-flex min-h-[2.25rem] min-w-[2.25rem] cursor-not-allowed select-none items-center justify-center rounded-lg text-lg leading-none text-slate-300 dark:text-zinc-600"
                          aria-label="No parent linked to this student"
                          title="No parent linked to this student"
                        >
                          🔕
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollTableWithOverlay>
        <PaginationBar
          page={safeStudentPage}
          totalPages={studentTotalPages}
          onPage={setStudentPage}
        />
      </ClassTeacherCollapsibleSection>

      <ClassTeacherCollapsibleSection
        sectionDomId="attendance"
        storageKey={CLASS_TEACHER_SECTION_STORAGE.attendance}
        headingId="class-teacher-attendance-heading"
        panelId="class-teacher-attendance-panel"
        title="Attendance (all subjects)"
        description="Recent records from all teachers for this class."
      >
        <TableToolbar
          searchId="class-teacher-attendance-search"
          searchPlaceholder="Search student, subject, status, recorded by…"
          query={attQuery}
          onQueryChange={setAttQuery}
          rowsPerPage={attRows}
          onRowsPerPage={setAttRows}
          summary={
            filteredAtt.length === 0
              ? "Showing 0 of 0 records"
              : `Showing ${attStart}–${attEnd} of ${filteredAtt.length} records`
          }
        />
        <ScrollTableWithOverlay isFiltering={attStale}>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Student</th>
                <th className="px-4 py-2">Subject / scope</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Recorded by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {attendance.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500 dark:text-zinc-400"
                  >
                    No attendance rows yet.
                  </td>
                </tr>
              ) : filteredAtt.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500 dark:text-zinc-400"
                  >
                    No records match your search.
                  </td>
                </tr>
              ) : (
                attSlice.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-800 dark:text-zinc-200">
                      {a.attendanceDate}
                    </td>
                    <td className="px-4 py-2 text-slate-800 dark:text-zinc-200">
                      {a.studentName}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-zinc-300">
                      {a.subjectName}
                    </td>
                    <td className="px-4 py-2 capitalize text-slate-700 dark:text-zinc-300">
                      {a.status}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-zinc-400">
                      {a.recordedByName ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollTableWithOverlay>
        <PaginationBar
          page={safeAttPage}
          totalPages={attTotalPages}
          onPage={setAttPage}
        />
      </ClassTeacherCollapsibleSection>

      <ClassTeacherCollapsibleSection
        sectionDomId="grades"
        storageKey={CLASS_TEACHER_SECTION_STORAGE.marks}
        headingId="class-teacher-marks-heading"
        panelId="class-teacher-marks-panel"
        title="Marks (read-only)"
        description="Gradebook entries from all subject teachers for this class."
      >
        <TableToolbar
          searchId="class-teacher-grades-search"
          searchPlaceholder="Search student, subject, assignment, teacher…"
          query={gradeQuery}
          onQueryChange={setGradeQuery}
          rowsPerPage={gradeRows}
          onRowsPerPage={setGradeRows}
          summary={
            filteredGrades.length === 0
              ? "Showing 0 of 0 entries"
              : `Showing ${gradeStart}–${gradeEnd} of ${filteredGrades.length} entries`
          }
        />
        <ScrollTableWithOverlay isFiltering={gradeStale}>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Student</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Assignment</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Teacher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {grades.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500 dark:text-zinc-400"
                  >
                    No markbook scores recorded yet.
                  </td>
                </tr>
              ) : filteredGrades.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500 dark:text-zinc-400"
                  >
                    No entries match your search.
                  </td>
                </tr>
              ) : (
                gradeSlice.map((g, idx) => (
                  <tr
                    key={`${g.studentName}-${g.assignmentTitle}-${(safeGradePage - 1) * gradeRows + idx}`}
                  >
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                      {g.studentName}
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-zinc-300">
                      {g.subject}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-zinc-400">
                      {g.assignmentTitle}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-800 dark:text-zinc-200">
                      {g.score != null ? `${g.score} / ${g.maxScore}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-zinc-400">
                      {g.teacherName ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollTableWithOverlay>
        <PaginationBar
          page={safeGradePage}
          totalPages={gradeTotalPages}
          onPage={setGradePage}
        />
      </ClassTeacherCollapsibleSection>
    </>
  );
}
