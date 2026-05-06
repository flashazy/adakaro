"use client";

import { useEffect } from "react";
import { CaptureButton } from "@/components/ui/capture-button";

export default function CaptureCardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[capture-card] route error boundary", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
        The Capture Card screen crashed. Check the browser console and server
        logs for details.
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

