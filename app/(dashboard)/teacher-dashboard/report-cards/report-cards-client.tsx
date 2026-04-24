"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import {
  adminApproveReportCard,
  adminRequestChangesReportCard,
  fetchStudentExamScores,
  reloadStudentsReportData,
  shareReportCardWithParent,
  submitReportCardForReview,
  upsertReportCardComment,
} from "./actions";
import {
  fetchReportCardSupplementaryForClassTeachers,
  getReportCardSubjectsForStudent,
  getSubjectsForClass,
} from "./queries-actions";
import {
  COMMENT_TEMPLATES,
  REPORT_CARD_EXAM_LABELS,
  REPORT_TERM_OPTIONS,
} from "./constants";
import type {
  PendingReportCardRow,
  ReportCardCommentRow,
  ReportCardSubjectFilterOption,
  StudentReportRow,
  TeacherClassOption,
} from "./report-card-types";
import { ReportCardPreview } from "./components/ReportCardPreview";
import type {
  ReportCardPreviewData,
  ReportCardSupplementaryPreviewSlice,
} from "./report-card-preview-types";
import {
  buildSubjectPreviewRows,
  computeClassSubjectPositions,
  computeReportCardStudentSummary,
  mergeStudentCommentsWithDraftsForPreview,
} from "./report-card-preview-builder";
import type { SchoolLevel } from "@/lib/school-level";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";
import {
  parseStudentListRowsPerPage,
  STUDENT_LIST_ROW_OPTIONS,
  TEACHER_REPORT_CARDS_STUDENT_LIST_ROWS_STORAGE_KEY,
  type StudentListRowOption,
} from "@/lib/student-list-pagination";
import {
  downloadBulkReportCardsPdf,
  downloadReportCardPdf,
} from "./components/ReportCardPDF";
import {
  computeReportCardTermAverage,
  letterGradeFromPercent,
} from "./report-card-grades";

type DraftRow = {
  comment: string;
  exam1: string;
  exam2: string;
  /** Gradebook % snapshot when this exam was autofilled (for override note / save). */
  exam1GbOriginal: string | null;
  exam2GbOriginal: string | null;
  exam1Locked: boolean;
  exam2Locked: boolean;
  exam1Overridden: boolean;
  exam2Overridden: boolean;
};

function emptyDraftRow(): DraftRow {
  return {
    comment: "",
    exam1: "",
    exam2: "",
    exam1GbOriginal: null,
    exam2GbOriginal: null,
    exam1Locked: false,
    exam2Locked: false,
    exam1Overridden: false,
    exam2Overridden: false,
  };
}

function draftFromComment(c: ReportCardCommentRow): DraftRow {
  const legacySingle =
    c.exam1Score == null &&
    c.exam2Score == null &&
    c.scorePercent != null &&
    Number.isFinite(Number(c.scorePercent));
  return {
    comment: c.comment ?? "",
    exam1:
      c.exam1Score != null
        ? String(c.exam1Score)
        : legacySingle
          ? String(c.scorePercent)
          : "",
    exam2: c.exam2Score != null ? String(c.exam2Score) : "",
    exam1GbOriginal:
      c.exam1GradebookOriginal != null
        ? String(c.exam1GradebookOriginal)
        : null,
    exam2GbOriginal:
      c.exam2GradebookOriginal != null
        ? String(c.exam2GradebookOriginal)
        : null,
    exam1Locked: false,
    exam2Locked: false,
    exam1Overridden: c.exam1ScoreOverridden === true,
    exam2Overridden: c.exam2ScoreOverridden === true,
  };
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
    a.comment === b.comment &&
    a.exam1 === b.exam1 &&
    a.exam2 === b.exam2 &&
    a.exam1GbOriginal === b.exam1GbOriginal &&
    a.exam2GbOriginal === b.exam2GbOriginal &&
    a.exam1Locked === b.exam1Locked &&
    a.exam2Locked === b.exam2Locked &&
    a.exam1Overridden === b.exam1Overridden &&
    a.exam2Overridden === b.exam2Overridden
  );
}

