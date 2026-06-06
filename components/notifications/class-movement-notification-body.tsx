"use client";

import { useState } from "react";
import type {
  ClassMovementNotificationMetadataClient,
  ClassMovementNotificationMoveDetailClient,
} from "@/lib/notifications/in-app-notification-types";
import { NotificationStudentNameLink } from "@/components/notifications/notification-student-name-link";
import {
  BULK_MOVEMENT_PREVIEW_LIMIT,
  ClassMovementMoveList,
} from "@/components/notifications/class-movement-move-list";
import { ClassMovementStudentsModal } from "@/components/notifications/class-movement-students-modal";

function SingleMoveMessage({
  move,
  direction,
  onStudentNavigate,
}: {
  move: ClassMovementNotificationMoveDetailClient;
  direction: ClassMovementNotificationMetadataClient["direction"];
  onStudentNavigate?: () => void;
}) {
  if (direction === "joined") {
    return (
      <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
        <NotificationStudentNameLink
          studentId={move.studentId}
          studentName={move.studentName}
          profilePath={move.profilePath}
          canOpenProfile={move.canOpenProfile}
          onNavigate={onStudentNavigate}
        />{" "}
        has joined {move.toClassName} from {move.fromClassName}.
      </p>
    );
  }

  if (direction === "left") {
    return (
      <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
        <NotificationStudentNameLink
          studentId={move.studentId}
          studentName={move.studentName}
          profilePath={move.profilePath}
          canOpenProfile={move.canOpenProfile}
          onNavigate={onStudentNavigate}
        />{" "}
        has moved from {move.fromClassName} to {move.toClassName}.
      </p>
    );
  }

  return (
    <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
      <NotificationStudentNameLink
        studentId={move.studentId}
        studentName={move.studentName}
        profilePath={move.profilePath}
        canOpenProfile={move.canOpenProfile}
        onNavigate={onStudentNavigate}
      />{" "}
      has moved from {move.fromClassName} to {move.toClassName}.
    </p>
  );
}

export function ClassMovementNotificationBody({
  title,
  message,
  metadata,
  onStudentNavigate,
}: {
  title: string;
  message: string;
  metadata: ClassMovementNotificationMetadataClient | null;
  onStudentNavigate?: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const moves = metadata?.moves ?? [];
  const direction = metadata?.direction;

  if (moves.length === 1 && direction) {
    return (
      <SingleMoveMessage
        move={moves[0]!}
        direction={direction}
        onStudentNavigate={onStudentNavigate}
      />
    );
  }

  if (moves.length <= 1 || !direction) {
    return (
      <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">{message}</p>
    );
  }

  const totalCount = moves.length;
  const showViewAll = totalCount > BULK_MOVEMENT_PREVIEW_LIMIT;
  const previewMoves = showViewAll
    ? moves.slice(0, BULK_MOVEMENT_PREVIEW_LIMIT)
    : moves;

  return (
    <>
      <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">{message}</p>
      <ClassMovementMoveList
        moves={previewMoves}
        direction={direction}
        onStudentNavigate={onStudentNavigate}
      />
      {showViewAll ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setModalOpen(true);
          }}
          className="mt-2 text-left text-xs font-medium text-school-primary hover:underline dark:text-school-primary"
        >
          View all {totalCount} students
        </button>
      ) : null}
      <ClassMovementStudentsModal
        open={modalOpen}
        title={title}
        subtitle={message}
        moves={moves}
        direction={direction}
        onClose={() => setModalOpen(false)}
        onStudentNavigate={onStudentNavigate}
      />
    </>
  );
}
