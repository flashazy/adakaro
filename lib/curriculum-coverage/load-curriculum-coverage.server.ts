import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClassCluster } from "@/lib/class-cluster";
import {
  aggregateTeacherStatus,
  deriveCurriculumCoverageStatus,
  EXPECTED_COVERAGE_PERCENT,
} from "@/lib/curriculum-coverage/coverage-status";
import { buildExecutiveSummary } from "@/lib/curriculum-coverage/executive-summary";
import {
  computeExpectedProgressPercent,
  computeProgressVariance,
} from "@/lib/curriculum-coverage/expected-progress";
import { computeCurriculumHealth } from "@/lib/curriculum-coverage/health-score";
import { buildCurriculumInsights } from "@/lib/curriculum-coverage/insights";
import { daysSinceUpdate } from "@/lib/curriculum-coverage/stale";
import {
  averageTrend,
  deriveTrendDirection,
} from "@/lib/curriculum-coverage/trends";
import type {
  CurriculumActivityItem,
  CurriculumActiveTeacher,
  CurriculumAttentionSubject,
  CurriculumClassSummaryRow,
  CurriculumCoverageDistribution,
  CurriculumCoverageFilterOptions,
  CurriculumCoverageKpis,
  CurriculumCoveragePageResult,
  CurriculumCoverageRow,
  CurriculumCoverageStatusFilter,
  CurriculumStatusSummary,
  CurriculumTeacherSummaryRow,
} from "@/lib/curriculum-coverage/types";
import {
  coveragePercent,
  isTopicComplete,
} from "@/lib/syllabus-coverage/coverage-stats";
import type { SyllabusSubtopicStatus } from "@/lib/syllabus-coverage/types";
import { fetchActiveSchoolTeacherUserIds } from "@/lib/teacher-assignments/active-school-teachers";
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

function monthStartDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function isTeacherBehindSchedule(
  teacherRows: CurriculumCoverageRow[]
): boolean {
  const active = teacherRows.filter((r) => r.totalSubtopics > 0);
  const atRiskCount = active.filter((r) => r.coveragePercent < 40).length;
  return atRiskCount >= 2 || (active.length >= 2 && atRiskCount >= 1);
}

