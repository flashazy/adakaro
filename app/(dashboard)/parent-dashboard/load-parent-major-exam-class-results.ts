import "server-only";

import {
  type ClassDraft,
  type FullGradeReportMeta,
  buildStudentRanking,
  computeReportStatsForAssignment,
  scoreGradeForAssignment,
} from "@/lib/gradebook-full-report-compute";
import { DEFAULT_GRADE_DISPLAY_FORMAT } from "@/lib/grade-display-format";
import type { GradebookMajorExamTypeValue } from "@/lib/gradebook-major-exams";
import { resolvedMajorExamKindForDuplicateCheck } from "@/lib/gradebook-major-exams";
import type {
  ParentMajorExamClassResultOption,
  ParentMajorExamClassResultsPayload,
} from "@/lib/parent-major-exam-class-results-types";
import { normalizeSchoolLevel, type SchoolLevel } from "@/lib/school-level";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

const EXAM_SLOT: Record<GradebookMajorExamTypeValue, number> = {
  April_Midterm: 1,
  June_Terminal: 2,
  September_Midterm: 3,
  December_Annual: 4,
};

function isMajorAssignment(row: {
  exam_type: string | null;
  title: string;
}): boolean {
  return (
    resolvedMajorExamKindForDuplicateCheck(row.exam_type, row.title) != null
  );
}

function compareMajorAssignments<
  T extends {
    academic_year: string;
    term: string | null;
    exam_type: string | null;
    title: string;
    updated_at: string;
  },
>(a: T, b: T): number {
  const ya = (a.academic_year ?? "").trim();
  const yb = (b.academic_year ?? "").trim();
  if (ya !== yb) return yb.localeCompare(ya, undefined, { numeric: true });
  const ta = a.term === "Term 2" ? 2 : 1;
  const tb = b.term === "Term 2" ? 2 : 1;
  if (ta !== tb) return tb - ta;
  const ka = resolvedMajorExamKindForDuplicateCheck(a.exam_type, a.title);
  const kb = resolvedMajorExamKindForDuplicateCheck(b.exam_type, b.title);
  const sa = ka ? EXAM_SLOT[ka] : 0;
  const sb = kb ? EXAM_SLOT[kb] : 0;
  if (sa !== sb) return sb - sa;
  return b.updated_at.localeCompare(a.updated_at);
}

export type { ParentMajorExamClassResultOption, ParentMajorExamClassResultsPayload } from "@/lib/parent-major-exam-class-results-types";

/**
 * Class-level “Full marks” style reports for **major exam** gradebook
 * assignments only (same filters as coordinator major-exam slots).
 */
