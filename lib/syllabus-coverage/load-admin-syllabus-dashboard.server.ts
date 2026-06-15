import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClassCluster } from "@/lib/class-cluster";
import {
  computeAdminExpectedCoveragePercent,
} from "@/lib/syllabus-coverage/admin-expected-coverage";
import {
  daysSinceActivity,
  deriveActivityLevel,
  deriveAdminPaceStatus,
  subjectFilterKey,
} from "@/lib/syllabus-coverage/admin-dashboard-utils";
import type {
  AdminSyllabusDashboardPayload,
  AdminSyllabusDashboardRow,
  AdminSyllabusFilterOptions,
  AdminSyllabusSchoolTermDates,
} from "@/lib/syllabus-coverage/admin-dashboard-types";
import { coveragePercent } from "@/lib/syllabus-coverage/coverage-stats";
import type { SyllabusSubtopicStatus } from "@/lib/syllabus-coverage/types";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

function parseStatus(raw: string | null | undefined): SyllabusSubtopicStatus {
  if (raw === "in_progress" || raw === "completed") return raw;
  return "not_started";
}

function buildRowKey(
  classId: string,
  subjectId: string | null,
  teacherId: string
): string {
  return `${classId}|${subjectId ?? ""}|${teacherId}`;
}

function examScoreKey(classId: string, subjectName: string): string {
  return `${classId}|${subjectName.trim().toLowerCase()}`;
}

async function loadExamAveragesByClassSubject(
  admin: Db,
  schoolId: string,
  academicYear: string
): Promise<Map<string, number>> {
  const { data: classRows } = await admin
    .from("classes")
    .select("id")
    .eq("school_id", schoolId);

  const classIds = ((classRows ?? []) as { id: string }[]).map((c) => c.id);
  if (classIds.length === 0) return new Map();

  const { data: assignmentRows } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, class_id, subject, max_score, academic_year, exam_type")
    .in("class_id", classIds)
    .eq("academic_year", academicYear);

  const assignments = (assignmentRows ?? []) as {
    id: string;
    class_id: string;
    subject: string;
    max_score: number;
    exam_type: string | null;
  }[];

  const examAssignments = assignments.filter((a) => a.max_score > 0);
  if (examAssignments.length === 0) return new Map();

  const assignmentIds = examAssignments.map((a) => a.id);
  const assignmentMeta = new Map(
    examAssignments.map((a) => [
      a.id,
      { classId: a.class_id, subject: a.subject?.trim() || "Subject", max: a.max_score },
    ])
  );

  const { data: scoreRows } = await admin
    .from("teacher_scores")
    .select("assignment_id, score")
    .in("assignment_id", assignmentIds);

  const pctByKey = new Map<string, number[]>();
  for (const s of (scoreRows ?? []) as {
    assignment_id: string;
    score: number | null;
  }[]) {
    const meta = assignmentMeta.get(s.assignment_id);
    if (!meta || s.score == null || meta.max <= 0) continue;
    const pct = Math.round((Number(s.score) / meta.max) * 100);
    const key = examScoreKey(meta.classId, meta.subject);
    const list = pctByKey.get(key) ?? [];
    list.push(pct);
    pctByKey.set(key, list);
  }

  const averages = new Map<string, number>();
  for (const [key, values] of pctByKey) {
    if (values.length === 0) continue;
    averages.set(
      key,
      Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
    );
  }
  return averages;
}

function buildTermOptions(termDates: AdminSyllabusSchoolTermDates): string[] {
  const terms = ["All Terms", "Term 1", "Term 2"];
  if (termDates.termStructure === "3_terms" || termDates.term3Start) {
    terms.push("Term 3");
  }
  return terms;
}

/**
 * Loads school admin syllabus dashboard rows from Supabase.
 *
 * Actual coverage: completed subtopics ÷ total subtopics (syllabus_subtopic_progress).
 * Expected coverage: elapsed calendar time in term/year (computeAdminExpectedCoveragePercent).
 * See lib/syllabus-coverage/ADMIN_COVERAGE_CALCULATIONS.md.
 */
