"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  adminApproveReportCard,
  adminRequestChangesReportCard,
  getSubjectsForClass,
  reloadStudentsReportData,
  shareReportCardWithParent,
  submitReportCardForReview,
  upsertReportCardComment,
} from "./actions";
import {
  COMMENT_TEMPLATES,
  REPORT_CARD_EXAM_LABELS,
  REPORT_TERM_OPTIONS,
} from "./constants";
import type {
  PendingReportCardRow,
  StudentReportRow,
  TeacherClassOption,
} from "./report-card-types";
import { ReportCardPreview } from "./components/ReportCardPreview";
import type { ReportCardPreviewData } from "./report-card-preview-types";
import { buildSubjectPreviewRows } from "./report-card-preview-builder";
import {
  downloadBulkReportCardsPdf,
  downloadReportCardPdf,
} from "./components/ReportCardPDF";
import {
  computeReportCardTermAverage,
  letterGradeFromPercent,
} from "./report-card-grades";

type DraftRow = { comment: string; exam1: string; exam2: string };

function emptyDraftRow(): DraftRow {
  return { comment: "", exam1: "", exam2: "" };
}

function getDraftRow(
  store: Record<string, Record<string, DraftRow>>,
  studentId: string,
  subject: string
): DraftRow {
  return store[studentId]?.[subject] ?? emptyDraftRow();
}

function draftRowsEqual(a: DraftRow, b: DraftRow): boolean {
  return (
    a.comment === b.comment && a.exam1 === b.exam1 && a.exam2 === b.exam2
  );
}

function parseDraftPercent(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function draftAverageLine(exam1: string, exam2: string): {
  average: string;
  grade: string;
} {
  const e1 = parseDraftPercent(exam1);
  const e2 = parseDraftPercent(exam2);
  const avg = computeReportCardTermAverage(e1, e2);
  if (avg == null) return { average: "—", grade: "—" };
  return {
    average: `${avg}%`,
    grade: letterGradeFromPercent(avg),
  };
}

function statusLabel(
  s: string | null
): { short: string; banner: string } {
  switch (s) {
    case "pending_review":
      return {
        short: "Pending review",
        banner: "Pending head teacher approval — not for distribution.",
      };
    case "approved":
      return { short: "Approved", banner: "Approved — may be printed and shared." };
    case "changes_requested":
      return {
        short: "Changes requested",
        banner: "Head teacher requested changes — edit and resubmit.",
      };
    default:
      return { short: "Draft", banner: "Draft — save and submit when ready." };
  }
}

function toPreviewData(
  schoolName: string,
  logoUrl: string | null,
  className: string,
  teacherName: string,
  term: string,
  academicYear: string,
  subjects: string[],
  student: StudentReportRow,
  attendance: { present: number; absent: number; late: number }
): ReportCardPreviewData {
  const st = statusLabel(student.status);
  const issued = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
  }).format(new Date());
  return {
    schoolName,
    logoUrl,
    studentName: student.fullName,
    className,
    term,
    academicYear,
    teacherName,
    dateIssued: issued,
    statusLabel: st.banner,
    subjects: buildSubjectPreviewRows(term, subjects, student),
    attendance: {
      ...attendance,
      daysInTermLabel: "recorded sessions in this term window",
    },
  };
}

