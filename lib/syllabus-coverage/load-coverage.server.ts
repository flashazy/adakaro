import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClassCluster } from "@/lib/class-cluster";
import {
  buildCoverageSummary,
  coveragePercent,
  isTopicComplete,
} from "@/lib/syllabus-coverage/coverage-stats";
import type {
  SyllabusClassOption,
  SyllabusCoverageOverviewRow,
  SyllabusCoverageSummary,
  SyllabusSubjectOption,
  SyllabusSubtopicRow,
  SyllabusSubtopicStatus,
  SyllabusTopicRow,
  TeacherSyllabusAssignment,
} from "@/lib/syllabus-coverage/types";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import {
  formatSyllabusSubtopicTitle,
  formatSyllabusTopicTitle,
} from "@/lib/syllabus-coverage/syllabus-text-format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

function parseStatus(raw: string | null | undefined): SyllabusSubtopicStatus {
  if (raw === "in_progress" || raw === "completed") return raw;
  return "not_started";
}

export async function loadCoordinatorClassesForSyllabus(
  userId: string
): Promise<SyllabusClassOption[]> {
  const admin = createAdminClient() as Db;
  const { data: coordRows } = await admin
    .from("teacher_coordinators")
    .select("class_id, school_id")
    .eq("teacher_id", userId);

  const classIds = [
    ...new Set(
      ((coordRows ?? []) as { class_id: string }[]).map((r) => r.class_id)
    ),
  ];
  if (classIds.length === 0) return [];

  const { data: classRows } = await admin
    .from("classes")
    .select("id, name, school_id")
    .in("id", classIds)
    .order("name", { ascending: true });

  return ((classRows ?? []) as {
    id: string;
    name: string;
    school_id: string;
  }[]).map((r) => ({
    id: r.id,
    name: r.name,
    schoolId: r.school_id,
  }));
}

