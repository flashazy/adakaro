"use client";

import dynamic from "next/dynamic";

const ParentClassTeacherMessagesTabClient = dynamic(
  () =>
    import("@/components/chat/parent-class-teacher-messages-tab-client").then(
      (m) => ({
        default: m.ParentClassTeacherMessagesTabClient,
      })
    ),
  {
    ssr: false,
    loading: () => (
      <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
        Loading messages…
      </div>
    ),
  }
);

export function ParentClassTeacherMessagesTabContentClient({
  parentId,
  classId,
  classTeacherId,
  studentName,
  onMessagesUnreadChange,
}: {
  parentId: string;
  classId: string;
  classTeacherId: string | null;
  studentName: string;
  onMessagesUnreadChange?: (count: number) => void;
}) {
  return (
    <ParentClassTeacherMessagesTabClient
      parentId={parentId}
      classId={classId}
      classTeacherId={classTeacherId}
      studentName={studentName}
      onMessagesUnreadChange={onMessagesUnreadChange}
    />
  );
}
