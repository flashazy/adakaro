"use client";

import type {
  ClassMovementNotificationMetadataClient,
  ClassMovementNotificationMoveDetailClient,
} from "@/lib/notifications/in-app-notification-types";
import { NotificationStudentNameLink } from "@/components/notifications/notification-student-name-link";

export const BULK_MOVEMENT_PREVIEW_LIMIT = 3;

function moveSuffix(
  move: ClassMovementNotificationMoveDetailClient,
  direction: ClassMovementNotificationMetadataClient["direction"]
): string {
  if (direction === "joined") {
    return ` from ${move.fromClassName}`;
  }
  if (direction === "left") {
    return ` to ${move.toClassName}`;
  }
  return ` from ${move.fromClassName} to ${move.toClassName}`;
}

export function ClassMovementMoveList({
  moves,
  direction,
  onStudentNavigate,
  textSize = "xs",
}: {
  moves: ClassMovementNotificationMoveDetailClient[];
  direction: ClassMovementNotificationMetadataClient["direction"];
  onStudentNavigate?: () => void;
  textSize?: "xs" | "sm";
}) {
  if (moves.length === 0) return null;

  const listClass =
    textSize === "sm"
      ? "mt-2 list-disc space-y-1 pl-4 text-sm text-slate-600 dark:text-zinc-300"
      : "mt-2 list-disc space-y-0.5 pl-4 text-xs text-slate-500 dark:text-zinc-400";

  const linkClass = textSize === "sm" ? "text-sm" : "text-xs";

  return (
    <ul className={listClass}>
      {moves.map((m) => (
        <li key={m.studentId}>
          <NotificationStudentNameLink
            studentId={m.studentId}
            studentName={m.studentName}
            profilePath={m.profilePath}
            canOpenProfile={m.canOpenProfile}
            onNavigate={onStudentNavigate}
            className={linkClass}
          />
          {moveSuffix(m, direction)}
        </li>
      ))}
    </ul>
  );
}