export async function loadSubjectsForSyllabusClass(
  classId: string
): Promise<SyllabusSubjectOption[]> {
  const admin = createAdminClient() as Db;
  const cluster = await resolveClassCluster(admin, classId);
  const { data: scRows } = await admin
    .from("subject_classes")
    .select("subject_id, subjects ( id, name )")
    .in("class_id", cluster.classIds);

  const seen = new Map<string, SyllabusSubjectOption>();
  for (const r of (scRows ?? []) as {
    subject_id: string;
    subjects: { id: string; name: string } | null;
  }[]) {
    const id = r.subjects?.id ?? r.subject_id;
    const name = r.subjects?.name?.trim() || "Subject";
    if (!seen.has(id)) seen.set(id, { subjectId: id, name });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadSyllabusWorkspace(params: {
  classId: string;
  subjectId: string | null;
  academicYear: string;
  teacherId?: string | null;
}): Promise<{
  className: string;
  topics: SyllabusTopicRow[];
  summary: SyllabusCoverageSummary;
}> {
  const admin = createAdminClient() as Db;
  const cluster = await resolveClassCluster(admin, params.classId);

  const { data: classRow } = await admin
    .from("classes")
    .select("name")
    .eq("id", cluster.rootClassId)
    .maybeSingle();
  const className =
    (classRow as { name: string } | null)?.name?.trim() || "Class";

  let topicQuery = admin
    .from("syllabus_topics")
    .select("id, title, description, sort_order, subject_id")
    .in("class_id", cluster.classIds)
    .eq("academic_year", params.academicYear)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (params.subjectId) {
    topicQuery = topicQuery.eq("subject_id", params.subjectId);
  }

  const { data: topicRows, error: topicErr } = await topicQuery;
  if (topicErr) throw topicErr;

  const topics = (topicRows ?? []) as {
    id: string;
    title: string;
    description: string | null;
    sort_order: number;
    subject_id: string | null;
  }[];

  const topicIds = topics.map((t) => t.id);
  const subtopicsByTopic = new Map<string, SyllabusSubtopicRow[]>();

  if (topicIds.length > 0) {
    const { data: subRows, error: subErr } = await admin
      .from("syllabus_subtopics")
      .select("id, topic_id, title, description, sort_order")
      .in("topic_id", topicIds)
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });
    if (subErr) throw subErr;

    const subtopicIds = ((subRows ?? []) as { id: string }[]).map((s) => s.id);
    const progressBySubtopic = new Map<
      string,
      {
        status: SyllabusSubtopicStatus;
        completedAt: string | null;
        updatedAt: string | null;
      }
    >();

    if (subtopicIds.length > 0 && params.teacherId) {
      const { data: progRows } = await admin
        .from("syllabus_subtopic_progress")
        .select("subtopic_id, status, completed_at, updated_at")
        .in("subtopic_id", subtopicIds)
        .eq("teacher_id", params.teacherId);

      for (const p of (progRows ?? []) as {
        subtopic_id: string;
        status: string;
        completed_at: string | null;
        updated_at: string | null;
      }[]) {
        progressBySubtopic.set(p.subtopic_id, {
          status: parseStatus(p.status),
          completedAt: p.completed_at,
          updatedAt: p.updated_at,
        });
      }

      const notesBySubtopic = new Map<
        string,
        { note: string; updatedAt: string }
      >();
      const { data: noteRows } = await admin
        .from("syllabus_subtopic_notes")
        .select("subtopic_id, note, updated_at")
        .in("subtopic_id", subtopicIds)
        .eq("teacher_id", params.teacherId);

      for (const n of (noteRows ?? []) as {
        subtopic_id: string;
        note: string;
        updated_at: string;
      }[]) {
        notesBySubtopic.set(n.subtopic_id, {
          note: n.note,
          updatedAt: n.updated_at,
        });
      }

      for (const s of (subRows ?? []) as {
        id: string;
        topic_id: string;
        title: string;
        description: string | null;
        sort_order: number;
      }[]) {
        const prog = progressBySubtopic.get(s.id);
        const noteRow = notesBySubtopic.get(s.id);
        const row: SyllabusSubtopicRow = {
          id: s.id,
          topicId: s.topic_id,
          title: formatSyllabusSubtopicTitle(s.title),
          description: s.description,
          sortOrder: s.sort_order,
          status: prog?.status ?? "not_started",
          completedAt: prog?.completedAt ?? null,
          updatedAt: prog?.updatedAt ?? null,
          note: noteRow?.note ?? null,
          noteUpdatedAt: noteRow?.updatedAt ?? null,
        };
        const list = subtopicsByTopic.get(s.topic_id) ?? [];
        list.push(row);
        subtopicsByTopic.set(s.topic_id, list);
      }
    } else {
      for (const s of (subRows ?? []) as {
        id: string;
        topic_id: string;
        title: string;
        description: string | null;
        sort_order: number;
      }[]) {
        const prog = progressBySubtopic.get(s.id);
        const row: SyllabusSubtopicRow = {
          id: s.id,
          topicId: s.topic_id,
          title: formatSyllabusSubtopicTitle(s.title),
          description: s.description,
          sortOrder: s.sort_order,
          status: prog?.status ?? "not_started",
          completedAt: prog?.completedAt ?? null,
          updatedAt: prog?.updatedAt ?? null,
          note: null,
          noteUpdatedAt: null,
        };
        const list = subtopicsByTopic.get(s.topic_id) ?? [];
        list.push(row);
        subtopicsByTopic.set(s.topic_id, list);
      }
    }
  }

  const topicResults: SyllabusTopicRow[] = topics.map((t) => {
    const subtopics = subtopicsByTopic.get(t.id) ?? [];
    const completedSubtopics = subtopics.filter(
      (s) => s.status === "completed"
    ).length;
    const totalSubtopics = subtopics.length;
    const statuses = subtopics.map((s) => s.status);
    return {
      id: t.id,
      title: formatSyllabusTopicTitle(t.title),
      description: t.description,
      sortOrder: t.sort_order,
      subtopics,
      completedSubtopics,
      totalSubtopics,
      coveragePercent: coveragePercent(completedSubtopics, totalSubtopics),
      isTopicComplete: isTopicComplete(statuses),
    };
  });

  const allStatuses = topicResults.flatMap((t) =>
    t.subtopics.map((s) => s.status)
  );

  return {
    className,
    topics: topicResults,
    summary: buildCoverageSummary(allStatuses, topicResults.length),
  };
}

