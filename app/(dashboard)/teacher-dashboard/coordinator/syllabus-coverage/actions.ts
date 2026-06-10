"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertCoordinatorForClass,
  requireSignedInUser,
} from "@/lib/syllabus-coverage/access.server";
import {
  loadCoordinatorClassesForSyllabus,
  loadSchoolSyllabusCoverageOverview,
  loadSubjectsForSyllabusClass,
  loadSyllabusWorkspace,
} from "@/lib/syllabus-coverage/load-coverage.server";
import { parseBulkSyllabusText } from "@/lib/syllabus-coverage/parse-bulk-syllabus";
import {
  formatSyllabusSubtopicTitle,
  formatSyllabusTopicTitle,
  syllabusTextKey,
} from "@/lib/syllabus-coverage/syllabus-text-format";
import {
  reportSyllabusHealthAlert,
  SYLLABUS_HEALTH_REASONS,
} from "@/lib/syllabus-coverage/syllabus-health-alerts";
import type {
  SyllabusClassOption,
  SyllabusCoverageOverviewRow,
  SyllabusSubjectOption,
  SyllabusTopicRow,
  SyllabusCoverageSummary,
} from "@/lib/syllabus-coverage/types";

const COORDINATOR_SYLLABUS_PATH =
  "/teacher-dashboard/coordinator/syllabus-coverage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = any;

function revalidateCoordinatorSyllabus() {
  revalidatePath(COORDINATOR_SYLLABUS_PATH);
}

async function loadExistingTopicTitleKeys(
  admin: AdminDb,
  params: {
    classId: string;
    subjectId: string | null;
    academicYear: string;
  }
): Promise<Set<string>> {
  let query = admin
    .from("syllabus_topics")
    .select("title")
    .eq("class_id", params.classId)
    .eq("academic_year", params.academicYear);
  if (params.subjectId) {
    query = query.eq("subject_id", params.subjectId);
  }
  const { data } = await query;
  const keys = new Set<string>();
  for (const row of (data ?? []) as { title: string }[]) {
    keys.add(syllabusTextKey(row.title));
  }
  return keys;
}

async function loadExistingSubtopicTitleKeys(
  admin: AdminDb,
  topicId: string
): Promise<Set<string>> {
  const { data } = await admin
    .from("syllabus_subtopics")
    .select("title")
    .eq("topic_id", topicId);
  const keys = new Set<string>();
  for (const row of (data ?? []) as { title: string }[]) {
    keys.add(syllabusTextKey(row.title));
  }
  return keys;
}

async function topicTitleTakenByOther(
  admin: AdminDb,
  params: {
    classId: string;
    subjectId: string | null;
    academicYear: string;
  },
  title: string,
  excludeTopicId: string
): Promise<boolean> {
  let query = admin
    .from("syllabus_topics")
    .select("id, title")
    .eq("class_id", params.classId)
    .eq("academic_year", params.academicYear.trim())
    .neq("id", excludeTopicId);
  if (params.subjectId) {
    query = query.eq("subject_id", params.subjectId);
  }
  const { data } = await query;
  const key = syllabusTextKey(title);
  return ((data ?? []) as { title: string }[]).some(
    (row) => syllabusTextKey(row.title) === key
  );
}

async function subtopicTitleTakenByOther(
  admin: AdminDb,
  topicId: string,
  title: string,
  excludeSubtopicId: string
): Promise<boolean> {
  const { data } = await admin
    .from("syllabus_subtopics")
    .select("id, title")
    .eq("topic_id", topicId)
    .neq("id", excludeSubtopicId);
  const key = syllabusTextKey(title);
  return ((data ?? []) as { title: string }[]).some(
    (row) => syllabusTextKey(row.title) === key
  );
}

export async function loadCoordinatorSyllabusClassesAction(): Promise<
  | { ok: true; classes: SyllabusClassOption[] }
  | { ok: false; error: string }
> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  try {
    const classes = await loadCoordinatorClassesForSyllabus(auth.user.id);
    return { ok: true, classes };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.coverageLoadFailed,
      error: err,
    });
    return { ok: false, error: "Could not load coordinator classes." };
  }
}

export async function loadCoordinatorSyllabusSubjectsAction(
  classId: string
): Promise<
  | { ok: true; subjects: SyllabusSubjectOption[] }
  | { ok: false; error: string }
> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  const access = await assertCoordinatorForClass(auth.user.id, classId);
  if (!access.ok) return { ok: false, error: access.error };
  try {
    const subjects = await loadSubjectsForSyllabusClass(classId);
    return { ok: true, subjects };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.coverageLoadFailed,
      schoolId: access.schoolId,
      metadata: { class_id: classId },
      error: err,
    });
    return { ok: false, error: "Could not load subjects." };
  }
}

export async function loadCoordinatorSyllabusWorkspaceAction(input: {
  classId: string;
  subjectId: string | null;
  academicYear: string;
}): Promise<
  | {
      ok: true;
      className: string;
      topics: SyllabusTopicRow[];
      summary: SyllabusCoverageSummary;
      overview: SyllabusCoverageOverviewRow[];
    }
  | { ok: false; error: string }
> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  const access = await assertCoordinatorForClass(auth.user.id, input.classId);
  if (!access.ok) return { ok: false, error: access.error };

  try {
    const workspace = await loadSyllabusWorkspace({
      classId: input.classId,
      subjectId: input.subjectId,
      academicYear: input.academicYear,
    });
    const overview = await loadSchoolSyllabusCoverageOverview(
      access.schoolId,
      input.academicYear
    );
    const filteredOverview = overview.filter(
      (row) =>
        row.classId === input.classId &&
        (input.subjectId == null || row.subjectId === input.subjectId)
    );
    return {
      ok: true,
      ...workspace,
      overview: filteredOverview,
    };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.coverageLoadFailed,
      schoolId: access.schoolId,
      metadata: {
        class_id: input.classId,
        subject_id: input.subjectId ?? undefined,
      },
      error: err,
    });
    return { ok: false, error: "Could not load syllabus coverage." };
  }
}

export async function saveSyllabusTopicAction(input: {
  classId: string;
  subjectId: string | null;
  subjectName: string;
  academicYear: string;
  topicId?: string | null;
  title: string;
  description?: string | null;
  sortOrder?: number;
}): Promise<{ ok: true; topicId: string } | { ok: false; error: string }> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  const access = await assertCoordinatorForClass(auth.user.id, input.classId);
  if (!access.ok) return { ok: false, error: access.error };

  const title = formatSyllabusTopicTitle(input.title);
  if (!title) return { ok: false, error: "Topic title is required." };

  const admin = createAdminClient() as AdminDb;

  if (input.topicId) {
    const taken = await topicTitleTakenByOther(
      admin,
      {
        classId: input.classId,
        subjectId: input.subjectId,
        academicYear: input.academicYear,
      },
      title,
      input.topicId
    );
    if (taken) {
      return {
        ok: false,
        error: "A topic with this title already exists for this class and subject.",
      };
    }
  } else {
    const existing = await loadExistingTopicTitleKeys(admin, {
      classId: input.classId,
      subjectId: input.subjectId,
      academicYear: input.academicYear.trim(),
    });
    if (existing.has(syllabusTextKey(title))) {
      return {
        ok: false,
        error: "A topic with this title already exists for this class and subject.",
      };
    }
  }

  const payload = {
    school_id: access.schoolId,
    class_id: input.classId,
    subject_id: input.subjectId,
    subject_name: input.subjectName.trim() || "Subject",
    academic_year: input.academicYear.trim(),
    title,
    description: input.description?.trim() || null,
    sort_order: input.sortOrder ?? 0,
    created_by: auth.user.id,
  };

  try {
    if (input.topicId) {
      const { error } = await admin
        .from("syllabus_topics")
        .update({
          title: payload.title,
          description: payload.description,
          sort_order: payload.sort_order,
          subject_name: payload.subject_name,
        })
        .eq("id", input.topicId)
        .eq("class_id", input.classId);
      if (error) throw error;
      revalidateCoordinatorSyllabus();
      return { ok: true, topicId: input.topicId };
    }

    const { data, error } = await admin
      .from("syllabus_topics")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    revalidateCoordinatorSyllabus();
    return { ok: true, topicId: (data as { id: string }).id };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: input.topicId
        ? SYLLABUS_HEALTH_REASONS.topicEditFailed
        : SYLLABUS_HEALTH_REASONS.topicSaveFailed,
      schoolId: access.schoolId,
      metadata: {
        class_id: input.classId,
        subject_id: input.subjectId ?? undefined,
        topic_id: input.topicId ?? undefined,
      },
      error: err,
    });
    return {
      ok: false,
      error: input.topicId ? "Could not update topic." : "Could not save topic.",
    };
  }
}

