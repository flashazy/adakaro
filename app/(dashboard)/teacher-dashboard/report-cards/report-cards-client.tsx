"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminApproveReportCard,
  adminRequestChangesReportCard,
  getSubjectsForClass,
  reloadStudentsReportData,
  shareReportCardWithParent,
  submitReportCardForReview,
  upsertReportCardComment,
} from "./actions";
import { COMMENT_TEMPLATES, REPORT_TERM_OPTIONS } from "./constants";
import type {
  PendingReportCardRow,
  StudentReportRow,
  TeacherClassOption,
} from "./report-card-types";
import { ReportCardPreview, type ReportCardPreviewData } from "./components/ReportCardPreview";
import {
  downloadBulkReportCardsPdf,
  downloadReportCardPdf,
} from "./components/ReportCardPDF";

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

function buildSubjectRows(
  subjects: string[],
  student: StudentReportRow
): ReportCardPreviewData["subjects"] {
  const bySub = new Map(
    student.comments.map((c) => [c.subject, c])
  );
  const list = subjects.length
    ? subjects
    : [...new Set(student.comments.map((c) => c.subject))];
  return list.map((subject) => {
    const c = bySub.get(subject);
    const pct =
      c?.scorePercent != null && Number.isFinite(c.scorePercent)
        ? `${Math.round(c.scorePercent * 10) / 10}%`
        : "—";
    const g = c?.letterGrade?.trim() || "—";
    return {
      subject,
      scorePct: pct,
      grade: g,
      comment: c?.comment?.trim() ?? "",
    };
  });
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
    subjects: buildSubjectRows(subjects, student),
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

  const [drafts, setDrafts] = useState<
    Record<string, Record<string, { comment: string; score: string }>>
  >({});

  const load = useCallback(async () => {
    if (!classId) return;
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
      const d: typeof drafts = {};
      for (const s of res.students) {
        d[s.studentId] = {};
        for (const c of s.comments) {
          d[s.studentId][c.subject] = {
            comment: c.comment ?? "",
            score:
              c.scorePercent != null ? String(c.scorePercent) : "",
          };
        }
      }
      setDrafts(d);
      setStudentId((prev) => {
        if (!res.students.length) return null;
        if (prev && res.students.some((x) => x.studentId === prev)) return prev;
        return res.students[0].studentId;
      });
    } finally {
      setLoading(false);
    }
  }, [classId, term, academicYear]);

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

  const saveSubject = async (subject: string) => {
    if (!selectedStudent || !selectedClass) return;
    const row = drafts[selectedStudent.studentId]?.[subject] ?? {
      comment: "",
      score: "",
    };
    const scoreNum = row.score.trim() === "" ? null : Number(row.score);
    const res = await upsertReportCardComment({
      studentId: selectedStudent.studentId,
      classId: selectedClass.classId,
      schoolId,
      term,
      academicYear,
      subject,
      comment: row.comment.trim() || null,
      scorePercent:
        scoreNum != null && Number.isFinite(scoreNum) ? scoreNum : null,
    });
    if (!res.ok) toast.error(res.error);
    else toast.success("Saved");
    await load();
  };

  const applyTemplate = (template: string) => {
    if (!selectedStudent || !subjects[0]) return;
    const sub = subjects[0];
    setDrafts((prev) => ({
      ...prev,
      [selectedStudent.studentId]: {
        ...prev[selectedStudent.studentId],
        [sub]: {
          comment: template,
          score: prev[selectedStudent.studentId]?.[sub]?.score ?? "",
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
                  if (!selectedStudent) return;
                  applyTemplate(t);
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {selectedStudent.fullName}
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
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
            const row =
              drafts[selectedStudent.studentId]?.[subject] ?? {
                comment: "",
                score: "",
              };
            return (
              <div
                key={subject}
                className="rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-950"
              >
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                  {subject}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <label className="text-sm sm:col-span-1">
                    <span className="text-slate-600 dark:text-zinc-400">
                      Score % (optional)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={row.score}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedStudent.studentId]: {
                            ...prev[selectedStudent.studentId],
                            [subject]: {
                              ...row,
                              score: e.target.value,
                            },
                          },
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className="text-slate-600 dark:text-zinc-400">
                      Teacher comment
                    </span>
                    <textarea
                      value={row.comment}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [selectedStudent.studentId]: {
                            ...prev[selectedStudent.studentId],
                            [subject]: {
                              ...row,
                              comment: e.target.value,
                            },
                          },
                        }))
                      }
                      rows={2}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void saveSubject(subject)}
                  className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Save {subject}
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
                const res = await submitReportCardForReview(
                  selectedStudent.reportCardId
                );
                if (res.ok) toast.success("Submitted for head teacher review.");
                else toast.error(res.error);
                await load();
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