export function ReportCardsPageClient({
  schoolId,
  schoolName,
  logoUrl,
  teacherName,
  classes,
  pendingForAdmin,
  isSchoolAdmin,
}: {
  schoolId: string;
  schoolName: string;
  logoUrl: string | null;
  teacherName: string;
  classes: TeacherClassOption[];
  pendingForAdmin: PendingReportCardRow[];
  isSchoolAdmin: boolean;
}) {
  const [classId, setClassId] = useState(classes[0]?.classId ?? "");
  const selectedClass = classes.find((c) => c.classId === classId);
  const [academicYear, setAcademicYear] = useState(
    selectedClass?.academicYears[0] ?? ""
  );
  const [term, setTerm] =
    useState<(typeof REPORT_TERM_OPTIONS)[number]["value"]>("Term 1");

  useEffect(() => {
    if (term !== "Term 1" && term !== "Term 2") {
      setTerm("Term 1");
    }
  }, [term]);

  useEffect(() => {
    const c = classes.find((x) => x.classId === classId);
    if (c?.academicYears.length) {
      setAcademicYear((y) =>
        c.academicYears.includes(y) ? y : c.academicYears[0]
      );
    }
  }, [classId, classes]);

  const [subjects, setSubjects] = useState<string[]>([]);
  const [students, setStudents] = useState<StudentReportRow[]>([]);
  const [attendanceByStudent, setAttendanceByStudent] = useState<
    Record<string, { present: number; absent: number; late: number }>
  >({});
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, Record<string, DraftRow>>>(
    {}
  );
  const [baselineDrafts, setBaselineDrafts] = useState<
    Record<string, Record<string, DraftRow>>
  >({});

  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const baselineDraftsRef = useRef(baselineDrafts);
  baselineDraftsRef.current = baselineDrafts;
  const autosaveTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const greenBorderTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  const [manualSaveSubject, setManualSaveSubject] = useState<string | null>(
    null
  );
  const [manualSavedSubject, setManualSavedSubject] = useState<string | null>(
    null
  );
  const [saveError, setSaveError] = useState<{
    subject: string;
    message: string;
  } | null>(null);
  const [autosaveCheckSubject, setAutosaveCheckSubject] = useState<
    string | null
  >(null);
  const [greenBorderSubjects, setGreenBorderSubjects] = useState<
    Record<string, true>
  >({});

  const clearGreenBorderTimers = useCallback(() => {
    for (const k of Object.keys(greenBorderTimersRef.current)) {
      clearTimeout(greenBorderTimersRef.current[k]);
      delete greenBorderTimersRef.current[k];
    }
  }, []);

  const flashGreenBorder = useCallback((subject: string) => {
    const prev = greenBorderTimersRef.current[subject];
    if (prev) clearTimeout(prev);
    setGreenBorderSubjects((g) => ({ ...g, [subject]: true }));
    greenBorderTimersRef.current[subject] = setTimeout(() => {
      setGreenBorderSubjects((g) => {
        const next = { ...g };
        delete next[subject];
        return next;
      });
      delete greenBorderTimersRef.current[subject];
    }, 3000);
  }, []);

  const clearSubjectSaveFeedback = useCallback(() => {
    setManualSaveSubject(null);
    setManualSavedSubject(null);
    setSaveError(null);
    setAutosaveCheckSubject(null);
    setGreenBorderSubjects({});
    clearGreenBorderTimers();
  }, [clearGreenBorderTimers]);

  useEffect(() => {
    return () => clearGreenBorderTimers();
  }, [clearGreenBorderTimers]);

  useEffect(() => {
    clearSubjectSaveFeedback();
  }, [
    studentId,
    classId,
    term,
    academicYear,
    clearSubjectSaveFeedback,
  ]);

  const clearAutosaveTimers = useCallback(() => {
    for (const k of Object.keys(autosaveTimersRef.current)) {
      clearTimeout(autosaveTimersRef.current[k]);
      delete autosaveTimersRef.current[k];
    }
  }, []);

  useEffect(() => {
    return () => clearAutosaveTimers();
  }, [clearAutosaveTimers]);

  useEffect(() => {
    clearAutosaveTimers();
  }, [studentId, clearAutosaveTimers]);

  const load = useCallback(async () => {
    if (!classId) return;
    clearAutosaveTimers();
    setLoading(true);
    try {
      const subs = await getSubjectsForClass(classId);
      setSubjects(subs);
      const res = await reloadStudentsReportData(classId, term, academicYear);
      if (!res.ok) {
        toast.error(res.error);
        setStudents([]);
        return;
      }
      setStudents(res.students);
      setAttendanceByStudent(res.attendanceByStudent);
      const d: Record<string, Record<string, DraftRow>> = {};
      for (const s of res.students) {
        d[s.studentId] = {};
        for (const c of s.comments) {
          const legacySingle =
            c.exam1Score == null &&
            c.exam2Score == null &&
            c.scorePercent != null &&
            Number.isFinite(Number(c.scorePercent));
          d[s.studentId][c.subject] = {
            comment: c.comment ?? "",
            exam1:
              c.exam1Score != null
                ? String(c.exam1Score)
                : legacySingle
                  ? String(c.scorePercent)
                  : "",
            exam2:
              c.exam2Score != null ? String(c.exam2Score) : "",
          };
        }
      }
      setDrafts(d);
      setBaselineDrafts(JSON.parse(JSON.stringify(d)) as typeof d);
      setStudentId((prev) => {
        if (!res.students.length) return null;
        if (prev && res.students.some((x) => x.studentId === prev)) return prev;
        return res.students[0].studentId;
      });
    } finally {
      setLoading(false);
    }
  }, [classId, term, academicYear, clearAutosaveTimers]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedStudent = students.find((s) => s.studentId === studentId);

  const previewData = useMemo(() => {
    if (!selectedStudent || !selectedClass) return null;
    return toPreviewData(
      schoolName,
      logoUrl,
      selectedClass.className,
      teacherName,
      term,
      academicYear,
      subjects,
      selectedStudent,
      attendanceByStudent[selectedStudent.studentId] ?? {
        present: 0,
        absent: 0,
        late: 0,
      }
    );
  }, [
    selectedStudent,
    selectedClass,
    schoolName,
    logoUrl,
    teacherName,
    term,
    academicYear,
    subjects,
    attendanceByStudent,
  ]);

  const saveSubject = useCallback(
    async (
      subject: string,
      options?: { silent?: boolean }
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!selectedStudent || !selectedClass) {
        return { ok: false, error: "No student or class selected" };
      }
      const sid = selectedStudent.studentId;
      const row = getDraftRow(draftsRef.current, sid, subject);
      const snapshot: DraftRow = {
        comment: row.comment,
        exam1: row.exam1,
        exam2: row.exam2,
      };
      const e1 = parseDraftPercent(row.exam1);
      const e2 = parseDraftPercent(row.exam2);
      const res = await upsertReportCardComment({
        studentId: sid,
        classId: selectedClass.classId,
        schoolId,
        term,
        academicYear,
        subject,
        comment: row.comment.trim() || null,
        exam1Score: e1,
        exam2Score: e2,
      });
      if (!res.ok) {
        toast.error(res.error);
        return { ok: false, error: res.error };
      }
      setBaselineDrafts((prev) => ({
        ...prev,
        [sid]: {
          ...(prev[sid] ?? {}),
          [subject]: { ...snapshot },
        },
      }));
      setStudents((prev) =>
        prev.map((s) => {
          if (s.studentId !== sid) return s;
          const comments = [...s.comments];
          const ix = comments.findIndex((c) => c.subject === subject);
          if (ix >= 0) comments[ix] = res.comment;
          else comments.push(res.comment);
          return {
            ...s,
            reportCardId: res.reportCardId,
            comments,
          };
        })
      );
      return { ok: true };
    },
    [selectedStudent, selectedClass, schoolId, term, academicYear]
  );

  const scheduleAutosave = useCallback(
    (subject: string) => {
      if (!selectedStudent) return;
      const sid = selectedStudent.studentId;
      const key = `${sid}:${subject}`;
      const prev = autosaveTimersRef.current[key];
      if (prev) clearTimeout(prev);
      autosaveTimersRef.current[key] = setTimeout(() => {
        delete autosaveTimersRef.current[key];
        const cur = getDraftRow(draftsRef.current, sid, subject);
        const base = getDraftRow(baselineDraftsRef.current, sid, subject);
        if (!draftRowsEqual(cur, base)) {
          void (async () => {
            const result = await saveSubject(subject, { silent: true });
            if (result.ok) {
              const t = new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              toast.message(`Auto-saved at ${t}`, { duration: 2200 });
              setAutosaveCheckSubject(subject);
              window.setTimeout(() => {
                setAutosaveCheckSubject((s) => (s === subject ? null : s));
              }, 2000);
              flashGreenBorder(subject);
            }
          })();
        }
      }, 2000);
    },
    [selectedStudent, saveSubject, flashGreenBorder]
  );

  const hasUnsavedForSelected = useMemo(() => {
    if (!selectedStudent) return false;
    const subs = subjects.length > 0 ? subjects : ["General"];
    return subs.some(
      (subject) =>
        !draftRowsEqual(
          getDraftRow(drafts, selectedStudent.studentId, subject),
          getDraftRow(baselineDrafts, selectedStudent.studentId, subject)
        )
    );
  }, [drafts, baselineDrafts, selectedStudent, subjects]);

  const examLabelsForEditor = useMemo(() => {
    return term === "Term 1" || term === "Term 2"
      ? REPORT_CARD_EXAM_LABELS[term]
      : REPORT_CARD_EXAM_LABELS["Term 1"];
  }, [term]);

  const applyTemplate = (template: string) => {
    if (!selectedStudent || !subjects[0]) return;
    const sub = subjects[0];
    setDrafts((prev) => ({
      ...prev,
      [selectedStudent.studentId]: {
        ...prev[selectedStudent.studentId],
        [sub]: {
          comment: template,
          exam1: prev[selectedStudent.studentId]?.[sub]?.exam1 ?? "",
          exam2: prev[selectedStudent.studentId]?.[sub]?.exam2 ?? "",
        },
      },
    }));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700 dark:text-zinc-300">
            Class
          </span>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setStudentId(null);
            }}
            className="mt-1 w-full min-w-[12rem] rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          >
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700 dark:text-zinc-300">
            Academic year
          </span>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="mt-1 w-full min-w-[10rem] rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          >
            {(selectedClass?.academicYears ?? []).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700 dark:text-zinc-300">
            Term
          </span>
          <select
            value={term}
            onChange={(e) =>
              setTerm(e.target.value as (typeof REPORT_TERM_OPTIONS)[number]["value"])
            }
            className="mt-1 w-full min-w-[14rem] rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          >
            {REPORT_TERM_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">Loading class data…</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Students
          </h2>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
            {students.map((s) => (
              <li key={s.studentId}>
                <button
                  type="button"
                  onClick={() => setStudentId(s.studentId)}
                  className={`w-full rounded-lg px-2 py-1.5 text-left ${
                    studentId === s.studentId
                      ? "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100"
                      : "hover:bg-slate-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {s.fullName}
                  <span className="ml-2 text-xs text-slate-500">
                    {statusLabel(s.status).short}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Comment templates
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {COMMENT_TEMPLATES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  if (!selectedStudent || !subjects[0]) return;
                  applyTemplate(t);
                  scheduleAutosave(subjects[0]);
                  toast.message("Template inserted for first subject — edit as needed.");
                }}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {t.length > 36 ? `${t.slice(0, 34)}…` : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedStudent && selectedClass && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/30">
          <p className="text-xs text-slate-500 dark:text-zinc-500">
            Each subject auto-saves 2 seconds after you stop typing (or use Save).
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {selectedStudent.fullName}
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (hasUnsavedForSelected) {
                    const proceed = window.confirm(
                      "You have unsaved changes. Save before previewing?\n\n" +
                        "Click OK to preview with last saved data, or Cancel to stay and save."
                    );
                    if (!proceed) return;
                  }
                  setPreviewOpen(true);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                Preview report card
              </button>
              <button
                type="button"
                disabled={selectedStudent.status !== "approved"}
                onClick={() => {
                  if (!previewData) return;
                  const safe = selectedStudent.fullName
                    .replace(/[^\w\s-]/g, "")
                    .replace(/\s+/g, "-")
                    .slice(0, 40);
                  downloadReportCardPdf(previewData, safe);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900"
              >
                Download PDF
              </button>
              <button
                type="button"
                disabled={selectedStudent.status !== "approved"}
                onClick={async () => {
                  const res = await shareReportCardWithParent({
                    reportCardId: selectedStudent.reportCardId!,
                    parentEmail: selectedStudent.parentEmail ?? "",
                  });
                  if (res.ok) toast.success("Email sent to parent (if SMTP configured).");
                  else toast.error(res.error);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900"
              >
                Share with parent
              </button>
            </div>
          </div>

          {(subjects.length > 0 ? subjects : ["General"]).map((subject) => {
            const row = getDraftRow(
              drafts,
              selectedStudent.studentId,
              subject
            );
            const baselineRow = getDraftRow(
              baselineDrafts,
              selectedStudent.studentId,
              subject
            );
            const isDirty = !draftRowsEqual(row, baselineRow);
            const { average, grade } = draftAverageLine(row.exam1, row.exam2);
            const isSavingThis = manualSaveSubject === subject;
            const isSavedPulse = manualSavedSubject === subject;
            const showGreenBorder = !!greenBorderSubjects[subject];
            const hasSaveError = saveError?.subject === subject;
            const clearSaveErrorForSubject = () => {
              setSaveError((e) => (e?.subject === subject ? null : e));
            };
            return (
              <div
                key={subject}
                className={cn(
                  "rounded-lg border bg-white p-3 transition-[box-shadow,border-color] duration-300 dark:bg-zinc-950",
                  hasSaveError
                    ? "border-red-500 ring-2 ring-red-200/70 dark:border-red-600 dark:ring-red-900/50"
                    : showGreenBorder
                      ? "border-emerald-500 ring-2 ring-emerald-200/70 dark:border-emerald-600 dark:ring-emerald-900/50"
                      : isDirty
                        ? "border-amber-400 ring-2 ring-amber-300/60 dark:border-amber-600 dark:ring-amber-700/50"
                        : "border-slate-200 dark:border-zinc-600"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                    {subject}
                  </p>
                  {autosaveCheckSubject === subject ? (
                    <span
                      className="inline-flex items-center text-emerald-600 dark:text-emerald-400"
                      title="Auto-saved"
                    >
                      <Check
                        className="h-4 w-4 shrink-0"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                    </span>
                  ) : null}
                  {isDirty ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                      Unsaved
                    </span>
                  ) : null}
                </div>
                {hasSaveError && saveError ? (
                  <p
                    className="mt-1 text-xs font-medium text-red-600 dark:text-red-400"
                    role="alert"
                  >
                    {saveError.message}
                  </p>
                ) : null}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="text-slate-600 dark:text-zinc-400">
                      {examLabelsForEditor.exam1} (%)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={row.exam1}
                      onChange={(e) => {
                        clearSaveErrorForSubject();
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedStudent.studentId]: {
                            ...prev[selectedStudent.studentId],
                            [subject]: {
                              ...row,
                              exam1: e.target.value,
                            },
                          },
                        }));
                        scheduleAutosave(subject);
                      }}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-slate-600 dark:text-zinc-400">
                      {examLabelsForEditor.exam2} (%)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={row.exam2}
                      onChange={(e) => {
                        clearSaveErrorForSubject();
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedStudent.studentId]: {
                            ...prev[selectedStudent.studentId],
                            [subject]: {
                              ...row,
                              exam2: e.target.value,
                            },
                          },
                        }));
                        scheduleAutosave(subject);
                      }}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                    />
                  </label>
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                  Term average:{" "}
                  <span className="font-semibold tabular-nums">{average}</span>
                  {" · "}
                  Grade:{" "}
                  <span className="font-semibold tabular-nums">{grade}</span>
                  <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-zinc-500">
                    (Exam 1 + Exam 2) ÷ 2 when both scores are entered — same as
                    the report card.
                  </span>
                </p>
                <label className="mt-2 block text-sm">
                  <span className="text-slate-600 dark:text-zinc-400">
                    Teacher comment
                  </span>
                  <textarea
                    value={row.comment}
                    onChange={(e) => {
                      clearSaveErrorForSubject();
                      setDrafts((prev) => ({
                        ...prev,
                        [selectedStudent.studentId]: {
                          ...prev[selectedStudent.studentId],
                          [subject]: {
                            ...row,
                            comment: e.target.value,
                          },
                        },
                      }));
                      scheduleAutosave(subject);
                    }}
                    rows={2}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </label>
                <button
                  type="button"
                  disabled={isSavingThis}
                  onClick={async () => {
                    setSaveError(null);
                    setManualSaveSubject(subject);
                    const result = await saveSubject(subject);
                    setManualSaveSubject(null);
                    if (!result.ok) {
                      setSaveError({ subject, message: result.error });
                      return;
                    }
                    setManualSavedSubject(subject);
                    window.setTimeout(() => {
                      setManualSavedSubject((s) =>
                        s === subject ? null : s
                      );
                    }, 1600);
                    flashGreenBorder(subject);
                  }}
                  className={cn(
                    "mt-2 inline-flex min-h-[2.25rem] items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-white",
                    isSavingThis
                      ? "cursor-wait bg-indigo-500/85"
                      : "bg-indigo-600 hover:bg-indigo-500"
                  )}
                >
                  {isSavingThis ? (
                    <>
                      <Loader2
                        className="mr-2 h-4 w-4 shrink-0 animate-spin"
                        aria-hidden
                      />
                      Saving…
                    </>
                  ) : isSavedPulse ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="h-4 w-4 shrink-0" aria-hidden />
                      Saved!
                    </span>
                  ) : (
                    `Save ${subject}`
                  )}
                </button>
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              disabled={
                !selectedStudent.reportCardId ||
                selectedStudent.status === "pending_review"
              }
              onClick={async () => {
                if (!selectedStudent.reportCardId) return;
                const sid = selectedStudent.studentId;
                const res = await submitReportCardForReview(
                  selectedStudent.reportCardId
                );
                if (res.ok) {
                  toast.success("Submitted for head teacher review.");
                  setStudents((prev) =>
                    prev.map((s) =>
                      s.studentId === sid
                        ? { ...s, status: "pending_review" }
                        : s
                    )
                  );
                } else {
                  toast.error(res.error);
                }
              }}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              Submit for review
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Bulk export
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Downloads one PDF with a page per student. Only{" "}
          <strong>approved</strong> report cards are included.
        </p>
        <button
          type="button"
          disabled={
            !students.some((s) => s.status === "approved") || !selectedClass
          }
          onClick={() => {
            const approved = students.filter((s) => s.status === "approved");
            const items: ReportCardPreviewData[] = approved.map((s) =>
              toPreviewData(
                schoolName,
                logoUrl,
                selectedClass!.className,
                teacherName,
                term,
                academicYear,
                subjects,
                s,
                attendanceByStudent[s.studentId] ?? {
                  present: 0,
                  absent: 0,
                  late: 0,
                }
              )
            );
            const safe = selectedClass!.className
              .replace(/[^\w\s-]/g, "")
              .replace(/\s+/g, "-")
              .slice(0, 30);
            downloadBulkReportCardsPdf(items, safe);
          }}
          className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900"
        >
          Generate all report cards (PDF)
        </button>
      </div>

      {isSchoolAdmin && pendingForAdmin.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="text-base font-semibold text-amber-950 dark:text-amber-100">
            Pending review (head teacher)
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {pendingForAdmin.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 dark:border-amber-800 dark:bg-zinc-900"
              >
                <span>
                  {p.studentName} — {p.className} ({p.term}, {p.academicYear})
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await adminApproveReportCard(p.id);
                      if (res.ok) toast.success("Approved.");
                      else toast.error(res.error);
                      window.location.reload();
                    }}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const note = window.prompt(
                        "Note for teacher (optional):",
                        ""
                      );
                      if (note === null) return;
                      const res = await adminRequestChangesReportCard(p.id, note);
                      if (res.ok) toast.success("Sent back for changes.");
                      else toast.error(res.error);
                      window.location.reload();
                    }}
                    className="rounded bg-slate-600 px-2 py-1 text-xs font-medium text-white hover:bg-slate-500"
                  >
                    Request changes
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {previewOpen && previewData && (
        <div
          className="fixed inset-0 z-[200] overflow-y-auto bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-auto max-w-4xl py-6">
            <div className="mb-3 flex justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium shadow"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium shadow"
              >
                Close
              </button>
            </div>
            <div className="print:bg-white">
              <ReportCardPreview data={previewData} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