export async function deleteSyllabusTopicAction(input: {
  classId: string;
  topicId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  const access = await assertCoordinatorForClass(auth.user.id, input.classId);
  if (!access.ok) return { ok: false, error: access.error };

  try {
    const admin = createAdminClient() as AdminDb;
    const { error } = await admin
      .from("syllabus_topics")
      .delete()
      .eq("id", input.topicId)
      .eq("class_id", input.classId);
    if (error) throw error;
    revalidateCoordinatorSyllabus();
    return { ok: true };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.topicSaveFailed,
      schoolId: access.schoolId,
      metadata: { class_id: input.classId, topic_id: input.topicId },
      error: err,
    });
    return { ok: false, error: "Could not delete topic." };
  }
}

export async function saveSyllabusSubtopicAction(input: {
  classId: string;
  topicId: string;
  subtopicId?: string | null;
  title: string;
  description?: string | null;
  sortOrder?: number;
}): Promise<{ ok: true; subtopicId: string } | { ok: false; error: string }> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  const access = await assertCoordinatorForClass(auth.user.id, input.classId);
  if (!access.ok) return { ok: false, error: access.error };

  const title = formatSyllabusSubtopicTitle(input.title);
  if (!title) return { ok: false, error: "Subtopic title is required." };

  const admin = createAdminClient() as AdminDb;
  const { data: topicRow } = await admin
    .from("syllabus_topics")
    .select("id")
    .eq("id", input.topicId)
    .eq("class_id", input.classId)
    .maybeSingle();
  if (!topicRow) return { ok: false, error: "Topic not found." };

  if (input.subtopicId) {
    const taken = await subtopicTitleTakenByOther(
      admin,
      input.topicId,
      title,
      input.subtopicId
    );
    if (taken) {
      return {
        ok: false,
        error: "A subtopic with this title already exists under this topic.",
      };
    }
  } else {
    const existingSubs = await loadExistingSubtopicTitleKeys(admin, input.topicId);
    if (existingSubs.has(syllabusTextKey(title))) {
      return {
        ok: false,
        error: "A subtopic with this title already exists under this topic.",
      };
    }
  }

  const payload = {
    topic_id: input.topicId,
    title,
    description: input.description?.trim() || null,
    sort_order: input.sortOrder ?? 0,
  };

  try {
    if (input.subtopicId) {
      const { error } = await admin
        .from("syllabus_subtopics")
        .update(payload)
        .eq("id", input.subtopicId)
        .eq("topic_id", input.topicId);
      if (error) throw error;
      revalidateCoordinatorSyllabus();
      return { ok: true, subtopicId: input.subtopicId };
    }

    const { data, error } = await admin
      .from("syllabus_subtopics")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    revalidateCoordinatorSyllabus();
    return { ok: true, subtopicId: (data as { id: string }).id };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: input.subtopicId
        ? SYLLABUS_HEALTH_REASONS.subtopicEditFailed
        : SYLLABUS_HEALTH_REASONS.subtopicSaveFailed,
      schoolId: access.schoolId,
      metadata: {
        class_id: input.classId,
        topic_id: input.topicId,
        subtopic_id: input.subtopicId ?? undefined,
      },
      error: err,
    });
    return {
      ok: false,
      error: input.subtopicId
        ? "Could not update subtopic."
        : "Could not save subtopic.",
    };
  }
}

export async function deleteSyllabusSubtopicAction(input: {
  classId: string;
  topicId: string;
  subtopicId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  const access = await assertCoordinatorForClass(auth.user.id, input.classId);
  if (!access.ok) return { ok: false, error: access.error };

  try {
    const admin = createAdminClient() as AdminDb;
    const { error } = await admin
      .from("syllabus_subtopics")
      .delete()
      .eq("id", input.subtopicId)
      .eq("topic_id", input.topicId);
    if (error) throw error;
    revalidateCoordinatorSyllabus();
    return { ok: true };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.subtopicSaveFailed,
      schoolId: access.schoolId,
      metadata: {
        class_id: input.classId,
        topic_id: input.topicId,
        subtopic_id: input.subtopicId,
      },
      error: err,
    });
    return { ok: false, error: "Could not delete subtopic." };
  }
}

