import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { reportTeacherNotificationFailure } from "@/lib/watchdog/health-alert-reporters";
import type { StudentClassHistorySource } from "@/lib/student-class-history/types";
import type { ClassMovementNotificationMetadata } from "@/lib/notifications/in-app-notification-types";

export interface ClassMovementNotificationEntry {
  schoolId: string;
  studentId: string;
  studentName: string;
  fromClassId: string;
  toClassId: string;
  source: StudentClassHistorySource;
  sourceId?: string | null;
}

interface MoveDetail {
  studentId: string;
  studentName: string;
  fromClassId: string;
  toClassId: string;
  fromClassName: string;
  toClassName: string;
}

interface ClassInfo {
  id: string;
  name: string;
  class_teacher_id: string | null;
  school_id: string;
}

interface NotificationPayload {
  school_id: string;
  recipient_id: string;
  title: string;
  message: string;
  helper_text: string;
  type: "class_movement";
  metadata: ClassMovementNotificationMetadata;
}

const HELPER_LEFT =
  "Previous records remain safely attached to your class.";
const HELPER_JOINED =
  "You can now view this student in your class list, attendance, and marks history.";
const HELPER_SAME_TEACHER =
  "The student remains under your class-teacher responsibility.";

function classNameOrFallback(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed || "their class";
}

function buildLeftNotification(
  schoolId: string,
  recipientId: string,
  fromClassName: string,
  moves: MoveDetail[],
  source: StudentClassHistorySource
): NotificationPayload {
  const count = moves.length;
  if (count === 1) {
    const m = moves[0]!;
    return {
      school_id: schoolId,
      recipient_id: recipientId,
      title: "Student moved out",
      message: `${m.studentName} has moved from ${m.fromClassName} to ${m.toClassName}.`,
      helper_text: HELPER_LEFT,
      type: "class_movement",
      metadata: {
        direction: "left",
        source,
        studentIds: moves.map((m) => m.studentId),
        moves,
      },
    };
  }
  return {
    school_id: schoolId,
    recipient_id: recipientId,
    title: "Students moved out",
    message: `${count} students moved out of ${fromClassName}.`,
    helper_text: HELPER_LEFT,
    type: "class_movement",
    metadata: {
      direction: "left",
      source,
      studentIds: moves.map((m) => m.studentId),
      moves,
    },
  };
}

function buildJoinedNotification(
  schoolId: string,
  recipientId: string,
  toClassName: string,
  moves: MoveDetail[],
  source: StudentClassHistorySource
): NotificationPayload {
  const count = moves.length;
  if (count === 1) {
    const m = moves[0]!;
    return {
      school_id: schoolId,
      recipient_id: recipientId,
      title: "Student joined your class",
      message: `${m.studentName} has joined ${m.toClassName} from ${m.fromClassName}.`,
      helper_text: HELPER_JOINED,
      type: "class_movement",
      metadata: {
        direction: "joined",
        source,
        studentIds: moves.map((m) => m.studentId),
        moves,
      },
    };
  }
  return {
    school_id: schoolId,
    recipient_id: recipientId,
    title: "Students joined your class",
    message: `${count} students joined ${toClassName} from other classes.`,
    helper_text: HELPER_JOINED,
    type: "class_movement",
    metadata: {
      direction: "joined",
      source,
      studentIds: moves.map((m) => m.studentId),
      moves,
    },
  };
}

function buildUpdatedNotification(
  schoolId: string,
  recipientId: string,
  moves: MoveDetail[],
  source: StudentClassHistorySource
): NotificationPayload {
  const count = moves.length;
  if (count === 1) {
    const m = moves[0]!;
    return {
      school_id: schoolId,
      recipient_id: recipientId,
      title: "Student class updated",
      message: `${m.studentName} has moved from ${m.fromClassName} to ${m.toClassName}.`,
      helper_text: HELPER_SAME_TEACHER,
      type: "class_movement",
      metadata: {
        direction: "updated",
        source,
        studentIds: moves.map((m) => m.studentId),
        moves,
      },
    };
  }
  return {
    school_id: schoolId,
    recipient_id: recipientId,
    title: "Students class updated",
    message: `${count} students have moved between your classes.`,
    helper_text: HELPER_SAME_TEACHER,
    type: "class_movement",
    metadata: {
      direction: "updated",
      source,
      studentIds: moves.map((m) => m.studentId),
      moves,
    },
  };
}

/**
 * Notify class teachers when students move class/stream. Failures are logged only.
 */