export async function loadParentMajorExamClassResults(
  admin: Db,
  classId: string
): Promise<ParentMajorExamClassResultsPayload> {
  const { data: classRow } = await admin
    .from("classes")
    .select("id, name, school_id")
    .eq("id", classId)
    .maybeSingle();
  const cls = classRow as
    | { id: string; name: string; school_id: string }
    | null;
  if (!cls) return { options: [], defaultOptionId: "" };

  let schoolName = "School";
  let schoolLevelOut: SchoolLevel = "primary";
  {
    let sres = await admin
      .from("schools")
      .select("name, school_level")
      .eq("id", cls.school_id)
      .maybeSingle();
    if (sres.error && /column.*school_level/i.test(sres.error.message ?? "")) {
      sres = await admin
        .from("schools")
        .select("name")
        .eq("id", cls.school_id)
        .maybeSingle();
    }
    const s = sres.data as
      | { name: string; school_level?: string | null }
      | null;
    if (s?.name) schoolName = s.name;
    schoolLevelOut = normalizeSchoolLevel(s?.school_level);
  }

  const { data: rawAssign } = await admin
    .from("teacher_gradebook_assignments")
    .select(
      "id, teacher_id, class_id, subject, title, max_score, academic_year, exam_type, term, updated_at"
    )
    .eq("class_id", classId);

  const major = ((rawAssign ?? []) as {
    id: string;
    teacher_id: string;
    subject: string;
    title: string;
    max_score: number;
    academic_year: string;
    exam_type: string | null;
    term: string | null;
    updated_at: string;
  }[]).filter((r) => isMajorAssignment(r));

  if (major.length === 0) {
    return { options: [], defaultOptionId: "" };
  }

  major.sort(compareMajorAssignments);

  const teacherIds = [...new Set(major.map((m) => m.teacher_id))];
  const teacherNameById = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", teacherIds);
    for (const p of (profs ?? []) as {
      id: string;
      full_name: string | null;
    }[]) {
      teacherNameById.set(p.id, p.full_name?.trim() || "Teacher");
    }
  }

  const { data: stuRows } = await admin
    .from("students")
    .select("id, full_name, gender")
    .eq("class_id", classId)
    .eq("status", "active")
    .order("full_name", { ascending: true });
  const students = ((stuRows ?? []) as {
    id: string;
    full_name: string;
    gender: string | null;
  }[]).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    gender: s.gender,
  }));
  if (students.length === 0) {
    return { options: [], defaultOptionId: "" };
  }

  const assignmentIds = major.map((m) => m.id);
  const { data: scoreData } = await admin
    .from("teacher_scores")
    .select("assignment_id, student_id, score, comments")
    .in("assignment_id", assignmentIds);

  const scoresByAssign = new Map<
    string,
    { student_id: string; score: number | null; comments: string | null }[]
  >();
  for (const row of (scoreData ?? []) as {
    assignment_id: string;
    student_id: string;
    score: number | null;
    comments: string | null;
  }[]) {
    const list = scoresByAssign.get(row.assignment_id) ?? [];
    list.push(row);
    scoresByAssign.set(row.assignment_id, list);
  }

  const options: ParentMajorExamClassResultOption[] = [];

  for (const a of major) {
    const draft: ClassDraft = { [a.id]: {} };
    for (const s of students) {
      draft[a.id]![s.id] = { score: "", remarks: "" };
    }
    for (const r of scoresByAssign.get(a.id) ?? []) {
      const sc =
        r.score != null && Number.isFinite(Number(r.score))
          ? String(r.score)
          : "";
      const remarks = (r.comments ?? "").trim();
      if (!draft[a.id]![r.student_id]) {
        draft[a.id]![r.student_id] = { score: "", remarks: "" };
      }
      draft[a.id]![r.student_id] = { score: sc, remarks };
    }

    const termLabel = [a.term, a.academic_year].filter(Boolean).join(" · ");
    const meta: FullGradeReportMeta = {
      schoolName,
      className: cls.name,
      subject: (a.subject ?? "").trim() || "Subject",
      teacherName: teacherNameById.get(a.teacher_id) || "Teacher",
      termLabel,
    };

    const stats = computeReportStatsForAssignment(
      students,
      { id: a.id, max_score: Number(a.max_score) || 100 },
      draft,
      schoolLevelOut
    );
    const ranking = buildStudentRanking(
      students,
      { id: a.id, max_score: Number(a.max_score) || 100 },
      draft,
      schoolLevelOut,
      DEFAULT_GRADE_DISPLAY_FORMAT
    );

    const scoreRows = students.map((s) => {
      const { scoreLabel, grade } = scoreGradeForAssignment(
        draft[a.id]?.[s.id]?.score,
        Number(a.max_score) || 100,
        schoolLevelOut,
        DEFAULT_GRADE_DISPLAY_FORMAT
      );
      const remarks = draft[a.id]?.[s.id]?.remarks?.trim() ?? "";
      return {
        name: s.full_name,
        genderLabel:
          s.gender === "male"
            ? "Male"
            : s.gender === "female"
              ? "Female"
              : "—",
        scoreLabel,
        grade,
        remarks: remarks || "—",
      };
    });

    const label = `${(a.subject ?? "").trim() || "Subject"} — ${(a.title ?? "").trim()} (max ${a.max_score}) · ${termLabel}`;

    options.push({
      id: a.id,
      label,
      meta,
      assignment: {
        id: a.id,
        title: a.title,
        max_score: Number(a.max_score) || 100,
      },
      schoolLevel: schoolLevelOut,
      passing: stats.passing,
      failing: stats.failing,
      dist: stats.dist,
      ranking,
      scoreRows,
    });
  }

  const defaultOptionId = options[0]?.id ?? "";
  return { options, defaultOptionId };
}