export async function loadTeacherSyllabusAssignments(
  userId: string
): Promise<TeacherSyllabusAssignment[]> {
  const admin = createAdminClient() as Db;
  const { data: rows } = await admin
    .from("teacher_assignments")
    .select(
      "id, class_id, school_id, subject, subject_id, academic_year, subjects ( name ), classes ( name )"
    )
    .eq("teacher_id", userId)
    .order("academic_year", { ascending: false });

  return ((rows ?? []) as {
    id: string;
    class_id: string;
    school_id: string;
    subject: string;
    subject_id: string | null;
    academic_year: string;
    subjects: { name: string } | null;
    classes: { name: string } | null;
  }[]).map((r) => ({
    assignmentId: r.id,
    classId: r.class_id,
    className: r.classes?.name?.trim() || "Class",
    subjectId: r.subject_id,
    subjectName: r.subjects?.name?.trim() || r.subject?.trim() || "Subject",
    academicYear: r.academic_year?.trim() || String(currentAcademicYear()),
    schoolId: r.school_id,
  }));
}

export async function loadSchoolSyllabusCoverageOverview(
  schoolId: string,
  academicYear: string
): Promise<SyllabusCoverageOverviewRow[]> {
  const admin = createAdminClient() as Db;

  const { data: topicRows } = await admin
    .from("syllabus_topics")
    .select("id, class_id, subject_id, subject_name")
    .eq("school_id", schoolId)
    .eq("academic_year", academicYear);

  const topics = (topicRows ?? []) as {
    id: string;
    class_id: string;
    subject_id: string | null;
    subject_name: string;
  }[];
  if (topics.length === 0) return [];

  const topicIds = topics.map((t) => t.id);
  const { data: subRows } = await admin
    .from("syllabus_subtopics")
    .select("id, topic_id")
    .in("topic_id", topicIds);

  const subtopics = (subRows ?? []) as { id: string; topic_id: string }[];
  const subtopicIds = subtopics.map((s) => s.id);
  const subtopicsByTopic = new Map<string, string[]>();
  for (const s of subtopics) {
    const list = subtopicsByTopic.get(s.topic_id) ?? [];
    list.push(s.id);
    subtopicsByTopic.set(s.topic_id, list);
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

  const progressBySubtopicTeacher = new Map<string, SyllabusSubtopicStatus>();
  if (subtopicIds.length > 0) {
    const { data: progRows } = await admin
      .from("syllabus_subtopic_progress")
      .select("subtopic_id, teacher_id, status")
      .in("subtopic_id", subtopicIds);
    for (const p of (progRows ?? []) as {
      subtopic_id: string;
      teacher_id: string;
      status: string;
    }[]) {
      progressBySubtopicTeacher.set(
        `${p.subtopic_id}:${p.teacher_id}`,
        parseStatus(p.status)
      );
    }
  }

  const overview: SyllabusCoverageOverviewRow[] = [];

  const clusterCache = new Map<string, Set<string>>();
  async function classClusterSet(classId: string): Promise<Set<string>> {
    const cached = clusterCache.get(classId);
    if (cached) return cached;
    const cluster = await resolveClassCluster(admin, classId);
    const set = new Set(cluster.classIds);
    for (const id of cluster.classIds) clusterCache.set(id, set);
    return set;
  }

  for (const assign of assignmentRows) {
    const assignCluster = await classClusterSet(assign.class_id);
    const matchingTopics = topics.filter(
      (t) =>
        assignCluster.has(t.class_id) &&
        (assign.subject_id == null ||
          t.subject_id == null ||
          t.subject_id === assign.subject_id)
    );
    if (matchingTopics.length === 0) continue;

    let totalSubtopics = 0;
    let completedSubtopics = 0;
    for (const topic of matchingTopics) {
      const subs = subtopicsByTopic.get(topic.id) ?? [];
      totalSubtopics += subs.length;
      for (const subId of subs) {
        const status =
          progressBySubtopicTeacher.get(`${subId}:${assign.teacher_id}`) ??
          "not_started";
        if (status === "completed") completedSubtopics += 1;
      }
    }

    overview.push({
      classId: assign.class_id,
      className: classNameById.get(assign.class_id) ?? "Class",
      subjectId: assign.subject_id,
      subjectName:
        matchingTopics[0]?.subject_name?.trim() ||
        assign.subject?.trim() ||
        "Subject",
      teacherId: assign.teacher_id,
      teacherName: nameByTeacher.get(assign.teacher_id) ?? "Teacher",
      totalSubtopics,
      completedSubtopics,
      coveragePercent: coveragePercent(completedSubtopics, totalSubtopics),
    });
  }

  return overview.sort((a, b) => {
    const c = a.className.localeCompare(b.className);
    if (c !== 0) return c;
    return a.subjectName.localeCompare(b.subjectName);
  });
}