async function loadSchoolWideFilterOptions(
  admin: Db,
  schoolId: string,
  assignmentRows: {
    subject_id: string | null;
    subject: string;
  }[]
): Promise<CurriculumCoverageFilterOptions> {
  const activeTeacherIds = await fetchActiveSchoolTeacherUserIds(
    admin,
    schoolId
  );

  const [{ data: classRows }, { data: subjectRows }, { data: teacherProfiles }] =
    await Promise.all([
      admin
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name"),
      admin
        .from("subjects")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name"),
      activeTeacherIds.size > 0
        ? admin
            .from("profiles")
            .select("id, full_name")
            .in("id", [...activeTeacherIds])
        : Promise.resolve({ data: [] }),
    ]);

  const subjectOptionMap = new Map<string, { id: string | null; name: string }>();
  for (const s of (subjectRows ?? []) as { id: string; name: string }[]) {
    const name = s.name?.trim();
    if (!name) continue;
    subjectOptionMap.set(s.id, { id: s.id, name });
  }

  for (const assign of assignmentRows) {
    if (assign.subject_id && !subjectOptionMap.has(assign.subject_id)) {
      const name = assign.subject?.trim();
      if (name) {
        subjectOptionMap.set(assign.subject_id, { id: assign.subject_id, name });
      }
    } else if (!assign.subject_id) {
      const name = assign.subject?.trim();
      if (name && !subjectOptionMap.has(name)) {
        subjectOptionMap.set(name, { id: null, name });
      }
    }
  }

  const current = currentAcademicYear();

  return {
    classes: ((classRows ?? []) as { id: string; name: string }[])
      .map((c) => ({ id: c.id, name: c.name?.trim() || "Class" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    subjects: [...subjectOptionMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    teachers: ((teacherProfiles ?? []) as {
      id: string;
      full_name: string | null;
    }[])
      .map((p) => ({
        id: p.id,
        name: p.full_name?.trim() || "Teacher",
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    academicYears: [
      String(current),
      String(current - 1),
      String(current + 1),
    ],
  };
}

export async function loadCurriculumCoverageDataset(
  schoolId: string,
  academicYear: string
): Promise<{
  rows: CurriculumCoverageRow[];
  activity: CurriculumActivityItem[];
  updatesThisMonthByTeacher: Map<string, number>;
  filterOptions: CurriculumCoverageFilterOptions;
}> {
  const admin = createAdminClient() as Db;

  const { data: topicRows } = await admin
    .from("syllabus_topics")
    .select("id, class_id, subject_id, subject_name, title")
    .eq("school_id", schoolId)
    .eq("academic_year", academicYear);

  const topics = (topicRows ?? []) as {
    id: string;
    class_id: string;
    subject_id: string | null;
    subject_name: string;
    title: string;
  }[];

  const topicIds = topics.map((t) => t.id);
  const topicTitleById = new Map(topics.map((t) => [t.id, t.title]));
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
  const updatesThisMonthByTeacher = new Map<string, number>();
  const monthStartMs = monthStartDate().getTime();

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
      if (p.updated_at && new Date(p.updated_at).getTime() >= monthStartMs) {
        updatesThisMonthByTeacher.set(
          p.teacher_id,
          (updatesThisMonthByTeacher.get(p.teacher_id) ?? 0) + 1
        );
      }
    }
  }

  const expectedProgressPercent = computeExpectedProgressPercent(academicYear);

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

  const [{ data: schoolClassRows }, { data: schoolSubjectRows }] =
    await Promise.all([
      admin
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId),
      admin.from("subjects").select("id, name").eq("school_id", schoolId),
    ]);

  const classNameById = new Map<string, string>();
  for (const c of (schoolClassRows ?? []) as { id: string; name: string }[]) {
    classNameById.set(c.id, c.name?.trim() || "Class");
  }

  const subjectNameById = new Map<string, string>();
  for (const s of (schoolSubjectRows ?? []) as { id: string; name: string }[]) {
    subjectNameById.set(s.id, s.name?.trim() || "Subject");
  }

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

  const clusterCache = new Map<string, Set<string>>();
  async function classClusterSet(classId: string): Promise<Set<string>> {
    const cached = clusterCache.get(classId);
    if (cached) return cached;
    const cluster = await resolveClassCluster(admin, classId);
    const set = new Set(cluster.classIds);
    for (const id of cluster.classIds) clusterCache.set(id, set);
    return set;
  }

  const rows: CurriculumCoverageRow[] = [];

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
    let monthStartCompleted = 0;
    let completedTopics = 0;
    let lastUpdateAt: string | null = null;

    for (const topic of matchingTopics) {
      const subs = subtopicsByTopic.get(topic.id) ?? [];
      totalSubtopics += subs.length;
      const statuses: SyllabusSubtopicStatus[] = [];
      for (const subId of subs) {
        const prog = progressBySubtopicTeacher.get(
          `${subId}:${assign.teacher_id}`
        );
        const status = prog?.status ?? "not_started";
        statuses.push(status);
        if (status === "completed") {
          completedSubtopics += 1;
          if (
            prog?.updatedAt &&
            new Date(prog.updatedAt).getTime() < monthStartMs
          ) {
            monthStartCompleted += 1;
          }
        }
        if (prog?.updatedAt) {
          if (
            !lastUpdateAt ||
            new Date(prog.updatedAt).getTime() > new Date(lastUpdateAt).getTime()
          ) {
            lastUpdateAt = prog.updatedAt;
          }
        }
      }
      if (subs.length > 0 && isTopicComplete(statuses)) completedTopics += 1;
    }

    const pct = coveragePercent(completedSubtopics, totalSubtopics);
    const monthStartPct = coveragePercent(monthStartCompleted, totalSubtopics);
    const trendPercent =
      totalSubtopics > 0 ? pct - monthStartPct : null;
    const subjectName =
      matchingTopics[0]?.subject_name?.trim() ||
      (assign.subject_id
        ? subjectNameById.get(assign.subject_id)
        : undefined) ||
      assign.subject?.trim() ||
      "Subject";

    rows.push({
      rowKey: buildRowKey(assign.class_id, assign.subject_id, assign.teacher_id),
      classId: assign.class_id,
      className: classNameById.get(assign.class_id) ?? "Class",
      subjectId: assign.subject_id,
      subjectName,
      teacherId: assign.teacher_id,
      teacherName: nameByTeacher.get(assign.teacher_id) ?? "Teacher",
      coveragePercent: pct,
      expectedProgressPercent,
      progressVariance: computeProgressVariance(pct, expectedProgressPercent),
      trendPercent,
      trendDirection: deriveTrendDirection(trendPercent),
      completedTopics,
      totalTopics: matchingTopics.length,
      completedSubtopics,
      totalSubtopics,
      lastUpdateAt,
      staleDays: daysSinceUpdate(lastUpdateAt),
      status: deriveCurriculumCoverageStatus(pct, totalSubtopics),
    });
  }

  rows.sort((a, b) => {
    const c = a.className.localeCompare(b.className);
    if (c !== 0) return c;
    return a.subjectName.localeCompare(b.subjectName);
  });

  const activity = await loadCurriculumActivity(
    admin,
    schoolId,
    academicYear,
    topicTitleById
  );

  const filterOptions = await loadSchoolWideFilterOptions(
    admin,
    schoolId,
    assignmentRows
  );

  return {
    rows,
    activity,
    updatesThisMonthByTeacher,
    filterOptions,
  };
}

async function loadCurriculumActivity(
  admin: Db,
  schoolId: string,
  academicYear: string,
  topicTitleById: Map<string, string>
): Promise<CurriculumActivityItem[]> {
  const { data: topicRows } = await admin
    .from("syllabus_topics")
    .select("id, class_id, subject_name")
    .eq("school_id", schoolId)
    .eq("academic_year", academicYear);

  const topics = (topicRows ?? []) as {
    id: string;
    class_id: string;
    subject_name: string;
  }[];
  if (topics.length === 0) return [];

  const topicById = new Map(topics.map((t) => [t.id, t]));
  const topicIds = topics.map((t) => t.id);

  const { data: subRows } = await admin
    .from("syllabus_subtopics")
    .select("id, topic_id, title")
    .in("topic_id", topicIds);

  const subtopics = (subRows ?? []) as {
    id: string;
    topic_id: string;
    title: string;
  }[];
  if (subtopics.length === 0) return [];

  const subById = new Map(subtopics.map((s) => [s.id, s]));
  const subtopicIds = subtopics.map((s) => s.id);

  const classIds = [...new Set(topics.map((t) => t.class_id))];
  const classNameById = new Map<string, string>();
  if (classIds.length > 0) {
    const { data: classRows } = await admin
      .from("classes")
      .select("id, name")
      .in("id", classIds);
    for (const c of (classRows ?? []) as { id: string; name: string }[]) {
      classNameById.set(c.id, c.name);
    }
  }

  const { data: progRows } = await admin
    .from("syllabus_subtopic_progress")
    .select("id, subtopic_id, teacher_id, status, updated_at")
    .in("subtopic_id", subtopicIds)
    .eq("school_id", schoolId)
    .order("updated_at", { ascending: false })
    .limit(20);

  const teacherIds = [
    ...new Set(
      ((progRows ?? []) as { teacher_id: string }[]).map((p) => p.teacher_id)
    ),
  ];
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

  return ((progRows ?? []) as {
    id: string;
    subtopic_id: string;
    teacher_id: string;
    status: string;
    updated_at: string;
  }[])
    .map((p) => {
      const sub = subById.get(p.subtopic_id);
      const topic = sub ? topicById.get(sub.topic_id) : undefined;
      return {
        id: p.id,
        subtopicTitle: sub?.title?.trim() || "Subtopic",
        topicTitle: sub
          ? topicTitleById.get(sub.topic_id)?.trim() || "Topic"
          : "Topic",
        subjectName: topic?.subject_name?.trim() || "Subject",
        className: topic
          ? classNameById.get(topic.class_id) ?? "Class"
          : "Class",
        teacherName: nameByTeacher.get(p.teacher_id) ?? "Teacher",
        status: p.status,
        updatedAt: p.updated_at,
      };
    })
    .filter((a) => a.updatedAt);
}

function computeKpis(rows: CurriculumCoverageRow[]): CurriculumCoverageKpis {
  const active = rows.filter((r) => r.totalSubtopics > 0);
  const overall =
    active.length > 0
      ? Math.round(
          active.reduce((s, r) => s + r.coveragePercent, 0) / active.length
        )
      : 0;

  const subjectsOnTrack = active.filter(
    (r) =>
      r.coveragePercent >= EXPECTED_COVERAGE_PERCENT && r.coveragePercent < 100
  ).length;

  const subjectsNeedingAttention = active.filter(
    (r) =>
      r.coveragePercent < EXPECTED_COVERAGE_PERCENT && r.coveragePercent >= 40
  ).length;

  const completedSubjects = active.filter(
    (r) => r.coveragePercent >= 100
  ).length;

  const byTeacher = new Map<string, CurriculumCoverageRow[]>();
  for (const row of active) {
    const list = byTeacher.get(row.teacherId) ?? [];
    list.push(row);
    byTeacher.set(row.teacherId, list);
  }

  let teachersBehindSchedule = 0;
  for (const teacherRows of byTeacher.values()) {
    const atRiskCount = teacherRows.filter(
      (r) => r.coveragePercent < 40
    ).length;
    if (atRiskCount >= 2 || (teacherRows.length >= 2 && atRiskCount >= 1)) {
      teachersBehindSchedule += 1;
    }
  }

  return {
    overallCoveragePercent: overall,
    subjectsOnTrack,
    subjectsNeedingAttention,
    completedSubjects,
    teachersBehindSchedule,
    totalSubjects: rows.length,
  };
}

function computeStatusSummary(
  rows: CurriculumCoverageRow[]
): CurriculumStatusSummary {
  const active = rows.filter((r) => r.totalSubtopics > 0);
  return {
    onTrack: active.filter((r) => r.status === "on_track").length,
    needsAttention: active.filter((r) => r.status === "needs_attention").length,
    atRisk: active.filter((r) => r.status === "at_risk").length,
    completed: active.filter((r) => r.status === "completed").length,
    notStarted: active.filter((r) => r.status === "not_started").length,
  };
}

function computeCoverageDistribution(
  rows: CurriculumCoverageRow[]
): CurriculumCoverageDistribution {
  const active = rows.filter((r) => r.totalSubtopics > 0);
  return {
    completed: active.filter((r) => r.status === "completed").length,
    onTrack: active.filter((r) => r.status === "on_track").length,
    needsAttention: active.filter((r) => r.status === "needs_attention").length,
    atRisk: active.filter((r) => r.status === "at_risk").length,
    notStarted: active.filter((r) => r.status === "not_started").length,
  };
}

function buildSubjectsRequiringAttention(
  rows: CurriculumCoverageRow[]
): CurriculumAttentionSubject[] {
  return rows
    .filter((r) => r.totalSubtopics > 0 && r.coveragePercent < 100)
    .sort((a, b) => a.coveragePercent - b.coveragePercent)
    .slice(0, 5)
    .map((r) => ({
      rowKey: r.rowKey,
      classId: r.classId,
      subjectId: r.subjectId,
      subjectName: r.subjectName,
      className: r.className,
      coveragePercent: r.coveragePercent,
      status: r.status,
      staleDays: r.staleDays,
    }));
}

function buildMostActiveTeachers(
  rows: CurriculumCoverageRow[],
  updatesThisMonthByTeacher: Map<string, number>
): CurriculumActiveTeacher[] {
  const byTeacher = new Map<string, CurriculumActiveTeacher & { coverages: number[] }>();

  for (const row of rows) {
    const existing = byTeacher.get(row.teacherId);
    if (!existing) {
      byTeacher.set(row.teacherId, {
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        lastActivityAt: row.lastUpdateAt,
        updatesThisMonth: updatesThisMonthByTeacher.get(row.teacherId) ?? 0,
        averageCoverage: 0,
        coverages: row.totalSubtopics > 0 ? [row.coveragePercent] : [],
      });
      continue;
    }
    if (row.totalSubtopics > 0) {
      existing.coverages.push(row.coveragePercent);
    }
    if (
      row.lastUpdateAt &&
      (!existing.lastActivityAt ||
        new Date(row.lastUpdateAt).getTime() >
          new Date(existing.lastActivityAt).getTime())
    ) {
      existing.lastActivityAt = row.lastUpdateAt;
    }
  }

  return [...byTeacher.values()]
    .map((t) => ({
      teacherId: t.teacherId,
      teacherName: t.teacherName,
      lastActivityAt: t.lastActivityAt,
      updatesThisMonth: t.updatesThisMonth,
      averageCoverage:
        t.coverages.length > 0
          ? Math.round(
              t.coverages.reduce((s, v) => s + v, 0) / t.coverages.length
            )
          : 0,
    }))
    .filter((t) => t.updatesThisMonth > 0 || t.lastActivityAt)
    .sort((a, b) => {
      if (b.updatesThisMonth !== a.updatesThisMonth) {
        return b.updatesThisMonth - a.updatesThisMonth;
      }
      const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 5);
}

function buildTeacherSummaries(
  rows: CurriculumCoverageRow[]
): CurriculumTeacherSummaryRow[] {
  const byTeacher = new Map<string, CurriculumCoverageRow[]>();
  for (const row of rows) {
    const list = byTeacher.get(row.teacherId) ?? [];
    list.push(row);
    byTeacher.set(row.teacherId, list);
  }

  return [...byTeacher.entries()]
    .map(([teacherId, teacherRows]) => {
      const active = teacherRows.filter((r) => r.totalSubtopics > 0);
      const avg =
        active.length > 0
          ? Math.round(
              active.reduce((s, r) => s + r.coveragePercent, 0) / active.length
            )
          : 0;
      let lastActivityAt: string | null = null;
      for (const r of teacherRows) {
        if (
          r.lastUpdateAt &&
          (!lastActivityAt ||
            new Date(r.lastUpdateAt).getTime() >
              new Date(lastActivityAt).getTime())
        ) {
          lastActivityAt = r.lastUpdateAt;
        }
      }
      const trend = averageTrend(active.map((r) => r.trendPercent));
      return {
        teacherId,
        teacherName: teacherRows[0]?.teacherName ?? "Teacher",
        subjectsAssigned: teacherRows.length,
        averageCoverage: avg,
        lastActivityAt,
        subjectsAtRisk: active.filter((r) => r.status === "at_risk").length,
        trendPercent: trend.trendPercent,
        trendDirection: trend.trendDirection,
        behindSchedule: isTeacherBehindSchedule(teacherRows),
        status: aggregateTeacherStatus(active),
      };
    })
    .sort((a, b) => a.teacherName.localeCompare(b.teacherName));
}

function buildClassSummaries(
  rows: CurriculumCoverageRow[]
): CurriculumClassSummaryRow[] {
  const byClass = new Map<string, CurriculumCoverageRow[]>();
  for (const row of rows) {
    const list = byClass.get(row.classId) ?? [];
    list.push(row);
    byClass.set(row.classId, list);
  }

  return [...byClass.entries()]
    .map(([classId, classRows]) => {
      const active = classRows.filter((r) => r.totalSubtopics > 0);
      const avg =
        active.length > 0
          ? Math.round(
              active.reduce((s, r) => s + r.coveragePercent, 0) / active.length
            )
          : 0;
      const trend = averageTrend(active.map((r) => r.trendPercent));
      return {
        classId,
        className: classRows[0]?.className ?? "Class",
        subjectsCount: classRows.length,
        averageCoverage: avg,
        completedSubjects: active.filter((r) => r.coveragePercent >= 100)
          .length,
        atRiskSubjects: active.filter((r) => r.status === "at_risk").length,
        trendPercent: trend.trendPercent,
        trendDirection: trend.trendDirection,
        status: aggregateTeacherStatus(active),
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className));
}

function filterOverviewRows(
  rows: CurriculumCoverageRow[],
  params: {
    search?: string;
    classId?: string;
    subjectId?: string;
    teacherId?: string;
    statusFilter?: CurriculumCoverageStatusFilter;
  }
): CurriculumCoverageRow[] {
  const q = params.search?.trim().toLowerCase() ?? "";
  return rows.filter((r) => {
    if (params.classId && r.classId !== params.classId) return false;
    if (
      params.subjectId &&
      r.subjectId !== params.subjectId &&
      r.subjectName !== params.subjectId
    ) {
      return false;
    }
    if (params.teacherId && r.teacherId !== params.teacherId) return false;
    if (
      params.statusFilter &&
      params.statusFilter !== "all" &&
      r.status !== params.statusFilter
    ) {
      return false;
    }
    if (!q) return true;
    return (
      r.subjectName.toLowerCase().includes(q) ||
      r.className.toLowerCase().includes(q) ||
      r.teacherName.toLowerCase().includes(q)
    );
  });
}

export async function loadCurriculumCoveragePage(params: {
  schoolId: string;
  academicYear: string;
  search?: string;
  classId?: string;
  subjectId?: string;
  teacherId?: string;
  statusFilter?: CurriculumCoverageStatusFilter;
  overviewPage?: number;
  overviewPageSize?: number;
  teacherPage?: number;
  teacherPageSize?: number;
  classPage?: number;
  classPageSize?: number;
  teacherSort?: "coverage" | "teacher" | "activity";
  teacherSortDir?: "asc" | "desc";
  behindScheduleOnly?: boolean;
}): Promise<CurriculumCoveragePageResult> {
  const dataset = await loadCurriculumCoverageDataset(
    params.schoolId,
    params.academicYear
  );

  const filtered = filterOverviewRows(dataset.rows, params);
  const kpis = computeKpis(dataset.rows);
  const health = computeCurriculumHealth(dataset.rows, kpis);
  const executiveSummary = buildExecutiveSummary(dataset.rows, kpis, health);
  const statusSummary = computeStatusSummary(dataset.rows);
  const coverageDistribution = computeCoverageDistribution(dataset.rows);
  const subjectsRequiringAttention = buildSubjectsRequiringAttention(
    filterOverviewRows(dataset.rows, params)
  );
  const mostActiveTeachers = buildMostActiveTeachers(
    dataset.rows,
    dataset.updatesThisMonthByTeacher
  );
  const insights = buildCurriculumInsights(dataset.rows, dataset.activity);

  let teacherRows = buildTeacherSummaries(
    params.behindScheduleOnly ? dataset.rows : filtered
  );
  if (params.behindScheduleOnly) {
    teacherRows = teacherRows.filter((t) => t.behindSchedule);
  }
  if (params.teacherSort === "coverage") {
    teacherRows.sort((a, b) =>
      params.teacherSortDir === "asc"
        ? a.averageCoverage - b.averageCoverage
        : b.averageCoverage - a.averageCoverage
    );
  } else if (params.teacherSort === "activity") {
    teacherRows.sort((a, b) => {
      const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return params.teacherSortDir === "asc" ? ta - tb : tb - ta;
    });
  }

  const classRows = buildClassSummaries(filtered);

  const overviewPage = params.overviewPage ?? 0;
  const overviewPageSize = params.overviewPageSize ?? 10;
  const teacherPage = params.teacherPage ?? 0;
  const teacherPageSize = params.teacherPageSize ?? 10;
  const classPage = params.classPage ?? 0;
  const classPageSize = params.classPageSize ?? 10;

  const overviewStart = overviewPage * overviewPageSize;
  const teacherStart = teacherPage * teacherPageSize;
  const classStart = classPage * classPageSize;

  return {
    kpis,
    health,
    executiveSummary,
    statusSummary,
    coverageDistribution,
    subjectsRequiringAttention,
    mostActiveTeachers,
    overviewRows: filtered.slice(
      overviewStart,
      overviewStart + overviewPageSize
    ),
    teacherRows: teacherRows.slice(teacherStart, teacherStart + teacherPageSize),
    classRows: classRows.slice(classStart, classStart + classPageSize),
    activity: dataset.activity,
    insights,
    filterOptions: dataset.filterOptions,
    totalOverview: filtered.length,
    totalTeachers: teacherRows.length,
    totalClasses: classRows.length,
    refreshedAt: new Date().toISOString(),
  };
}

export async function loadCurriculumCoverageExportRows(params: {
  schoolId: string;
  academicYear: string;
  search?: string;
  classId?: string;
  subjectId?: string;
  teacherId?: string;
  statusFilter?: CurriculumCoverageStatusFilter;
}): Promise<CurriculumCoverageRow[]> {
  const dataset = await loadCurriculumCoverageDataset(
    params.schoolId,
    params.academicYear
  );
  return filterOverviewRows(dataset.rows, params);
}
