"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertTeacherAssignedToClassSubject,
  requireSignedInUser,
} from "@/lib/syllabus-coverage/access.server";
import {
  loadSyllabusWorkspace,
  loadTeacherSyllabusAssignments,
} from "@/lib/syllabus-coverage/load-coverage.server";
import {
  reportSyllabusHealthAlert,
  SYLLABUS_HEALTH_REASONS,
} from "@/lib/syllabus-coverage/syllabus-health-alerts";
import type {
  SyllabusCoverageSummary,
  SyllabusSubtopicStatus,
  SyllabusTopicRow,
  TeacherSyllabusAssignment,
} from "@/lib/syllabus-coverage/types";

const TEACHER_SYLLABUS_PATH = "/teacher-dashboard/syllabus-coverage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = any;

function revalidateTeacherSyllabus() {
  revalidatePath(TEACHER_SYLLABUS_PATH);
}

export async function loadTeacherSyllabusAssignmentsAction(): Promise<
  | { ok: true; assignments: TeacherSyllabusAssignment[] }
  | { ok: false; error: string }
> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  try {
    const assignments = await loadTeacherSyllabusAssignments(auth.user.id);
    return { ok: true, assignments };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.coverageLoadFailed,
      error: err,
    });
    return { ok: false, error: "Could not load your teaching assignments." };
  }
}

export async function loadTeacherSyllabusWorkspaceAction(input: {
  classId: string;
  subjectId: string | null;
  academicYear: string;
}): Promise<
  | {
      ok: true;
      className: string;
      topics: SyllabusTopicRow[];
      summary: SyllabusCoverageSummary;
    }
  | { ok: false; error: string }
> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  const access = await assertTeacherAssignedToClassSubject(
    auth.user.id,
    input.classId,
    input.subjectId
  );
  if (!access.ok) return { ok: false, error: access.error };

  try {
    const workspace = await loadSyllabusWorkspace({
      classId: input.classId,
      subjectId: input.subjectId,
      academicYear: input.academicYear,
      teacherId: auth.user.id,
    });
    return { ok: true, ...workspace };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.coverageLoadFailed,
      schoolId: access.schoolId,
      metadata: {
        class_id: input.classId,
        subject_id: input.subjectId ?? undefined,
        teacher_id: auth.user.id,
      },
      error: err,
    });
    return { ok: false, error: "Could not load syllabus." };
  }
}

function parseStatus(raw: string): SyllabusSubtopicStatus | null {
  if (raw === "not_started" || raw === "in_progress" || raw === "completed") {
    return raw;
  }
  return null;
}

async function upsertSubtopicProgress(input: {
  userId: string;
  classId: string;
  subjectId: string | null;
  schoolId: string;
  subtopicId: string;
  status: SyllabusSubtopicStatus;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient() as AdminDb;
  const completedAt =
    input.status === "completed" ? new Date().toISOString() : null;

  const { data: existing } = await admin
    .from("syllabus_subtopic_progress")
    .select("id")
    .eq("subtopic_id", input.subtopicId)
    .eq("teacher_id", input.userId)
    .maybeSingle();

  try {
    if (existing) {
      const { error } = await admin
        .from("syllabus_subtopic_progress")
        .update({
          status: input.status,
          completed_at: completedAt,
        })
        .eq("id", (existing as { id: string }).id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("syllabus_subtopic_progress").insert({
        school_id: input.schoolId,
        class_id: input.classId,
        subject_id: input.subjectId,
        subtopic_id: input.subtopicId,
        teacher_id: input.userId,
        status: input.status,
        completed_at: completedAt,
      });
      if (error) throw error;
    }
    revalidateTeacherSyllabus();
    return { ok: true };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.progressSaveFailed,
      schoolId: input.schoolId,
      metadata: {
        class_id: input.classId,
        subject_id: input.subjectId ?? undefined,
        subtopic_id: input.subtopicId,
        teacher_id: input.userId,
      },
      error: err,
    });
    return { ok: false, error: "Could not save progress." };
  }
}

export async function updateSubtopicProgressAction(input: {
  classId: string;
  subjectId: string | null;
  subtopicId: string;
  status: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  const status = parseStatus(input.status);
  if (!status) return { ok: false, error: "Invalid status." };

  const access = await assertTeacherAssignedToClassSubject(
    auth.user.id,
    input.classId,
    input.subjectId
  );
  if (!access.ok) return { ok: false, error: access.error };

  return upsertSubtopicProgress({
    userId: auth.user.id,
    classId: input.classId,
    subjectId: input.subjectId,
    schoolId: access.schoolId,
    subtopicId: input.subtopicId,
    status,
  });
}

export async function bulkCompleteSubtopicsAction(input: {
  classId: string;
  subjectId: string | null;
  subtopicIds: string[];
}): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  if (input.subtopicIds.length === 0) {
    return { ok: false, error: "Select at least one subtopic." };
  }

  const access = await assertTeacherAssignedToClassSubject(
    auth.user.id,
    input.classId,
    input.subjectId
  );
  if (!access.ok) return { ok: false, error: access.error };

  let updated = 0;
  for (const subtopicId of input.subtopicIds) {
    const res = await upsertSubtopicProgress({
      userId: auth.user.id,
      classId: input.classId,
      subjectId: input.subjectId,
      schoolId: access.schoolId,
      subtopicId,
      status: "completed",
    });
    if (res.ok) updated += 1;
  }

  if (updated === 0) {
    return { ok: false, error: "Could not update any subtopics." };
  }
  return { ok: true, updated };
}

const NOTE_MAX_LENGTH = 1000;

export async function saveSubtopicNoteAction(input: {
  classId: string;
  subjectId: string | null;
  subtopicId: string;
  note: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };

  const note = input.note.trim();
  if (!note) return { ok: false, error: "Note cannot be empty." };
  if (note.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: `Note must be ${NOTE_MAX_LENGTH} characters or less.` };
  }

  const access = await assertTeacherAssignedToClassSubject(
    auth.user.id,
    input.classId,
    input.subjectId
  );
  if (!access.ok) return { ok: false, error: access.error };

  const admin = createAdminClient() as AdminDb;

  try {
    const { data: existing } = await admin
      .from("syllabus_subtopic_notes")
      .select("id")
      .eq("subtopic_id", input.subtopicId)
      .eq("teacher_id", auth.user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await admin
        .from("syllabus_subtopic_notes")
        .update({ note })
        .eq("id", (existing as { id: string }).id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("syllabus_subtopic_notes").insert({
        school_id: access.schoolId,
        class_id: input.classId,
        subject_id: input.subjectId,
        subtopic_id: input.subtopicId,
        teacher_id: auth.user.id,
        note,
      });
      if (error) throw error;
    }

    revalidateTeacherSyllabus();
    return { ok: true };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.noteSaveFailed,
      schoolId: access.schoolId,
      metadata: {
        class_id: input.classId,
        subject_id: input.subjectId ?? undefined,
        subtopic_id: input.subtopicId,
        teacher_id: auth.user.id,
      },
      error: err,
    });
    return { ok: false, error: "Could not save note." };
  }
}
