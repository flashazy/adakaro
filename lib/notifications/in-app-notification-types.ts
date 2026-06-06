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
  created_at: string;
}