function parseDraftPercent(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Match gradebook payload to class subject label (case / spacing). */
function gradebookScoresForSubject(
  scoresBySubject: Record<
    string,
    {
      aprilMidtermPct: number | null;
      juneTerminalPct: number | null;
      septemberMidtermPct: number | null;
      decemberAnnualPct: number | null;
    }
  >,
  subject: string
) {
  const t = subject.trim();
  if (scoresBySubject[t]) return scoresBySubject[t];
  const key = Object.keys(scoresBySubject).find(
    (k) => k.trim().toLowerCase() === t.toLowerCase()
  );
  return key ? scoresBySubject[key] : undefined;
}

function draftAverageLine(
  exam1: string,
  exam2: string,
  schoolLevel: SchoolLevel
): {
  average: string;
  grade: string;
} {
  const e1 = parseDraftPercent(exam1);
  const e2 = parseDraftPercent(exam2);
  const avg = computeReportCardTermAverage(e1, e2);
  if (avg == null) return { average: "—", grade: "—" };
  return {
    average: `${avg}%`,
    grade: letterGradeFromPercent(avg, schoolLevel),
  };
}

// Includes both F (secondary failing band) and E (primary failing band) so the
// auto-comment lookup works for either grading tier without extra branching.
const GRADE_AUTO_COMMENTS: Record<string, string> = {
  A: "Excellent performance, keep it up",
  B: "Very good, keep working hard",
  C: "Good, but there is room for improvement",
  D: "Average, needs to put more effort",
  E: "Below expectation, needs serious improvement",
  F: "Failure, requires serious improvement",
};

/** Suggested comment from term letter grade; null if grade not available. */
function autoCommentFromGrades(
  exam1: string,
  exam2: string,
  schoolLevel: SchoolLevel
): string | null {
  const { grade } = draftAverageLine(exam1, exam2, schoolLevel);
  if (!grade || grade === "—") return null;
  return GRADE_AUTO_COMMENTS[grade] ?? null;
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

function toPreviewData(args: {
  schoolName: string;
  schoolMotto?: string | null;
  logoUrl: string | null;
  schoolStampUrl?: string | null;
  schoolLevel: SchoolLevel;
  className: string;
  teacherName: string;
  /**
   * True when the teacher named on this card holds the Coordinator role for
   * the class — drives the "Class Coordinator" vs. "Class teacher" label.
   */
  teacherIsCoordinator: boolean;
  term: string;
  academicYear: string;
  subjects: string[];
  student: StudentReportRow;
  attendance: { present: number; absent: number; late: number };
  /** Per-subject ranks for this student, keyed by subject name. */
  positionBySubject?: Record<string, string>;
  /**
   * Cohort used to compute the footer summary (rank + total/avg). Pass the
   * full class so position-out-of-N matches what the table shows.
   */
  cohort?: StudentReportRow[];
}): ReportCardPreviewData {
  const st = statusLabel(args.student.status);
  const issued = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
  }).format(new Date());
  const cohort = args.cohort ?? [args.student];
  const summary = computeReportCardStudentSummary({
    allStudents: cohort,
    subjects: args.subjects,
    focusStudentId: args.student.studentId,
    schoolLevel: args.schoolLevel,
    studentName: args.student.fullName,
    term: args.term,
    academicYear: args.academicYear,
  });
  const mottoTrim = (args.schoolMotto ?? "").trim();
  return {
    schoolName: args.schoolName,
    schoolMotto: mottoTrim ? mottoTrim : null,
    logoUrl: args.logoUrl,
    schoolStampUrl: args.schoolStampUrl?.trim() || null,
    studentName: args.student.fullName,
    className: args.className,
    term: args.term,
    academicYear: args.academicYear,
    teacherName: args.teacherName,
    teacherIsCoordinator: args.teacherIsCoordinator,
    dateIssued: issued,
    statusLabel: st.banner,
    subjects: buildSubjectPreviewRows(
      args.term,
      args.subjects,
      args.student,
      args.positionBySubject,
      summary.selectedSubjects,
      args.schoolLevel
    ),
    attendance: {
      ...args.attendance,
      daysInTermLabel: "recorded sessions in this term window",
    },
    summary,
  };
}

