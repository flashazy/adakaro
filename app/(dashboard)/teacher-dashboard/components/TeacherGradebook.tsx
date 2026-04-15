"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createGradebookAssignmentAction,
  deleteGradebookAssignmentAction,
  loadFullGradeReportMeta,
  loadGradeReportContext,
  loadGradebookAssignmentsForClass,
  loadGradebookClassMatrix,
  loadGradebookMatrix,
  loadScoresForAssignment,
  saveScoresAction,
} from "../actions";
import { FullGradeReport, type FullGradeReportMeta } from "./FullGradeReport";
import {
  downloadGradeReportPdf,
  tanzaniaGradeBadgeClass,
  tanzaniaLetterGrade,
  tanzaniaPercentFromScore,
} from "./GradeReportPDF";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import {
  duplicateMajorExamMessage,
  resolvedMajorExamKindForDuplicateCheck,
} from "@/lib/gradebook-major-exams";

const WEIGHT_FIELD_TOOLTIP =
  "Weight determines how much this assignment counts toward the final grade. Example: Final exam = 50%, Quiz = 10%. Default is 100%.";

/** Convenience only — same string is stored as the assignment title. */
const ASSIGNMENT_TITLE_PRESETS = [
  "April Midterm Examination",
  "June Terminal Examination",
  "September Midterm Examination",
  "December Annual Examination",
] as const;

export type GradebookClassOption = {
  assignmentId: string;
  classId: string;
  className: string;
  subject: string;
  academicYear: string;
};

type GbAssignment = {
  id: string;
  title: string;
  max_score: number;
  weight: number;
  due_date: string | null;
  subject: string;
  exam_type?: string | null;
  academic_year?: string;
};

type ScoreRow = {
  score: number | null;
  comments: string | null;
  remarks: string | null;
};

const QUICK_REMARK_PHRASES = [
  "Excellent work, keep it up",
  "Good effort",
  "Satisfactory performance",
  "Needs improvement",
  "Struggles with this topic",
  "Shows great progress",
  "Late submission",
  "Absent on exam day",
  "Cheating detected",
  "Makeup exam needed",
  "Participates well in class",
  "Homework consistently done",
  "Needs more practice at home",
] as const;

function hasPersistedScore(row: ScoreRow | undefined) {
  if (!row) return false;
  if (row.score != null && Number.isFinite(Number(row.score))) return true;
  if (row.comments?.trim()) return true;
  if (row.remarks?.trim()) return true;
  return false;
}

function genderLabel(g: string | null | undefined): string {
  if (g === "male") return "Male";
  if (g === "female") return "Female";
  return "—";
}

function displayRemarks(row: ScoreRow | undefined): string {
  if (!row) return "";
  const r = row.remarks?.trim();
  if (r) return r;
  return row.comments?.trim() ?? "";
}

function isDuplicateMajorExamFormError(message: string | null): boolean {
  if (!message) return false;
  return message.includes("already exists for this class and subject");
}

function tanzaniaGradeCellSurface(letter: string): string {
  switch (letter) {
    case "A":
      return "border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-100";
    case "B":
      return "border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/55 dark:text-blue-100";
    case "C":
      return "border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/45 dark:text-amber-100";
    case "D":
      return "border-orange-300/80 bg-orange-50 text-orange-950 dark:border-orange-800 dark:bg-orange-950/45 dark:text-orange-100";
    case "F":
      return "border-red-300/80 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/45 dark:text-red-100";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200";
  }
}

function formatMatrixCellDisplay(
  raw: string,
  maxScore: number
): { text: string; letter: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { text: "—", letter: "—" };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { text: "—", letter: "—" };
  const p =
    maxScore > 0 ? Math.round((n / maxScore) * 1000) / 10 : null;
  const tanzPct =
    maxScore > 0 ? tanzaniaPercentFromScore(n, maxScore) : null;
  const letter = tanzaniaLetterGrade(tanzPct);
  if (p == null) return { text: "—", letter: "—" };
  return { text: `${p}% (${letter})`, letter };
}