export async function notifyClassTeachersOfStudentMovements(
  entries: ClassMovementNotificationEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  const client = createAdminClient();

  const classIds = new Set<string>();
  for (const e of entries) {
    if (e.fromClassId?.trim()) classIds.add(e.fromClassId.trim());
    if (e.toClassId?.trim()) classIds.add(e.toClassId.trim());
  }
  if (classIds.size === 0) return;

  const { data: classRows, error: classErr } = await client
    .from("classes")
    .select("id, name, class_teacher_id, school_id")
    .in("id", [...classIds]);

  if (classErr) {
    console.error(
      "[notifyClassTeachersOfStudentMovements] classes",
      classErr.message
    );
    reportTeacherNotificationFailure({
      phase: "class_lookup",
      error: classErr.message,
      movement_count: entries.length,
    });
    return;
  }

  const classById = new Map<string, ClassInfo>();
  for (const row of (classRows ?? []) as ClassInfo[]) {
    classById.set(row.id, row);
  }

  const moveDetails: MoveDetail[] = entries.map((e) => {
    const from = classById.get(e.fromClassId);
    const to = classById.get(e.toClassId);
    return {
      studentId: e.studentId,
      studentName: e.studentName.trim() || "Student",
      fromClassId: e.fromClassId,
      toClassId: e.toClassId,
      fromClassName: classNameOrFallback(from?.name),
      toClassName: classNameOrFallback(to?.name),
    };
  });

  const source = entries[0]?.source ?? "admin_edit";

  const sameTeacherByRecipient = new Map<string, MoveDetail[]>();
  const leftByRecipient = new Map<string, MoveDetail[]>();
  const joinedByRecipient = new Map<string, MoveDetail[]>();

  for (let i = 0; i < moveDetails.length; i++) {
    const detail = moveDetails[i]!;
    const entry = entries[i]!;
    const fromClass = classById.get(entry.fromClassId);
    const toClass = classById.get(entry.toClassId);
    const fromTeacherId = fromClass?.class_teacher_id?.trim() || null;
    const toTeacherId = toClass?.class_teacher_id?.trim() || null;

    if (fromTeacherId && toTeacherId && fromTeacherId === toTeacherId) {
      const list = sameTeacherByRecipient.get(fromTeacherId) ?? [];
      list.push(detail);
      sameTeacherByRecipient.set(fromTeacherId, list);
      continue;
    }

    if (fromTeacherId) {
      const list = leftByRecipient.get(fromTeacherId) ?? [];
      list.push(detail);
      leftByRecipient.set(fromTeacherId, list);
    }

    if (toTeacherId) {
      const list = joinedByRecipient.get(toTeacherId) ?? [];
      list.push(detail);
      joinedByRecipient.set(toTeacherId, list);
    }
  }

  const payloads: NotificationPayload[] = [];

  for (const [recipientId, moves] of sameTeacherByRecipient) {
    const schoolId = entries.find((e) => {
      const from = classById.get(e.fromClassId);
      const to = classById.get(e.toClassId);
      return (
        from?.class_teacher_id === recipientId ||
        to?.class_teacher_id === recipientId
      );
    })?.schoolId;
    if (!schoolId) continue;
    payloads.push(buildUpdatedNotification(schoolId, recipientId, moves, source));
  }

  for (const [recipientId, moves] of leftByRecipient) {
    const fromClassId = moves[0]?.fromClassId;
    const fromClass = fromClassId ? classById.get(fromClassId) : null;
    if (!fromClass) continue;
    payloads.push(
      buildLeftNotification(
        fromClass.school_id,
        recipientId,
        classNameOrFallback(fromClass.name),
        moves,
        source
      )
    );
  }

  for (const [recipientId, moves] of joinedByRecipient) {
    const toClassId = moves[0]?.toClassId;
    const toClass = toClassId ? classById.get(toClassId) : null;
    if (!toClass) continue;
    payloads.push(
      buildJoinedNotification(
        toClass.school_id,
        recipientId,
        classNameOrFallback(toClass.name),
        moves,
        source
      )
    );
  }

  if (payloads.length === 0) return;

  const { error: insertErr } = await client
    .from("notifications")
    .insert(payloads as never);

  if (insertErr) {
    console.error(
      "[notifyClassTeachersOfStudentMovements] insert",
      insertErr.message,
      { count: payloads.length }
    );
    const schoolId = payloads[0]?.school_id ?? entries[0]?.schoolId;
    reportTeacherNotificationFailure(
      {
        phase: "notification_insert",
        error: insertErr.message,
        payload_count: payloads.length,
      },
      schoolId
    );
  }
}
