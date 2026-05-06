"use client";

import { useEffect } from "react";
import { CaptureButton } from "@/components/ui/capture-button";

export default function CaptureCardEditError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[capture-edit] route error boundary", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
        Couldn&apos;t open edit screen
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
        The edit page crashed. Check the console/server logs for details.
      </p>
      <pre className="mt-4 overflow-auto rounded-xl bg-slate-100 p-3 text-xs text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">
        {error.message}
      </pre>
      <CaptureButton
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-xl px-4 py-3 text-sm font-semibold"
      >
        Try again
      </CaptureButton>
    </div>
  );
}