export function ReportCardsPageClient({
  schoolId,
  schoolName,
  schoolMotto,
  schoolLevel,
  logoUrl,
  schoolStampUrl,
  teacherName,
  classes,
  pendingForAdmin,
  isSchoolAdmin,
}: {
  schoolId: string;
  schoolName: string;
  schoolMotto: string | null;
  schoolLevel: SchoolLevel;
  logoUrl: string | null;
  schoolStampUrl: string | null;
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
  /** Subjects shown for the selected student (enrolment-filtered when data exists). */
  const [displaySubjects, setDisplaySubjects] = useState<string[]>([]);
  const [students, setStudents] = useState<StudentReportRow[]>([]);
  const [supplementaryByStudentId, setSupplementaryByStudentId] = useState<
    Record<string, ReportCardSupplementaryPreviewSlice>
  >({});
  const [attendanceByStudent, setAttendanceByStudent] = useState<
    Record<string, { present: number; absent: number; late: number }>
  >({});
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentListSearch, setStudentListSearch] = useState("");
  const [studentListPage, setStudentListPage] = useState(1);
  const [studentListRowsPerPage, setStudentListRowsPerPage] =
    useState<StudentListRowOption>(5);
  const [subjectFilterOptions, setSubjectFilterOptions] = useState<
    ReportCardSubjectFilterOption[]
  >([]);
  const [reportSubjectFilterId, setReportSubjectFilterId] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUnsavedConfirmOpen, setPreviewUnsavedConfirmOpen] =
    useState(false);

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
    const stored = parseStudentListRowsPerPage(
      localStorage.getItem(TEACHER_REPORT_CARDS_STUDENT_LIST_ROWS_STORAGE_KEY)
    );
    if (stored != null) setStudentListRowsPerPage(stored);
  }, []);

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
      setSupplementaryByStudentId({});
      const subs = await getSubjectsForClass(classId);
      setSubjects(subs);
      const res = await reloadStudentsReportData(
        classId,
        term,
        academicYear,
        reportSubjectFilterId.trim() || undefined
      );
      if (!res.ok) {
        toast.error(res.error);
        setStudents([]);
        setSupplementaryByStudentId({});
        setSubjectFilterOptions([]);
        setReportSubjectFilterId("");
        return;
      }
      setSubjectFilterOptions(res.subjectFilterOptions);
      setStudents(res.students);
      const sup = await fetchReportCardSupplementaryForClassTeachers({
        classId,
        schoolId,
        term,
        academicYear,
        studentIds: res.students.map((s) => s.studentId),
      });
      setSupplementaryByStudentId(sup);
      setAttendanceByStudent(res.attendanceByStudent);
      const d: Record<string, Record<string, DraftRow>> = {};
      for (const s of res.students) {
        d[s.studentId] = {};
        for (const c of s.comments) {
          d[s.studentId][c.subject] = draftFromComment(c);
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
  }, [
    classId,
    term,
    academicYear,
    reportSubjectFilterId,
    clearAutosaveTimers,
    schoolId,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDisplaySubjects(subjects);
  }, [subjects]);

  useEffect(() => {
    if (!studentId) {
      setDisplaySubjects(subjects);
      return;
    }
    if (!classId || subjects.length === 0) return;
    let cancelled = false;
    void getReportCardSubjectsForStudent({
      classId,
      studentId,
      term,
      academicYear,
      allSubjects: subjects,
    }).then((r) => {
      if (cancelled) return;
      if (r.ok && r.subjects.length > 0) setDisplaySubjects(r.subjects);
      else setDisplaySubjects(subjects);
    });
    return () => {
      cancelled = true;
    };
  }, [classId, studentId, term, academicYear, subjects]);

  const previewSubjectList = useMemo(() => {
    const list =
      displaySubjects.length > 0 ? displaySubjects : subjects;
    return list.length > 0 ? list : ["General"];
  }, [displaySubjects, subjects]);

  const enrolledSubjectsKey = useMemo(
    () => previewSubjectList.join("\0"),
    [previewSubjectList]
  );

  useEffect(() => {
    if (loading || !studentId || !classId) return;

    const subjList = previewSubjectList;
    let cancelled = false;

    void (async () => {
      const res = await fetchStudentExamScores({
        studentId,
        classId,
        subjects: subjList,
        term,
        academicYear,
      });
      if (cancelled) return;
      if (!res.ok) {
        console.error("[report-cards] Gradebook exam fetch failed:", res.error);
        return;
      }

      const termVal =
        term === "Term 1" || term === "Term 2" ? term : "Term 1";

      setDrafts((prev) => {
        const sid = studentId;
        const studentDraft = { ...(prev[sid] ?? {}) };
        let changed = false;

        for (const subject of subjList) {
          const g = gradebookScoresForSubject(res.scoresBySubject, subject);
          if (!g) continue;
          const cur = studentDraft[subject] ?? emptyDraftRow();
          let exam1 = cur.exam1;
          let exam2 = cur.exam2;
          let exam1GbOriginal = cur.exam1GbOriginal;
          let exam2GbOriginal = cur.exam2GbOriginal;
          let exam1Locked = cur.exam1Locked;
          let exam2Locked = cur.exam2Locked;
          let exam1Overridden = cur.exam1Overridden;
          let exam2Overridden = cur.exam2Overridden;

          if (termVal === "Term 1") {
            if (!cur.exam1Overridden && g.aprilMidtermPct != null) {
              exam1 = String(g.aprilMidtermPct);
              exam1GbOriginal = exam1;
              exam1Locked = true;
              exam1Overridden = false;
            }
            if (!cur.exam2Overridden && g.juneTerminalPct != null) {
              exam2 = String(g.juneTerminalPct);
              exam2GbOriginal = exam2;
              exam2Locked = true;
              exam2Overridden = false;
            }
          } else {
            if (!cur.exam1Overridden && g.septemberMidtermPct != null) {
              exam1 = String(g.septemberMidtermPct);
              exam1GbOriginal = exam1;
              exam1Locked = true;
              exam1Overridden = false;
            }
            if (!cur.exam2Overridden && g.decemberAnnualPct != null) {
              exam2 = String(g.decemberAnnualPct);
              exam2GbOriginal = exam2;
              exam2Locked = true;
              exam2Overridden = false;
            }
          }

          const next: DraftRow = {
            ...cur,
            exam1,
            exam2,
            exam1GbOriginal,
            exam2GbOriginal,
            exam1Locked,
            exam2Locked,
            exam1Overridden,
            exam2Overridden,
          };
          if (!draftRowsEqual(next, cur)) {
            studentDraft[subject] = next;
            changed = true;
          }
        }

        if (!changed) return prev;
        return { ...prev, [sid]: studentDraft };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, studentId, classId, term, academicYear, enrolledSubjectsKey]);

  const studentsFilteredBySearch = useMemo(() => {
    const q = studentListSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.fullName.toLowerCase().includes(q));
  }, [students, studentListSearch]);

  const studentListTotalPages = Math.max(
    1,
    Math.ceil(
      studentsFilteredBySearch.length / studentListRowsPerPage
    )
  );
  const studentListSafePage = Math.min(studentListPage, studentListTotalPages);
  const studentListStart =
    (studentListSafePage - 1) * studentListRowsPerPage;
  const studentsPageRows = studentsFilteredBySearch.slice(
    studentListStart,
    studentListStart + studentListRowsPerPage
  );

  useEffect(() => {
    setStudentListPage(1);
  }, [studentListSearch, classId, term, academicYear, reportSubjectFilterId]);

  useEffect(() => {
    setStudentListSearch("");
  }, [classId, term, academicYear]);

  useEffect(() => {
    setReportSubjectFilterId("");
  }, [classId, academicYear]);

  useEffect(() => {
    if (
      !reportSubjectFilterId ||
      subjectFilterOptions.length === 0
    ) {
      return;
    }
    if (!subjectFilterOptions.some((o) => o.id === reportSubjectFilterId)) {
      setReportSubjectFilterId("");
    }
  }, [subjectFilterOptions, reportSubjectFilterId]);

  useEffect(() => {
    setStudentListPage((p) => Math.min(p, studentListTotalPages));
  }, [studentListTotalPages]);

  const studentListPaginationItems = useMemo(
    () =>
      getCompactPaginationItems(studentListSafePage, studentListTotalPages),
    [studentListSafePage, studentListTotalPages]
  );

  const selectedStudent = students.find((s) => s.studentId === studentId);

  const studentsMergedForPreview = useMemo(
    () =>
      students.map((s) =>
        mergeStudentCommentsWithDraftsForPreview(
          s,
          subjects,
          drafts[s.studentId],
          { schoolLevel }
        )
      ),
    [students, subjects, drafts, schoolLevel]
  );

  const positionBySubjectForPreview = useMemo(() => {
    if (!selectedStudent) return undefined;
    return computeClassSubjectPositions(
      studentsMergedForPreview,
      previewSubjectList,
      selectedStudent.studentId
    );
  }, [studentsMergedForPreview, previewSubjectList, selectedStudent]);

  const previewData = useMemo(() => {
    if (!selectedStudent || !selectedClass) return null;
    const mergedStudent = mergeStudentCommentsWithDraftsForPreview(
      selectedStudent,
      previewSubjectList,
      drafts[selectedStudent.studentId],
      { restrictOutputToSubjects: true, schoolLevel }
    );
    const base = toPreviewData({
      schoolName,
      schoolMotto,
      logoUrl,
      schoolStampUrl,
      schoolLevel,
      className: selectedClass.className,
      teacherName,
      teacherIsCoordinator: selectedClass.isCoordinator,
      term,
      academicYear,
      subjects: previewSubjectList,
      student: mergedStudent,
      attendance: attendanceByStudent[selectedStudent.studentId] ?? {
        present: 0,
        absent: 0,
        late: 0,
      },
      positionBySubject: positionBySubjectForPreview,
      cohort: studentsMergedForPreview,
    });
    const extra =
      supplementaryByStudentId[selectedStudent.studentId] ?? undefined;
    return extra ? { ...base, ...extra } : base;
  }, [
    selectedStudent,
    selectedClass,
    schoolName,
    schoolMotto,
    schoolLevel,
    logoUrl,
    schoolStampUrl,
    teacherName,
    term,
    academicYear,
    previewSubjectList,
    studentsMergedForPreview,
    drafts,
    attendanceByStudent,
    positionBySubjectForPreview,
    supplementaryByStudentId,
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
      const snapshot: DraftRow = { ...row };
      const e1 = parseDraftPercent(row.exam1);
      const e2 = parseDraftPercent(row.exam2);
      const g1 = parseDraftPercent(row.exam1GbOriginal ?? "");
      const g2 = parseDraftPercent(row.exam2GbOriginal ?? "");
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
        exam1ScoreOverridden: row.exam1Overridden,
        exam2ScoreOverridden: row.exam2Overridden,
        exam1GradebookOriginal: row.exam1Overridden ? g1 : null,
        exam2GradebookOriginal: row.exam2Overridden ? g2 : null,
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
            status: res.reportCardStatus ?? s.status,
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

  const autoCommentDraftKey = useMemo(() => {
    if (!studentId) return "";
    const subjList = previewSubjectList;
    const slice = drafts[studentId];
    if (!slice) {
      return subjList.map((s) => `${s}||||`).join("\n");
    }
    return subjList
      .map((s) => {
        const r = slice[s] ?? emptyDraftRow();
        return `${s}|${r.exam1}|${r.exam2}|${r.comment}`;
      })
      .join("\n");
  }, [studentId, previewSubjectList, drafts]);

  useEffect(() => {
    if (loading || !studentId) return;
    const subjList = previewSubjectList;
    const sid = studentId;
    const toSchedule: string[] = [];

    setDrafts((prev) => {
      const slice = prev[sid];
      if (!slice) return prev;
      const studentDraft = { ...slice };
      let changed = false;

      for (const subject of subjList) {
        const cur = studentDraft[subject] ?? emptyDraftRow();
        if (cur.comment.trim() !== "") continue;
        const auto = autoCommentFromGrades(cur.exam1, cur.exam2, schoolLevel);
        if (auto == null) continue;
        if (cur.comment === auto) continue;
        studentDraft[subject] = { ...cur, comment: auto };
        changed = true;
        toSchedule.push(subject);
      }

      if (!changed) return prev;
      return { ...prev, [sid]: studentDraft };
    });

    for (const sub of toSchedule) {
      scheduleAutosave(sub);
    }
  }, [
    loading,
    studentId,
    previewSubjectList,
    autoCommentDraftKey,
    scheduleAutosave,
  ]);

  const hasUnsavedForSelected = useMemo(() => {
    if (!selectedStudent) return false;
    const subs = previewSubjectList;
    return subs.some(
      (subject) =>
        !draftRowsEqual(
          getDraftRow(drafts, selectedStudent.studentId, subject),
          getDraftRow(baselineDrafts, selectedStudent.studentId, subject)
        )
    );
  }, [drafts, baselineDrafts, selectedStudent, previewSubjectList]);

  const examLabelsForEditor = useMemo(() => {
    return term === "Term 1" || term === "Term 2"
      ? REPORT_CARD_EXAM_LABELS[term]
      : REPORT_CARD_EXAM_LABELS["Term 1"];
  }, [term]);

  const applyTemplate = (template: string) => {
    if (!selectedStudent || !previewSubjectList[0]) return;
    const sub = previewSubjectList[0];
    setDrafts((prev) => ({
      ...prev,
      [selectedStudent.studentId]: {
        ...prev[selectedStudent.studentId],
        [sub]: {
          ...(prev[selectedStudent.studentId]?.[sub] ?? emptyDraftRow()),
          comment: template,
        },
      },
    }));
  };

  return (
    <div className="space-y-8">
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          subjectFilterOptions.length > 1
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : "sm:grid-cols-3"
        )}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">
            Class
          </label>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setStudentId(null);
            }}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          >
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">
            Academic year
          </label>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          >
            {(selectedClass?.academicYears ?? []).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">
            Term
          </label>
          <select
            value={term}
            onChange={(e) =>
              setTerm(e.target.value as (typeof REPORT_TERM_OPTIONS)[number]["value"])
            }
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          >
            {REPORT_TERM_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {subjectFilterOptions.length > 1 ? (
          <div className="flex min-w-0 flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Subject
            </label>
            <select
              value={reportSubjectFilterId}
              onChange={(e) => setReportSubjectFilterId(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              <option value="">All subjects</option>
              {subjectFilterOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {loading && (
        <p className="text-sm text-slate-500">Loading class data…</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Students
          </h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="report-cards-student-search" className="sr-only">
                Search students by name
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                id="report-cards-student-search"
                type="search"
                value={studentListSearch}
                onChange={(e) => setStudentListSearch(e.target.value)}
                placeholder="Search students by name…"
                disabled={students.length === 0}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500"
              />
            </div>
            {students.length > 0 ? (
              <label className="flex shrink-0 items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-zinc-400">
                  Rows
                </span>
                <select
                  value={studentListRowsPerPage}
                  onChange={(e) => {
                    const n = Number(e.target.value) as StudentListRowOption;
                    setStudentListRowsPerPage(n);
                    setStudentListPage(1);
                    localStorage.setItem(
                      TEACHER_REPORT_CARDS_STUDENT_LIST_ROWS_STORAGE_KEY,
                      String(n)
                    );
                  }}
                  aria-label="Rows per page for student list"
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                >
                  {STUDENT_LIST_ROW_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {students.length === 0 && !loading ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
              No students for this class and term.
            </p>
          ) : studentsFilteredBySearch.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
              No students match your search.
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-1 text-sm">
                {studentsPageRows.map((s) => (
                  <li key={s.studentId}>
                    <button
                      type="button"
                      onClick={() => setStudentId(s.studentId)}
                      className={`w-full rounded-lg px-2 py-1.5 text-left ${
                        studentId === s.studentId
                          ? "bg-[rgb(var(--school-primary-rgb)/0.16)] text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.15)] dark:text-school-primary"
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
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-zinc-400">
                <span>
                  {`Showing ${studentListStart + 1}–${Math.min(
                    studentListStart + studentListRowsPerPage,
                    studentsFilteredBySearch.length
                  )} of ${studentsFilteredBySearch.length} student${
                    studentsFilteredBySearch.length === 1 ? "" : "s"
                  }`}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={studentListSafePage <= 1}
                    onClick={() =>
                      setStudentListPage((p) => Math.max(1, p - 1))
                    }
                    className="rounded border border-slate-200 bg-white px-3 py-1.5 text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    Previous
                  </button>
                  {studentListTotalPages > 1 ? (
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {studentListPaginationItems.map((item, idx) =>
                        item === "ellipsis" ? (
                          <span
                            key={`rc-student-ellipsis-${idx}`}
                            className="px-1 text-sm text-slate-400 dark:text-zinc-500"
                            aria-hidden
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setStudentListPage(item)}
                            aria-current={
                              item === studentListSafePage
                                ? "page"
                                : undefined
                            }
                            className={`min-w-[2rem] rounded border px-2.5 py-1 text-sm font-medium dark:border-zinc-600 ${
                              item === studentListSafePage
                                ? "border-school-primary bg-school-primary text-white dark:border-school-primary dark:bg-school-primary"
                                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={
                      studentListSafePage >= studentListTotalPages
                    }
                    onClick={() =>
                      setStudentListPage((p) =>
                        Math.min(studentListTotalPages, p + 1)
                      )
                    }
                    className="rounded border border-slate-200 bg-white px-3 py-1.5 text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
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
                  if (!selectedStudent || !previewSubjectList[0]) return;
                  applyTemplate(t);
                  scheduleAutosave(previewSubjectList[0]);
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
                    setPreviewUnsavedConfirmOpen(true);
                    return;
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
                  void (async () => {
                    await downloadReportCardPdf(previewData, safe);
                  })();
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

          {previewSubjectList.map((subject) => {
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
            const { average, grade } = draftAverageLine(
              row.exam1,
              row.exam2,
              schoolLevel
            );
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
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="min-w-0 flex-1 text-sm">
                        <span className="text-slate-600 dark:text-zinc-400">
                          {examLabelsForEditor.exam1} (%)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          disabled={row.exam1Locked}
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
                          className={cn(
                            "mt-1 w-full rounded border px-2 py-1 dark:border-zinc-600",
                            row.exam1Locked
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                              : "border-slate-300 bg-white dark:bg-zinc-900"
                          )}
                        />
                      </label>
                      {row.exam1Locked ? (
                        <button
                          type="button"
                          onClick={() => {
                            clearSaveErrorForSubject();
                            setDrafts((prev) => {
                              const r = getDraftRow(
                                prev,
                                selectedStudent.studentId,
                                subject
                              );
                              const gb =
                                r.exam1GbOriginal?.trim() ||
                                r.exam1.trim() ||
                                null;
                              return {
                                ...prev,
                                [selectedStudent.studentId]: {
                                  ...prev[selectedStudent.studentId],
                                  [subject]: {
                                    ...r,
                                    exam1Locked: false,
                                    exam1Overridden: true,
                                    exam1GbOriginal: gb ?? r.exam1GbOriginal,
                                  },
                                },
                              };
                            });
                            scheduleAutosave(subject);
                          }}
                          className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          Override
                        </button>
                      ) : null}
                    </div>
                    {row.exam1Overridden ? (
                      <p className="text-xs text-slate-500 dark:text-zinc-500">
                        Overridden from markbook score{" "}
                        {row.exam1GbOriginal != null &&
                        row.exam1GbOriginal.trim() !== ""
                          ? `${row.exam1GbOriginal.trim()}%`
                          : "—"}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="min-w-0 flex-1 text-sm">
                        <span className="text-slate-600 dark:text-zinc-400">
                          {examLabelsForEditor.exam2} (%)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          disabled={row.exam2Locked}
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
                          className={cn(
                            "mt-1 w-full rounded border px-2 py-1 dark:border-zinc-600",
                            row.exam2Locked
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                              : "border-slate-300 bg-white dark:bg-zinc-900"
                          )}
                        />
                      </label>
                      {row.exam2Locked ? (
                        <button
                          type="button"
                          onClick={() => {
                            clearSaveErrorForSubject();
                            setDrafts((prev) => {
                              const r = getDraftRow(
                                prev,
                                selectedStudent.studentId,
                                subject
                              );
                              const gb =
                                r.exam2GbOriginal?.trim() ||
                                r.exam2.trim() ||
                                null;
                              return {
                                ...prev,
                                [selectedStudent.studentId]: {
                                  ...prev[selectedStudent.studentId],
                                  [subject]: {
                                    ...r,
                                    exam2Locked: false,
                                    exam2Overridden: true,
                                    exam2GbOriginal: gb ?? r.exam2GbOriginal,
                                  },
                                },
                              };
                            });
                            scheduleAutosave(subject);
                          }}
                          className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          Override
                        </button>
                      ) : null}
                    </div>
                    {row.exam2Overridden ? (
                      <p className="text-xs text-slate-500 dark:text-zinc-500">
                        Overridden from markbook score{" "}
                        {row.exam2GbOriginal != null &&
                        row.exam2GbOriginal.trim() !== ""
                          ? `${row.exam2GbOriginal.trim()}%`
                          : "—"}
                      </p>
                    ) : null}
                  </div>
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
                      ? "cursor-wait bg-school-primary/85"
                      : "bg-school-primary hover:brightness-105"
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
            void (async () => {
              const baseSubjects =
                subjects.length > 0 ? subjects : ["General"];
              const approved = students.filter((s) => s.status === "approved");
              const subjectListById: Record<string, string[]> = {};
              await Promise.all(
                approved.map(async (s) => {
                  const r = await getReportCardSubjectsForStudent({
                    classId: selectedClass!.classId,
                    studentId: s.studentId,
                    term,
                    academicYear,
                    allSubjects: baseSubjects,
                  });
                  subjectListById[s.studentId] =
                    r.ok && r.subjects.length > 0 ? r.subjects : baseSubjects;
                })
              );
              const allMerged = students.map((st) =>
                mergeStudentCommentsWithDraftsForPreview(
                  st,
                  subjects,
                  drafts[st.studentId],
                  { schoolLevel }
                )
              );
              const items: ReportCardPreviewData[] = approved.map((s) => {
                const subjectList =
                  subjectListById[s.studentId] ?? baseSubjects;
                const merged = mergeStudentCommentsWithDraftsForPreview(
                  s,
                  subjectList,
                  drafts[s.studentId],
                  { restrictOutputToSubjects: true, schoolLevel }
                );
                const positions = computeClassSubjectPositions(
                  allMerged,
                  subjectList,
                  s.studentId
                );
                const basePdf = toPreviewData({
                  schoolName,
                  schoolMotto,
                  logoUrl,
                  schoolStampUrl,
                  schoolLevel,
                  className: selectedClass!.className,
                  teacherName,
                  teacherIsCoordinator: selectedClass!.isCoordinator,
                  term,
                  academicYear,
                  subjects: subjectList,
                  student: merged,
                  attendance: attendanceByStudent[s.studentId] ?? {
                    present: 0,
                    absent: 0,
                    late: 0,
                  },
                  positionBySubject: positions,
                  cohort: allMerged,
                });
                const extra = supplementaryByStudentId[s.studentId];
                return extra ? { ...basePdf, ...extra } : basePdf;
              });
              const safe = selectedClass!.className
                .replace(/[^\w\s-]/g, "")
                .replace(/\s+/g, "-")
                .slice(0, 30);
              await downloadBulkReportCardsPdf(items, safe);
            })();
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

      <ConfirmDeleteModal
        open={previewUnsavedConfirmOpen}
        onClose={() => setPreviewUnsavedConfirmOpen(false)}
        onConfirm={() => {
          setPreviewUnsavedConfirmOpen(false);
          setPreviewOpen(true);
        }}
        title="Unsaved Changes"
        message="You have unsaved changes. Save before previewing?"
        cancelLabel="Cancel"
        confirmLabel="Preview Anyway"
        confirmVariant="primary"
      />

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
              <ReportCardPreview
                data={previewData}
                viewer="teacher"
                reportCardStatus={selectedStudent?.status ?? null}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
