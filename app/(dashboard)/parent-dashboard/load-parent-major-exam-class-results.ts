import "server-only";

import {
  type ClassDraft,
  type FullGradeReportMeta,
  buildStudentRanking,
  computeReportStatsForAssignment,
  scoreGradeForAssignment,
} from "@/lib/gradebook-full-report-compute";
import { DEFAULT_GRADE_DISPLAY_FORMAT } from "@/lib/grade-display-format";
import type {
  ParentMajorExamClassResultOption,
  ParentMajorExamClassResultsPayload,
} from "@/lib/parent-major-exam-class-results-types";
import { resolveClassCluster } from "@/lib/class-cluster";
import { normalizeSchoolLevel, type SchoolLevel } from "@/lib/school-level";
import { createAdminClient } from "@/lib/supabase/admin";

type AssignmentRow = {
  id: string;
  teacher_id: string;
  subject: string;
  title: string;
  max_score: number;
  academic_year: string;
  exam_type: string | null;
  term: string | null;
  updated_at: string;
};

/** Stable label for the gradebook `subject` field (empty → "Subject"). */
function parentClassResultSubjectKey(subject: string | null | undefined): string {
  const t = (subject ?? "").trim();
  return t || "Subject";
}

function hasEnteredScore(
  rows:
    | { student_id: string; score: number | null; comments: string | null }[]
    | undefined
): boolean {
  if (!rows?.length) return false;
  return rows.some(
    (r) => r.score != null && Number.isFinite(Number(r.score))
  );
}

function compareAssignments<
  T extends {
    academic_year: string;
    term: string | null;
    subject: string;
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
  if (a.updated_at !== b.updated_at) {
    return b.updated_at.localeCompare(a.updated_at);
  }
  const sa = (a.subject ?? "").trim();
  const sb = (b.subject ?? "").trim();
  if (sa !== sb) {
    return sa.localeCompare(sb, undefined, { sensitivity: "base" });
  }
  return (a.title ?? "")
    .trim()
    .localeCompare((b.title ?? "").trim(), undefined, { sensitivity: "base" });
}

export type { ParentMajorExamClassResultOption, ParentMajorExamClassResultsPayload } from "@/lib/parent-major-exam-class-results-types";

/**
 * Distinct gradebook subject names for the class that have at least one
 * assignment with a recorded score (same data as the full class-results loader).
 */
export async function listParentClassResultSubjects(
  classId: string
): Promise<string[]> {
  const admin = createAdminClient();
  const cluster = await resolveClassCluster(admin, classId);
  const { data: rawAssign } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, subject, title, max_score, academic_year, term, updated_at")
    .in("class_id", cluster.classIds);

  const allAssign = (rawAssign ?? []) as Pick<
    AssignmentRow,
    | "id"
    | "subject"
    | "title"
    | "max_score"
    | "academic_year"
    | "term"
    | "updated_at"
  >[];

  if (allAssign.length === 0) return [];

  const allAssignmentIds = allAssign.map((m) => m.id);
  const { data: scoreData } = await admin
    .from("teacher_scores")
    .select("assignment_id, student_id, score, comments")
    .in("assignment_id", allAssignmentIds);

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

  const withScores = allAssign.filter((a) =>
    hasEnteredScore(scoresByAssign.get(a.id))
  );
  const keys = new Set(
    withScores.map((a) => parentClassResultSubjectKey(a.subject))
  );
  return [...keys].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

/**
 * Class-level “Full marks” style reports for each gradebook assignment (in
 * the given `subject` only) that has at least one score recorded for the class.
 * Mirrors teacher Full marks: pick subject, then see assignments for that subject.
 */
export async function loadParentMajorExamClassResults(
  classId: string,
  subject: string
): Promise<ParentMajorExamClassResultsPayload> {
  const admin = createAdminClient();
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

  const cluster = await resolveClassCluster(admin, classId);
  const { data: rawAssign } = await admin
    .from("teacher_gradebook_assignments")
    .select(
      "id, teacher_id, class_id, subject, title, max_score, academic_year, exam_type, term, updated_at"
    )
    .in("class_id", cluster.classIds);

  let allAssign = (rawAssign ?? []) as AssignmentRow[];

  if (allAssign.length === 0) {
    return { options: [], defaultOptionId: "" };
  }

  const subj = parentClassResultSubjectKey(subject);
  allAssign = allAssign.filter(
    (a) => parentClassResultSubjectKey(a.subject) === subj
  );
  if (allAssign.length === 0) {
    return { options: [], defaultOptionId: "" };
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

  const allAssignmentIds = allAssign.map((m) => m.id);
  const { data: scoreData } = await admin
    .from("teacher_scores")
    .select("assignment_id, student_id, score, comments")
    .in("assignment_id", allAssignmentIds);

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

  const withScores = allAssign.filter((a) =>
    hasEnteredScore(scoresByAssign.get(a.id))
  );
  if (withScores.length === 0) {
    return { options: [], defaultOptionId: "" };
  }

  withScores.sort(compareAssignments);

  const teacherIds = [...new Set(withScores.map((m) => m.teacher_id))];
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

  const options: ParentMajorExamClassResultOption[] = [];

  for (const a of withScores) {
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
