"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const CLASS_TEACHER_HREF = "/teacher-dashboard/class-teacher";

export function TeacherDashboardOpenClassTeacherButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        if (pending) return;
        startTransition(() => {
          void router.push(CLASS_TEACHER_HREF);
        });
      }}
      className="inline-flex items-center gap-1.5 text-left text-sm font-semibold text-indigo-800 underline-offset-2 hover:underline disabled:cursor-wait disabled:opacity-70 dark:text-indigo-200"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
      ) : null}
      Open class teacher dashboard →
    </button>
  );
}
