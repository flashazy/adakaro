"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ClassListError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ClassListError]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/30">
      <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">
        Class list could not load
      </h2>
      <p className="mt-2 text-sm text-red-800 dark:text-red-200">
        {error.message ||
          "An unexpected error occurred while loading the class list."}
      </p>
      <p className="mt-2 text-xs text-red-700/90 dark:text-red-300/90">
        Open the browser console (F12) and Vercel → Logs for lines starting with{" "}
        <code className="font-mono">[TeacherAttendanceForm]</code> or{" "}
        <code className="font-mono">[loadAttendanceData]</code>.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
        >
          Try again
        </button>
        <Link
          href="/teacher-dashboard"
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-200"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