export async function bulkImportSyllabusAction(input: {
  classId: string;
  subjectId: string | null;
  subjectName: string;
  academicYear: string;
  text: string;
}): Promise<
  | {
      ok: true;
      createdTopics: number;
      createdSubtopics: number;
      skippedTopics: number;
      skippedSubtopics: number;
      message: string;
    }
  | { ok: false; error: string }
> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  const access = await assertCoordinatorForClass(auth.user.id, input.classId);
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = parseBulkSyllabusText(input.text);
  if (parsed.topics.length === 0) {
    return {
      ok: false,
      error: "No topics found in pasted text. Check the format and try again.",
    };
  }

  const admin = createAdminClient() as AdminDb;
  const existingTopicKeys = await loadExistingTopicTitleKeys(admin, {
    classId: input.classId,
    subjectId: input.subjectId,
    academicYear: input.academicYear.trim(),
  });

  const { data: lastTopic } = await admin
    .from("syllabus_topics")
    .select("sort_order")
    .eq("class_id", input.classId)
    .eq("academic_year", input.academicYear.trim())
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSort =
    ((lastTopic as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const createdTopicIds: string[] = [];
  let createdTopics = 0;
  let createdSubtopics = 0;
  let skippedTopics = 0;
  let skippedSubtopics = 0;

  try {
    for (const topic of parsed.topics) {
      const formattedTopicTitle = formatSyllabusTopicTitle(topic.title);
      const topicKey = syllabusTextKey(formattedTopicTitle);
      if (existingTopicKeys.has(topicKey)) {
        skippedTopics += 1;
        continue;
      }

      const { data: topicRow, error: topicErr } = await admin
        .from("syllabus_topics")
        .insert({
          school_id: access.schoolId,
          class_id: input.classId,
          subject_id: input.subjectId,
          subject_name: input.subjectName.trim() || "Subject",
          academic_year: input.academicYear.trim(),
          title: formattedTopicTitle,
          sort_order: nextSort,
          created_by: auth.user.id,
        })
        .select("id")
        .single();

      if (topicErr || !topicRow) throw topicErr ?? new Error("topic_insert_failed");

      const topicId = (topicRow as { id: string }).id;
      createdTopicIds.push(topicId);
      existingTopicKeys.add(topicKey);
      createdTopics += 1;
      nextSort += 1;

      const subKeys = new Set<string>();
      let subSort = 0;
      for (const subTitle of topic.subtopics) {
        const formattedSubTitle = formatSyllabusSubtopicTitle(subTitle);
        const subKey = syllabusTextKey(formattedSubTitle);
        if (subKeys.has(subKey)) {
          skippedSubtopics += 1;
          continue;
        }
        subKeys.add(subKey);

        const { error: subErr } = await admin.from("syllabus_subtopics").insert({
          topic_id: topicId,
          title: formattedSubTitle,
          sort_order: subSort,
        });
        if (subErr) throw subErr;
        createdSubtopics += 1;
        subSort += 1;
      }
    }

    revalidateCoordinatorSyllabus();

    const parts: string[] = [];
    if (createdTopics > 0) {
      parts.push(
        `${createdTopics} topic${createdTopics === 1 ? "" : "s"} and ${createdSubtopics} subtopic${createdSubtopics === 1 ? "" : "s"} imported`
      );
    }
    if (skippedTopics > 0) {
      parts.push(
        `${skippedTopics} duplicate topic${skippedTopics === 1 ? "" : "s"} skipped`
      );
    }
    if (skippedSubtopics > 0) {
      parts.push(
        `${skippedSubtopics} duplicate subtopic${skippedSubtopics === 1 ? "" : "s"} skipped`
      );
    }

    return {
      ok: true,
      createdTopics,
      createdSubtopics,
      skippedTopics,
      skippedSubtopics,
      message:
        parts.length > 0
          ? parts.join(". ") + "."
          : "Nothing new to import — all topics already exist.",
    };
  } catch (err) {
    if (createdTopicIds.length > 0) {
      await admin.from("syllabus_topics").delete().in("id", createdTopicIds);
    }
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.bulkImportFailed,
      schoolId: access.schoolId,
      metadata: {
        class_id: input.classId,
        subject_id: input.subjectId ?? undefined,
      },
      error: err,
    });
    return {
      ok: false,
      error:
        "Import failed partway through. No partial syllabus was saved. Please try again.",
    };
  }
}
