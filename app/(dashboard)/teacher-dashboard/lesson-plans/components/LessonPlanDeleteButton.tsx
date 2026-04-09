"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteLessonPlan } from "../actions";

export function LessonPlanDeleteButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Delete this lesson plan?")) return;
        startTransition(async () => {
          await deleteLessonPlan(planId);
          router.refresh();
        });
      }}
      className="text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