export function TeacherGradebook({
  options,
  initialClassId,
}: {
  options: GradebookClassOption[];
  initialClassId: string | null;
}) {
  const router = useRouter();
  const first = options[0];
  const [classId, setClassId] = useState(
    options.find((o) => o.classId === initialClassId)?.classId ?? first?.classId ?? ""
  );
  const [subject, setSubject] = useState(first?.subject ?? "");
  const [assignments, setAssignments] = useState<GbAssignment[]>([]);
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [matrix, setMatrix] = useState<{
    assignment: {
      id: string;
      class_id: string;
      subject: string;
      title: string;
      max_score: number;
      weight: number;
      due_date: string | null;
      teacher_id: string;
    };
    students: { id: string; full_name: string; gender: string | null }[];
    scoreByStudent: Record<string, ScoreRow>;
  } | null>(null);

  const [matrixLoading, setMatrixLoading] = useState(false);

  const [title, setTitle] = useState("");
  /** Controlled preset dropdown; resets to "" after applying so the same preset can be chosen again. */
  const [titlePresetValue, setTitlePresetValue] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [weight, setWeight] = useState("100");
  const [weightTooltipOpen, setWeightTooltipOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");

  const [scores, setScores] = useState<
    Record<string, { score: string; remarks: string }>
  >({});

  const [classMatrixData, setClassMatrixData] = useState<{
    assignments: GbAssignment[];
    students: { id: string; full_name: string; gender: string | null }[];
    scoreMatrix: Record<string, Record<string, ScoreRow>>;
  } | null>(null);
  const [classDraft, setClassDraft] = useState<
    Record<string, Record<string, { score: string; remarks: string }>>
  >({});
  const [classMatrixLoading, setClassMatrixLoading] = useState(false);
  const [classMatrixSaving, setClassMatrixSaving] = useState(false);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(
    null
  );
  const [assignmentPendingDelete, setAssignmentPendingDelete] =
    useState<GbAssignment | null>(null);
  const [assignmentDeleteSubmitting, setAssignmentDeleteSubmitting] =
    useState(false);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);

  const [editingMatrixCell, setEditingMatrixCell] = useState<{
    assignmentId: string;
    studentId: string;
  } | null>(null);
  const matrixCellInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [assignmentCreateError, setAssignmentCreateError] = useState<
    string | null
  >(null);
  const [assignmentCreatedBanner, setAssignmentCreatedBanner] = useState<
    string | null
  >(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastFading, setToastFading] = useState(false);

  const [scoresSaveButtonState, setScoresSaveButtonState] = useState<
    "idle" | "saved"
  >("idle");
  const [matrixSaveButtonState, setMatrixSaveButtonState] = useState<
    "idle" | "saved"
  >("idle");

  const [fullReportOpen, setFullReportOpen] = useState(false);
  const [fullReportMeta, setFullReportMeta] =
    useState<FullGradeReportMeta | null>(null);
  const [fullReportMetaLoading, setFullReportMetaLoading] = useState(false);

  const [flashedStudentRowIds, setFlashedStudentRowIds] = useState<Set<string>>(
    () => new Set()
  );

  const [quickRemarkOpenId, setQuickRemarkOpenId] = useState<string | null>(
    null
  );
  const quickMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toastMessage) return;
    setToastFading(false);
    const fadeTimer = window.setTimeout(() => setToastFading(true), 2700);
    const clearTimer = window.setTimeout(() => {
      setToastMessage(null);
      setToastFading(false);
    }, 3000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [toastMessage]);

  useEffect(() => {
    if (!quickRemarkOpenId) return;
    const onDoc = (e: MouseEvent) => {
      const el = quickMenuRef.current;
      if (el && !el.contains(e.target as Node)) {
        setQuickRemarkOpenId(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [quickRemarkOpenId]);

  useEffect(() => {
    if (
      editingMatrixCell &&
      matrixCellInputRef.current
    ) {
      matrixCellInputRef.current.focus();
      matrixCellInputRef.current.select?.();
    }
  }, [editingMatrixCell]);

  const subjectsForClass = useMemo(() => {
    const set = new Set<string>();
    for (const o of options) {
      if (o.classId === classId) {
        set.add(o.subject?.trim() || "General");
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [options, classId]);

  const academicYearForSelection = useMemo(() => {
    const subDisplay = subject.trim() || "General";
    const matches = options.filter(
      (o) =>
        o.classId === classId &&
        (o.subject?.trim() || "General") === subDisplay
    );
    if (matches.length === 0) return "";
    const years = matches
      .map((m) => m.academicYear?.trim() || "")
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a));
    return years[0] ?? "";
  }, [options, classId, subject]);

  useEffect(() => {
    const subs = subjectsForClass;
    if (subs.length === 0) {
      setSubject("");
      return;
    }
    setSubject((prev) => (subs.includes(prev) ? prev : subs[0]));
  }, [classId, subjectsForClass]);

  const fetchAssignments = useCallback(async () => {
    setError(null);
    if (!classId || !subject) {
      setAssignments([]);
      return;
    }
    const res = await loadGradebookAssignmentsForClass(classId, subject);
    if (!res.ok) {
      setError(res.error);
      setAssignments([]);
      return;
    }
    setAssignments(res.assignments as GbAssignment[]);
  }, [classId, subject]);

  useEffect(() => {
    void fetchAssignments();
  }, [fetchAssignments]);

  const fetchClassMatrix = useCallback(async () => {
    if (!classId || !subject) {
      setClassMatrixData(null);
      setClassDraft({});
      return;
    }
    setClassMatrixLoading(true);
    const res = await loadGradebookClassMatrix(classId, subject);
    setClassMatrixLoading(false);
    if (!res.ok) {
      setClassMatrixData(null);
      setClassDraft({});
      return;
    }
    setClassMatrixData({
      assignments: res.assignments as GbAssignment[],
      students: res.students,
      scoreMatrix: res.scoreMatrix as Record<string, Record<string, ScoreRow>>,
    });
  }, [classId, subject]);

  useEffect(() => {
    void fetchClassMatrix();
  }, [fetchClassMatrix]);

  useEffect(() => {
    if (!classMatrixData) {
      setClassDraft({});
      return;
    }
    const draft: Record<
      string,
      Record<string, { score: string; remarks: string }>
    > = {};
    for (const a of classMatrixData.assignments) {
      draft[a.id] = {};
      for (const s of classMatrixData.students) {
        const ex = classMatrixData.scoreMatrix[a.id]?.[s.id];
        draft[a.id][s.id] = {
          score:
            ex?.score != null && Number.isFinite(Number(ex.score))
              ? String(ex.score)
              : "",
          remarks: displayRemarks(ex),
        };
      }
    }
    setClassDraft(draft);
  }, [classMatrixData]);

  useEffect(() => {
    if (!assignmentId) {
      setMatrix(null);
      setScores({});
      setMatrixLoading(false);
      return;
    }
    let cancelled = false;
    setMatrixLoading(true);
    setMatrix(null);
    setScores({});
    setError(null);
    void (async () => {
      const res = await loadGradebookMatrix(assignmentId);
      if (cancelled) return;
      setMatrixLoading(false);
      if (!res.ok) {
        setError(res.error);
        setMatrix(null);
        return;
      }
      setMatrix(res);
      const next: Record<string, { score: string; remarks: string }> = {};
      for (const s of res.students) {
        const ex = res.scoreByStudent[s.id];
        next[s.id] = {
          score:
            ex?.score != null && Number.isFinite(Number(ex.score))
              ? String(ex.score)
              : "",
          remarks: displayRemarks(ex),
        };
      }
      setScores(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAssignmentCreateError(null);
    setAssignmentCreatedBanner(null);
    const mx = Number(maxScore);
    const w = Number(weight);
    if (!title.trim() || !classId || !subject.trim()) {
      setAssignmentCreateError("Title, class, and subject are required.");
      return;
    }
    if (!Number.isFinite(mx) || mx <= 0) {
      setAssignmentCreateError("Max score must be a positive number.");
      return;
    }
    if (!Number.isFinite(w) || w < 0) {
      setAssignmentCreateError("Weight must be zero or positive.");
      return;
    }
    const newKind = resolvedMajorExamKindForDuplicateCheck(null, title.trim());
    if (newKind) {
      const ay = academicYearForSelection.trim();
      const hasDup = assignments.some((a) => {
        const existingKind = resolvedMajorExamKindForDuplicateCheck(
          a.exam_type ?? null,
          a.title
        );
        if (existingKind !== newKind) return false;
        const aYear = (a.academic_year ?? "").trim();
        if (ay && aYear) return ay === aYear;
        return true;
      });
      if (hasDup) {
        setAssignmentCreateError(duplicateMajorExamMessage(newKind));
        return;
      }
    }
    setIsCreatingAssignment(true);
    try {
      const res = await createGradebookAssignmentAction({
        classId,
        subject: subject.trim(),
        title: title.trim(),
        maxScore: mx,
        weight: w,
        dueDate: dueDate || null,
        academicYear: academicYearForSelection || null,
      });
      if (!res.ok) {
        setAssignmentCreateError(res.error);
        return;
      }
      setAssignmentCreateError(null);
      setAssignmentCreatedBanner("Assignment created.");
      setTitle("");
      setTitlePresetValue("");
      setDueDate("");
      await fetchAssignments();
      await fetchClassMatrix();
      if (res.assignmentId) setAssignmentId(res.assignmentId);
      router.refresh();
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const handleSaveScores = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matrix) return;
    setError(null);
    const list = matrix.students.map((s) => {
      const raw = scores[s.id]?.score?.trim() ?? "";
      const num = raw === "" ? null : Number(raw);
      const persisted = matrix.scoreByStudent[s.id];
      return {
        studentId: s.id,
        score: num != null && Number.isFinite(num) ? num : null,
        comments: persisted?.comments ?? null,
        remarks: scores[s.id]?.remarks?.trim() || null,
      };
    });
    const res = await saveScoresAction({
      assignmentId: matrix.assignment.id,
      scores: list,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setToastMessage("Scores saved");
    setScoresSaveButtonState("saved");
    window.setTimeout(() => setScoresSaveButtonState("idle"), 2000);

    const flashIds = new Set<string>();
    for (const s of matrix.students) {
      const raw = scores[s.id]?.score?.trim() ?? "";
      if (raw !== "" && Number.isFinite(Number(raw))) {
        flashIds.add(s.id);
      }
    }
    setFlashedStudentRowIds(flashIds);
    window.setTimeout(() => setFlashedStudentRowIds(new Set()), 2000);

    const reload = await loadScoresForAssignment(matrix.assignment.id);
    if (reload.ok) {
      setMatrix((prev) =>
        prev ? { ...prev, scoreByStudent: reload.scoreByStudent } : null
      );
      const next: Record<string, { score: string; remarks: string }> = {};
      for (const s of matrix.students) {
        const ex = reload.scoreByStudent[s.id];
        next[s.id] = {
          score:
            ex?.score != null && Number.isFinite(Number(ex.score))
              ? String(ex.score)
              : "",
          remarks: displayRemarks(ex),
        };
      }
      setScores(next);
    }
    await fetchClassMatrix();
    router.refresh();
  };

  const handleSaveClassMatrix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classMatrixData) return;
    setError(null);
    setClassMatrixSaving(true);
    setEditingMatrixCell(null);
    try {
      for (const a of classMatrixData.assignments) {
        const list = classMatrixData.students.map((s) => {
          const raw = classDraft[a.id]?.[s.id]?.score?.trim() ?? "";
          const num = raw === "" ? null : Number(raw);
          const persisted = classMatrixData.scoreMatrix[a.id]?.[s.id];
          return {
            studentId: s.id,
            score: num != null && Number.isFinite(num) ? num : null,
            comments: persisted?.comments ?? null,
            remarks: classDraft[a.id]?.[s.id]?.remarks?.trim() || null,
          };
        });
        const res = await saveScoresAction({ assignmentId: a.id, scores: list });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      }
      setToastMessage("Matrix grades saved");
      setMatrixSaveButtonState("saved");
      window.setTimeout(() => setMatrixSaveButtonState("idle"), 2000);

      await fetchClassMatrix();
      if (assignmentId && matrix?.assignment.id === assignmentId) {
        const reload = await loadScoresForAssignment(assignmentId);
        if (reload.ok) {
          setMatrix((prev) =>
            prev ? { ...prev, scoreByStudent: reload.scoreByStudent } : null
          );
          const next: Record<string, { score: string; remarks: string }> = {};
          for (const s of matrix.students) {
            const ex = reload.scoreByStudent[s.id];
            next[s.id] = {
              score:
                ex?.score != null && Number.isFinite(Number(ex.score))
                  ? String(ex.score)
                  : "",
              remarks: displayRemarks(ex),
            };
          }
          setScores(next);
        }
      }
      router.refresh();
    } finally {
      setClassMatrixSaving(false);
    }
  };

  const pct = (score: number | null, max: number) =>
    score != null && max > 0 ? Math.round((score / max) * 1000) / 10 : null;

  const scoreSummary = useMemo(() => {
    if (!matrix) return null;
    const nums: number[] = [];
    for (const s of matrix.students) {
      const raw = scores[s.id]?.score?.trim() ?? "";
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      nums.push(n);
    }
    if (nums.length === 0) {
      return {
        count: 0,
        avg: null as number | null,
        min: null as number | null,
        max: null as number | null,
        avgPct: null as number | null,
      };
    }
    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / nums.length) * 100) / 100;
    const min = Math.min(...nums);
    const maxRaw = Math.max(...nums);
    const maxScoreVal = matrix.assignment.max_score;
    const avgPct =
      maxScoreVal > 0
        ? Math.round((avg / maxScoreVal) * 1000) / 10
        : null;
    return {
      count: nums.length,
      avg,
      min,
      max: maxRaw,
      avgPct,
    };
  }, [matrix, scores]);

  const classAveragePct = scoreSummary?.avgPct ?? null;

  const genderStats = useMemo(() => {
    if (!matrix) return null;
    const max = matrix.assignment.max_score;
    const collect = (filter: "all" | "male" | "female") => {
      const pcts: number[] = [];
      for (const s of matrix.students) {
        if (filter === "male" && s.gender !== "male") continue;
        if (filter === "female" && s.gender !== "female") continue;
        const raw = scores[s.id]?.score?.trim() ?? "";
        if (raw === "") continue;
        const n = Number(raw);
        if (!Number.isFinite(n)) continue;
        const p = tanzaniaPercentFromScore(n, max);
        if (p != null) pcts.push(p);
      }
      return pcts;
    };
    const avgStr = (pcts: number[]) =>
      pcts.length === 0
        ? "—"
        : `${Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10}%`;

    const combined = collect("all");
    const boys = collect("male");
    const girls = collect("female");

    const dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const s of matrix.students) {
      const raw = scores[s.id]?.score?.trim() ?? "";
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      const p = tanzaniaPercentFromScore(n, max);
      const letter = tanzaniaLetterGrade(p);
      if (letter === "A") dist.A += 1;
      else if (letter === "B") dist.B += 1;
      else if (letter === "C") dist.C += 1;
      else if (letter === "D") dist.D += 1;
      else if (letter === "F") dist.F += 1;
    }

    return {
      combinedAvg: avgStr(combined),
      boysAvg: avgStr(boys),
      boysCount: boys.length,
      girlsAvg: avgStr(girls),
      girlsCount: girls.length,
      dist,
    };
  }, [matrix, scores]);

  const handleExportPdf = async () => {
    if (!matrix) return;
    setPdfBusy(true);
    setError(null);
    try {
      const ctx = await loadGradeReportContext(matrix.assignment.id);
      if (!ctx.ok) {
        setError(ctx.error);
        return;
      }
      const max = matrix.assignment.max_score;
      const rows = matrix.students.map((s) => {
        const raw = scores[s.id]?.score?.trim() ?? "";
        const n = raw === "" ? null : Number(raw);
        const p =
          n != null && Number.isFinite(n)
            ? tanzaniaPercentFromScore(n, max)
            : null;
        const letter = tanzaniaLetterGrade(p);
        return {
          name: s.full_name,
          genderLabel: genderLabel(s.gender),
          score:
            n != null && Number.isFinite(n) ? String(n) : "—",
          grade: letter,
          remarks: scores[s.id]?.remarks?.trim() ?? "",
        };
      });

      const gs = genderStats;
      if (!gs) return;

      const dateLabel = new Intl.DateTimeFormat("en-GB", {
        dateStyle: "long",
      }).format(new Date());

      downloadGradeReportPdf({
        schoolName: ctx.schoolName,
        className: ctx.className,
        subject: ctx.subject,
        assignmentTitle: ctx.assignmentTitle,
        teacherName: ctx.teacherName,
        dateLabel,
        rows,
        stats: {
          combinedAvg: gs.combinedAvg,
          boysAvg: gs.boysAvg,
          boysCount: gs.boysCount,
          girlsAvg: gs.girlsAvg,
          girlsCount: gs.girlsCount,
          dist: gs.dist,
        },
      });
    } finally {
      setPdfBusy(false);
    }
  };

  const assignmentDeleteMessage = useMemo(() => {
    if (!assignmentPendingDelete) return "";
    const name = (
      assignmentPendingDelete.title?.trim() || "Assignment"
    ).replace(/'/g, "’");
    return `Delete assignment '${name}'? All scores for this assignment will be permanently deleted.`;
  }, [assignmentPendingDelete]);

  const confirmAssignmentDelete = async () => {
    const a = assignmentPendingDelete;
    if (!a) return;
    setError(null);
    setAssignmentDeleteSubmitting(true);
    setDeletingAssignmentId(a.id);
    const res = await deleteGradebookAssignmentAction(a.id);
    setDeletingAssignmentId(null);
    setAssignmentDeleteSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAssignmentPendingDelete(null);
    setEditingMatrixCell((cur) =>
      cur?.assignmentId === a.id ? null : cur
    );
    setAssignmentId((prev) => (prev === a.id ? "" : prev));
    setToastMessage("Assignment deleted successfully");
    await fetchClassMatrix();
    await fetchAssignments();
    router.refresh();
  };

  const handleOpenFullReport = async () => {
    if (!classMatrixData?.assignments.length || !classMatrixData.students.length) {
      return;
    }
    setFullReportOpen(true);
    setFullReportMeta(null);
    setFullReportMetaLoading(true);
    const res = await loadFullGradeReportMeta(classId, subject);
    setFullReportMetaLoading(false);
    if (!res.ok) {
      setError(res.error);
      setFullReportOpen(false);
      return;
    }
    setFullReportMeta({
      schoolName: res.schoolName,
      className: res.className,
      subject: res.subject,
      teacherName: res.teacherName,
      termLabel: res.termLabel,
    });
  };

  if (options.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-zinc-400">
        No class assignments yet. Ask your administrator to assign you to classes.
      </p>
    );
  }

  return (
    <div className="relative space-y-10">
      {toastMessage && (
        <div
          className={cn(
            "fixed bottom-24 right-4 z-[100] max-w-sm rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg transition-opacity duration-300 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-100 sm:bottom-6 sm:right-6",
            toastFading && "opacity-0"
          )}
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      {assignmentCreatedBanner && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {assignmentCreatedBanner}
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          Filter
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Class
            </span>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setAssignmentId("");
                setAssignmentCreateError(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {[...new Map(options.map((o) => [o.classId, o])).values()].map(
                (o) => (
                  <option key={o.classId} value={o.classId}>
                    {o.className}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Subject
            </span>
            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setAssignmentId("");
                setAssignmentCreateError(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {subjectsForClass.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Grade matrix (all assignments)
          </h2>
          {classMatrixLoading && (
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              Loading…
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Click any cell to enter or edit a score. Cells show percentage and
          letter grade. Save when finished.
        </p>
        {classMatrixData &&
          classMatrixData.assignments.length > 0 &&
          classMatrixData.students.length > 0 && (
            <form onSubmit={handleSaveClassMatrix} className="mt-4 space-y-3">
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
                <table className="w-max min-w-full border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900">
                      <th className="sticky left-0 z-20 min-w-[11rem] border-r border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                        Student
                      </th>
                      {classMatrixData.assignments.map((a) => (
                        <th
                          key={a.id}
                          className="relative min-w-[8rem] max-w-[11rem] px-2 py-2 text-center align-top font-semibold leading-tight text-slate-800 dark:text-zinc-100"
                          title={`${a.title} (max ${a.max_score})`}
                        >
                          <button
                            type="button"
                            disabled={
                              deletingAssignmentId === a.id ||
                              assignmentDeleteSubmitting
                            }
                            onClick={() => {
                              setError(null);
                              setAssignmentPendingDelete(a);
                            }}
                            className="absolute right-1 top-1 rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                            title={`Delete ${a.title?.trim() || "assignment"}`}
                            aria-label={`Delete assignment ${a.title?.trim() || "assignment"}`}
                          >
                            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                          </button>
                          <span className="line-clamp-2 block pr-6 pt-0.5">
                            {a.title?.trim() || "Assignment"}{" "}
                            <span className="whitespace-nowrap font-normal text-slate-500 dark:text-zinc-400">
                              (max {a.max_score})
                            </span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classMatrixData.students.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-slate-100 dark:border-zinc-800"
                      >
                        <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2 font-medium text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white">
                          {s.full_name}
                        </td>
                        {classMatrixData.assignments.map((a) => {
                          const raw =
                            classDraft[a.id]?.[s.id]?.score?.trim() ?? "";
                          const isEditing =
                            editingMatrixCell?.assignmentId === a.id &&
                            editingMatrixCell?.studentId === s.id;
                          const { text, letter } = formatMatrixCellDisplay(
                            raw,
                            a.max_score
                          );
                          const surface =
                            letter !== "—"
                              ? tanzaniaGradeCellSurface(letter)
                              : "border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-950";

                          return (
                            <td
                              key={`${a.id}-${s.id}`}
                              className="px-1 py-1 align-middle"
                            >
                              {isEditing ? (
                                <input
                                  ref={matrixCellInputRef}
                                  type="number"
                                  step={0.01}
                                  aria-label={`Score for ${s.full_name}, ${a.title}`}
                                  value={classDraft[a.id]?.[s.id]?.score ?? ""}
                                  onChange={(e) =>
                                    setClassDraft((prev) => ({
                                      ...prev,
                                      [a.id]: {
                                        ...prev[a.id],
                                        [s.id]: {
                                          score: e.target.value,
                                          remarks:
                                            prev[a.id]?.[s.id]?.remarks ?? "",
                                        },
                                      },
                                    }))
                                  }
                                  onBlur={() => setEditingMatrixCell(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape" || e.key === "Enter") {
                                      setEditingMatrixCell(null);
                                    }
                                  }}
                                  className="w-full min-w-[4.5rem] rounded border border-indigo-400 px-1 py-1 text-center text-sm dark:border-indigo-500 dark:bg-zinc-950"
                                />
                              ) : (
                                <button
                                  type="button"
                                  className={cn(
                                    "flex min-h-[2.5rem] w-full min-w-[5rem] items-center justify-center rounded border px-1 py-1 text-center text-xs font-medium leading-tight transition hover:opacity-95 sm:text-sm",
                                    surface
                                  )}
                                  onClick={() =>
                                    setEditingMatrixCell({
                                      assignmentId: a.id,
                                      studentId: s.id,
                                    })
                                  }
                                >
                                  {text}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={classMatrixSaving}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  {classMatrixSaving
                    ? "Saving…"
                    : matrixSaveButtonState === "saved"
                      ? "Saved! ✓"
                      : "Save matrix grades"}
                </button>
                <button
                  type="button"
                  disabled={
                    classMatrixLoading ||
                    !classMatrixData.assignments.length ||
                    !classMatrixData.students.length
                  }
                  onClick={() => void handleOpenFullReport()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  📊 Generate Report
                </button>
              </div>
            </form>
          )}
        {classMatrixData && classMatrixData.assignments.length === 0 && (
          <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
            No assignments yet for this class and subject. Create one below.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          New assignment
        </h2>
        <form onSubmit={handleCreateAssignment} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Title
            </span>
            <div
              className={cn(
                "mt-1 flex flex-col gap-2 rounded-lg sm:flex-row sm:items-stretch",
                isDuplicateMajorExamFormError(assignmentCreateError) &&
                  "ring-2 ring-red-600 ring-offset-2 ring-offset-slate-50 dark:ring-offset-zinc-900"
              )}
            >
              <select
                value={titlePresetValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) {
                    setTitle(v);
                    setTitlePresetValue("");
                    setAssignmentCreateError(null);
                  }
                }}
                className="w-full shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white sm:max-w-xs"
                aria-label="Preset exam title (optional)"
              >
                <option value="">Preset exam (optional)…</option>
                {ASSIGNMENT_TITLE_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setAssignmentCreateError(null);
                }}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                placeholder="Or type a custom name"
                aria-invalid={isDuplicateMajorExamFormError(
                  assignmentCreateError
                )}
                aria-describedby={
                  assignmentCreateError ? "assignment-create-error" : undefined
                }
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Max score
            </span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={maxScore}
              onChange={(e) => {
                setMaxScore(e.target.value);
                setAssignmentCreateError(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-slate-700 dark:text-zinc-300">
                Weight (%)
              </span>
              <button
                type="button"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 dark:focus-visible:ring-zinc-500"
                title={WEIGHT_FIELD_TOOLTIP}
                aria-label="About assignment weight"
                aria-expanded={weightTooltipOpen}
                aria-controls="weight-field-tooltip"
                onClick={() => setWeightTooltipOpen((o) => !o)}
              >
                <span aria-hidden className="text-xs leading-none">
                  ⓘ
                </span>
              </button>
            </span>
            {weightTooltipOpen && (
              <p
                id="weight-field-tooltip"
                role="tooltip"
                className="mb-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs leading-snug text-slate-600 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-300"
              >
                {WEIGHT_FIELD_TOOLTIP}
              </p>
            )}
            <input
              type="number"
              min={0}
              step={0.1}
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value);
                setAssignmentCreateError(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Due date (optional)
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setAssignmentCreateError(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isCreatingAssignment}
              aria-busy={isCreatingAssignment}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              {isCreatingAssignment ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                  Creating…
                </>
              ) : (
                "Create assignment"
              )}
            </button>
            {assignmentCreateError && (
              <p
                id="assignment-create-error"
                role="alert"
                aria-live="polite"
                className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
              >
                {assignmentCreateError}
              </p>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Enter scores
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Choose an assignment. Grades use the Tanzania scale (A–F) from
          percentage of max score. Add remarks as needed.
        </p>
        <div className="mt-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Assignment
            </span>
            <select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              className="mt-1 w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              <option value="">Select assignment…</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} (max {a.max_score})
                </option>
              ))}
            </select>
          </label>
        </div>

        {matrixLoading && assignmentId && (
          <p className="mt-4 text-sm text-slate-500 dark:text-zinc-400">
            Loading scores…
          </p>
        )}

        {matrix && !matrixLoading && (
          <form onSubmit={handleSaveScores} className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300">
              <span>
                Max score:{" "}
                <strong className="text-slate-900 dark:text-white">
                  {matrix.assignment.max_score}
                </strong>
              </span>
              {scoreSummary && scoreSummary.count > 0 && (
                <>
                  <span className="hidden sm:inline text-slate-300 dark:text-zinc-600">
                    |
                  </span>
                  <span>
                    With scores:{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {scoreSummary.count}
                    </strong>
                  </span>
                  <span>
                    Average:{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {scoreSummary.avg}
                    </strong>
                  </span>
                  <span>
                    High:{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {scoreSummary.max}
                    </strong>
                  </span>
                  <span>
                    Low:{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {scoreSummary.min}
                    </strong>
                  </span>
                </>
              )}
              {classAveragePct != null && (
                <span>
                  Class avg %:{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {classAveragePct}%
                  </strong>
                </span>
              )}
            </div>

            {genderStats && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                  Statistics (Tanzania grading)
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Combined average
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                      {genderStats.combinedAvg}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Boys average{" "}
                      <span className="text-slate-400">(n)</span>
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                      {genderStats.boysAvg}{" "}
                      <span className="text-sm font-normal text-slate-500">
                        ({genderStats.boysCount})
                      </span>
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Girls average{" "}
                      <span className="text-slate-400">(n)</span>
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                      {genderStats.girlsAvg}{" "}
                      <span className="text-sm font-normal text-slate-500">
                        ({genderStats.girlsCount})
                      </span>
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 sm:col-span-2 lg:col-span-1 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Grade distribution
                    </p>
                    <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                      A: {genderStats.dist.A} · B: {genderStats.dist.B} · C:{" "}
                      {genderStats.dist.C} · D: {genderStats.dist.D} · F:{" "}
                      {genderStats.dist.F}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                  A 75–100% · B 65–74% · C 45–64% · D 30–44% · F 0–29%
                </p>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-zinc-700">
                <thead className="bg-slate-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">Gender</th>
                    <th className="px-3 py-2 text-left">Score</th>
                    <th className="px-3 py-2 text-left">%</th>
                    <th className="px-3 py-2 text-left">Grade</th>
                    <th className="px-3 py-2 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {matrix.students.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-slate-500">
                        No active students in this class.
                      </td>
                    </tr>
                  ) : (
                    matrix.students.map((s) => {
                      const raw = scores[s.id]?.score?.trim() ?? "";
                      const n = raw === "" ? null : Number(raw);
                      const p =
                        n != null && Number.isFinite(n)
                          ? pct(n, matrix.assignment.max_score)
                          : null;
                      const tanzPct =
                        n != null && Number.isFinite(n)
                          ? tanzaniaPercentFromScore(
                              n,
                              matrix.assignment.max_score
                            )
                          : null;
                      const letter = tanzaniaLetterGrade(tanzPct);
                      const persisted = hasPersistedScore(
                        matrix.scoreByStudent[s.id]
                      );
                      const isFlashing = flashedStudentRowIds.has(s.id);
                      return (
                        <tr
                          key={s.id}
                          className={cn(
                            persisted &&
                              "bg-emerald-50/50 dark:bg-emerald-950/20",
                            isFlashing &&
                              "bg-emerald-100/90 ring-2 ring-emerald-400/70 dark:bg-emerald-900/30 dark:ring-emerald-500/50"
                          )}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                              <span>{s.full_name}</span>
                              {persisted && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                                  <Check className="h-3 w-3" aria-hidden />
                                  Saved
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">
                            {genderLabel(s.gender)}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step={0.01}
                              value={scores[s.id]?.score ?? ""}
                              onChange={(e) =>
                                setScores((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    score: e.target.value,
                                    remarks: prev[s.id]?.remarks ?? "",
                                  },
                                }))
                              }
                              className="w-24 rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">
                            {p != null ? `${p}%` : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={tanzaniaGradeBadgeClass(letter)}
                            >
                              {letter}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div
                              className="flex items-start gap-1"
                              ref={
                                quickRemarkOpenId === s.id
                                  ? quickMenuRef
                                  : undefined
                              }
                            >
                              <input
                                value={scores[s.id]?.remarks ?? ""}
                                onChange={(e) =>
                                  setScores((prev) => ({
                                    ...prev,
                                    [s.id]: {
                                      score: prev[s.id]?.score ?? "",
                                      remarks: e.target.value,
                                    },
                                  }))
                                }
                                className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                                placeholder="Remarks"
                              />
                              <div className="relative shrink-0 pt-0.5">
                                <button
                                  type="button"
                                  aria-expanded={quickRemarkOpenId === s.id}
                                  aria-label="Quick remarks"
                                  className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuickRemarkOpenId((id) =>
                                      id === s.id ? null : s.id
                                    );
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                                {quickRemarkOpenId === s.id && (
                                  <ul
                                    className="absolute right-0 z-40 mt-1 max-h-56 w-64 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    {QUICK_REMARK_PHRASES.map((phrase) => (
                                      <li key={phrase}>
                                        <button
                                          type="button"
                                          className="w-full px-3 py-1.5 text-left text-slate-800 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                          onClick={() => {
                                            setScores((prev) => ({
                                              ...prev,
                                              [s.id]: {
                                                score:
                                                  prev[s.id]?.score ?? "",
                                                remarks: phrase,
                                              },
                                            }));
                                            setQuickRemarkOpenId(null);
                                          }}
                                        >
                                          {phrase}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={matrixLoading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {scoresSaveButtonState === "saved"
                  ? "Saved! ✓"
                  : "Save scores"}
              </button>
              <button
                type="button"
                disabled={pdfBusy || matrixLoading}
                onClick={() => void handleExportPdf()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <FileText className="h-4 w-4 text-slate-500 dark:text-zinc-400" aria-hidden />
                {pdfBusy ? "PDF…" : "Export PDF"}
              </button>
            </div>
          </form>
        )}
      </section>

      <FullGradeReport
        open={fullReportOpen}
        onClose={() => setFullReportOpen(false)}
        meta={fullReportMeta}
        metaLoading={fullReportMetaLoading}
        assignments={classMatrixData?.assignments ?? []}
        students={classMatrixData?.students ?? []}
        classDraft={classDraft}
      />

      <ConfirmDeleteModal
        open={assignmentPendingDelete !== null}
        onClose={() => {
          if (!assignmentDeleteSubmitting) {
            setAssignmentPendingDelete(null);
          }
        }}
        onConfirm={() => void confirmAssignmentDelete()}
        title="Delete assignment"
        message={assignmentDeleteMessage}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDeleting={assignmentDeleteSubmitting}
      />
    </div>
  );
}