export async function loadAdminSyllabusDashboard(
  schoolId: string,
  academicYear: string
): Promise<AdminSyllabusDashboardPayload> {
  const admin = createAdminClient() as Db;

  const [{ data: schoolRow }, { data: topicRows }] = await Promise.all([
    admin
      .from("schools")
      .select(
        "term_structure, term_1_start, term_1_end, term_2_start, term_2_end, term_3_start, term_3_end"
      )
      .eq("id", schoolId)
      .maybeSingle(),
    admin
      .from("syllabus_topics")
      .select("id, class_id, subject_id, subject_name")
      .eq("school_id", schoolId)
      .eq("academic_year", academicYear),
  ]);

  const termDates: AdminSyllabusSchoolTermDates = {
    termStructure:
      (schoolRow as { term_structure?: "2_terms" | "3_terms" | null } | null)
        ?.term_structure ?? null,
    term1Start:
      (schoolRow as { term_1_start?: string | null } | null)?.term_1_start ??
      null,
    term1End:
      (schoolRow as { term_1_end?: string | null } | null)?.term_1_end ?? null,
    term2Start:
      (schoolRow as { term_2_start?: string | null } | null)?.term_2_start ??
      null,
    term2End:
      (schoolRow as { term_2_end?: string | null } | null)?.term_2_end ?? null,
    term3Start:
      (schoolRow as { term_3_start?: string | null } | null)?.term_3_start ??
      null,
    term3End:
      (schoolRow as { term_3_end?: string | null } | null)?.term_3_end ?? null,
  };

  const topics = (topicRows ?? []) as {
    id: string;
    class_id: string;
    subject_id: string | null;
    subject_name: string;
  }[];

  const topicIds = topics.map((t) => t.id);
  const subtopicsByTopic = new Map<string, string[]>();

  if (topicIds.length > 0) {
    const { data: subRows } = await admin
      .from("syllabus_subtopics")
      .select("id, topic_id")
      .in("topic_id", topicIds);
    for (const s of (subRows ?? []) as { id: string; topic_id: string }[]) {
      const list = subtopicsByTopic.get(s.topic_id) ?? [];
      list.push(s.id);
      subtopicsByTopic.set(s.topic_id, list);
    }
  }

  const subtopicIds = [...subtopicsByTopic.values()].flat();
  const progressBySubtopicTeacher = new Map<
    string,
    { status: SyllabusSubtopicStatus; updatedAt: string | null }
  >();

  if (subtopicIds.length > 0) {
    const { data: progRows } = await admin
      .from("syllabus_subtopic_progress")
      .select("subtopic_id, teacher_id, status, updated_at")
      .in("subtopic_id", subtopicIds);
    for (const p of (progRows ?? []) as {
      subtopic_id: string;
      teacher_id: string;
      status: string;
      updated_at: string | null;
    }[]) {
      progressBySubtopicTeacher.set(`${p.subtopic_id}:${p.teacher_id}`, {
        status: parseStatus(p.status),
        updatedAt: p.updated_at,
      });
    }
  }

  const { data: assignments } = await admin
    .from("teacher_assignments")
    .select("teacher_id, class_id, subject_id, subject, academic_year")
    .eq("school_id", schoolId)
    .eq("academic_year", academicYear);

  const assignmentRows = (assignments ?? []) as {
    teacher_id: string;
    class_id: string;
    subject_id: string | null;
    subject: string;
  }[];

  const teacherIds = [...new Set(assignmentRows.map((a) => a.teacher_id))];
  const nameByTeacher = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", teacherIds);
    for (const p of (profiles ?? []) as {
      id: string;
      full_name: string | null;
    }[]) {
      nameByTeacher.set(p.id, p.full_name?.trim() || "Teacher");
    }
  }

  const [{ data: classRows }, { data: subjectRows }, examAverages] =
    await Promise.all([
      admin.from("classes").select("id, name").eq("school_id", schoolId),
      admin.from("subjects").select("id, name").eq("school_id", schoolId),
      loadExamAveragesByClassSubject(admin, schoolId, academicYear),
    ]);

  const classNameById = new Map<string, string>();
  for (const c of (classRows ?? []) as { id: string; name: string }[]) {
    classNameById.set(c.id, c.name?.trim() || "Class");
  }

  const subjectNameById = new Map<string, string>();
  for (const s of (subjectRows ?? []) as { id: string; name: string }[]) {
    subjectNameById.set(s.id, s.name?.trim() || "Subject");
  }

  const clusterCache = new Map<string, Set<string>>();
  async function classClusterSet(classId: string): Promise<Set<string>> {
    const cached = clusterCache.get(classId);
    if (cached) return cached;
    const cluster = await resolveClassCluster(admin, classId);
    const set = new Set(cluster.classIds);
    for (const id of cluster.classIds) clusterCache.set(id, set);
    return set;
  }

  const defaultExpected = computeAdminExpectedCoveragePercent(
    academicYear,
    "All Terms",
    termDates
  );

  const rows: AdminSyllabusDashboardRow[] = [];

  for (const assign of assignmentRows) {
    const assignCluster = await classClusterSet(assign.class_id);
    const matchingTopics = topics.filter(
      (t) =>
        assignCluster.has(t.class_id) &&
        (assign.subject_id == null ||
          t.subject_id == null ||
          t.subject_id === assign.subject_id)
    );

    let totalSubtopics = 0;
    let completedSubtopics = 0;
    let lastActivityAt: string | null = null;

    for (const topic of matchingTopics) {
      const subs = subtopicsByTopic.get(topic.id) ?? [];
      totalSubtopics += subs.length;
      for (const subId of subs) {
        const prog = progressBySubtopicTeacher.get(
          `${subId}:${assign.teacher_id}`
        );
        if (prog?.status === "completed") completedSubtopics += 1;
        if (prog?.updatedAt) {
          if (
            !lastActivityAt ||
            new Date(prog.updatedAt).getTime() >
              new Date(lastActivityAt).getTime()
          ) {
            lastActivityAt = prog.updatedAt;
          }
        }
      }
    }

    const subjectName =
      matchingTopics[0]?.subject_name?.trim() ||
      (assign.subject_id
        ? subjectNameById.get(assign.subject_id)
        : undefined) ||
      assign.subject?.trim() ||
      "Subject";

    const coveragePct = coveragePercent(completedSubtopics, totalSubtopics);
    const lastActivityDays = daysSinceActivity(lastActivityAt);
    const paceStatus = deriveAdminPaceStatus(coveragePct, defaultExpected);

    rows.push({
      rowKey: buildRowKey(assign.class_id, assign.subject_id, assign.teacher_id),
      classId: assign.class_id,
      className: classNameById.get(assign.class_id) ?? "Class",
      subjectId: assign.subject_id,
      subjectName,
      teacherId: assign.teacher_id,
      teacherName: nameByTeacher.get(assign.teacher_id) ?? "Teacher",
      totalSubtopics,
      completedSubtopics,
      coveragePercent: coveragePct,
      expectedCoveragePercent: defaultExpected,
      paceStatus,
      lastActivityAt,
      lastActivityDays,
      activityLevel: deriveActivityLevel(lastActivityDays),
      averageExamScore:
        examAverages.get(examScoreKey(assign.class_id, subjectName)) ?? null,
    });
  }

  rows.sort((a, b) => {
    const c = a.className.localeCompare(b.className);
    if (c !== 0) return c;
    return a.subjectName.localeCompare(b.subjectName);
  });

  const subjectOptionMap = new Map<string, { id: string | null; name: string }>();
  for (const s of (subjectRows ?? []) as { id: string; name: string }[]) {
    const name = s.name?.trim();
    if (!name) continue;
    subjectOptionMap.set(s.id, { id: s.id, name });
  }
  for (const row of rows) {
    const key = subjectFilterKey(row.subjectId, row.subjectName);
    if (!subjectOptionMap.has(key)) {
      subjectOptionMap.set(key, { id: row.subjectId, name: row.subjectName });
    }
  }

  const current = currentAcademicYear();
  const filterOptions: AdminSyllabusFilterOptions = {
    academicYears: [String(current), String(current - 1), String(current + 1)],
    terms: buildTermOptions(termDates),
    classes: ((classRows ?? []) as { id: string; name: string }[])
      .map((c) => ({ id: c.id, name: c.name?.trim() || "Class" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    subjects: [...subjectOptionMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    teachers: teacherIds
      .map((id) => ({
        id,
        name: nameByTeacher.get(id) ?? "Teacher",
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };

  return {
    academicYear,
    termDates,
    filterOptions,
    rows,
  };
}
