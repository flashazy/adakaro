export type InAppNotificationType = "class_movement";

export interface ClassMovementNotificationMoveDetail {
  studentId: string;
  studentName: string;
  fromClassId: string;
  toClassId: string;
  fromClassName: string;
  toClassName: string;
}

export interface ClassMovementNotificationMetadata {
  direction: "joined" | "left" | "updated";
  source?: string;
  /** Convenience list for bulk navigation (mirrors moves[].studentId). */
  studentIds?: string[];
  moves: ClassMovementNotificationMoveDetail[];
}

/** Client/API enrichment for clickable profile links. */
export interface ClassMovementNotificationMoveDetailClient
  extends ClassMovementNotificationMoveDetail {
  profilePath: string;
  canOpenProfile: boolean;
}

export interface ClassMovementNotificationMetadataClient
  extends Omit<ClassMovementNotificationMetadata, "moves"> {
  moves: ClassMovementNotificationMoveDetailClient[];
}

/** Inbox workflow: unread → read → archived (records are never teacher-deleted). */
export type NotificationInboxState = "unread" | "read" | "archived";

export interface InAppNotificationRow {
  id: string;
  school_id: string;
  recipient_id: string;
  title: string;
  message: string;
  helper_text: string | null;
  type: InAppNotificationType;
  metadata: ClassMovementNotificationMetadata | null;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export function getNotificationInboxState(row: {
  read_at: string | null;
  archived_at: string | null;
}): NotificationInboxState {
  if (row.archived_at) return "archived";
  if (row.read_at) return "read";
  return "unread";
}

export function isNotificationUnread(row: {
  read_at: string | null;
  archived_at: string | null;
}): boolean {
  return getNotificationInboxState(row) === "unread";
}
