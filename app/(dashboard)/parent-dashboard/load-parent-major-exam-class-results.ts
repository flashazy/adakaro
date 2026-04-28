import "server-only";

import {
  type ClassDraft,
  type FullGradeReportMeta,
  buildStudentRanking,
  computeReportStatsForAssignment,
  scoreGradeForAssignment,
} from "@/lib/gradebook-full-report-compute";
import { DEFAULT_GRADE_DISPLAY_FORMAT } from "@/lib/grade-marks-label-format";
import type {
  ParentMajorExamClassResultOption,
  ParentMajorExamClassResultsPayload,
} from "@/lib/parent-major-exam-class-results-types";
import { resolveClassCluster } from "@/lib/class-cluster";
import { normalizeSchoolLevel, type SchoolLevel } from "@/lib/school-level";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { subjectTextKey } from "@/lib/subject-text-key";

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

export { subjectTextKey } from "@/lib/subject-text-key";

/**
 * At least one `teacher_scores` row exists (matches “has a score” when any row
 * is present, including `score` null — same idea as `LEFT JOIN … ts.id IS NOT NULL`).
 */
function hasAnyTeacherScoreRow(
  rows:
    | { student_id: string; score: number | null; comments: string | null }[]
    | undefined
): boolean {
  return (rows?.length ?? 0) > 0;
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
  let assignErr: { message?: string } | null = null;
  let rawAssign:
    | Pick<
        AssignmentRow,
        | "id"
        | "subject"
        | "title"
        | "max_score"
        | "academic_year"
        | "term"
        | "updated_at"
      >[]
    | null = null;
  try {
    rawAssign = await fetchAllRows({
      label: "parent-dashboard:listParentClassResultSubjects assignments",
      fetchPage: async (from, to) =>
        await admin
          .from("teacher_gradebook_assignments")
          .select("id, subject, title, max_score, academic_year, term, updated_at")
          .in("class_id", cluster.classIds)
          .range(from, to),
    });
  } catch (error) {
    assignErr = { message: error instanceof Error ? error.message : String(error) };
  }

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

  if (assignErr && process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[listParentClassResultSubjects] assignments query error", {
      classId,
      clusterClassIds: cluster.classIds,
      message: assignErr.message,
    });
  }

  if (allAssign.length === 0) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[listParentClassResultSubjects] no assignments in cluster", {
        classId,
        clusterClassIds: cluster.classIds,
      });
    }
    return [];
  }

  const allAssignmentIds = allAssign.map((m) => m.id);
  let scoreErr: { message?: string } | null = null;
  let scoreData:
    | {
        id: string;
        assignment_id: string;
        student_id: string;
        score: number | null;
        comments: string | null;
      }[]
    | null = null;
  try {
    scoreData = await fetchAllRows({
      label: "parent-dashboard:listParentClassResultSubjects scores",
      fetchPage: async (from, to) =>
        await admin
          .from("teacher_scores")
          .select("id, assignment_id, student_id, score, comments")
          .in("assignment_id", allAssignmentIds)
          .range(from, to),
    });
  } catch (error) {
    scoreErr = { message: error instanceof Error ? error.message : String(error) };
  }

  if (scoreErr && process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[listParentClassResultSubjects] teacher_scores query error", {
      classId,
      message: scoreErr.message,
    });
  }

  const scoreRows = (scoreData ?? []) as {
    id: string;
    assignment_id: string;
    student_id: string;
    score: number | null;
    comments: string | null;
  }[];

  if (process.env.NODE_ENV === "development") {
    const distinctWithScore = new Set(scoreRows.map((r) => r.assignment_id))
      .size;
    // eslint-disable-next-line no-console
    console.log(
      "[listParentClassResultSubjects] assignments vs teacher_scores (cluster)",
      {
        classId,
        clusterClassIds: cluster.classIds,
        teacherGradebookAssignmentCount: allAssign.length,
        teacherScoresRowCount: scoreRows.length,
        /** Assignments with ≥1 `teacher_scores` row (satisfies a.id joined where ts.id IS NOT NULL). */
        assignmentCountWithAtLeastOneScoreRow: distinctWithScore,
      }
    );
  }

  const scoresByAssign = new Map<
    string,
    { student_id: string; score: number | null; comments: string | null }[]
  >();
  for (const row of scoreRows) {
    const list = scoresByAssign.get(row.assignment_id) ?? [];
    list.push(row);
    scoresByAssign.set(row.assignment_id, list);
  }

  const withScores = allAssign.filter((a) =>
    hasAnyTeacherScoreRow(scoresByAssign.get(a.id))
  );
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[listParentClassResultSubjects] assignments with ≥1 score row", {
      classId,
      withScoresCount: withScores.length,
    });
  }

  const keys = new Set(withScores.map((a) => subjectTextKey(a.subject)));
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
  const rawAssign = await fetchAllRows<AssignmentRow & { class_id: string }>({
    label: "parent-dashboard:loadParentMajorExamClassResults assignments",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_gradebook_assignments")
        .select(
          "id, teacher_id, class_id, subject, title, max_score, academic_year, exam_type, term, updated_at"
        )
        .in("class_id", cluster.classIds)
        .range(from, to),
  });

  let allAssign = (rawAssign ?? []) as AssignmentRow[];

  if (allAssign.length === 0) {
    return { options: [], defaultOptionId: "" };
  }

  /** Match the `subject` text column the same way as {@link listParentClassResultSubjects} keys. */
  const subj = subjectTextKey(subject);
  allAssign = allAssign.filter(
    (a) => subjectTextKey(a.subject) === subj
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
  const scoreData = await fetchAllRows<{
    assignment_id: string;
    student_id: string;
    score: number | null;
    comments: string | null;
  }>({
    label: "parent-dashboard:loadParentMajorExamClassResults scores",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_scores")
        .select("assignment_id, student_id, score, comments")
        .in("assignment_id", allAssignmentIds)
        .range(from, to),
  });

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
    hasAnyTeacherScoreRow(scoresByAssign.get(a.id))
  );
  if (withScores.length === 0) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[loadParentMajorExamClassResults] no score rows for subject", {
        classId,
        subject: subj,
        filteredAssignmentCount: allAssign.length,
      });
    }
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
