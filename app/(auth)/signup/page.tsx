import { Suspense } from "react";
import SignupContent from "./signup-content";

function SignupFallback() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-6 w-48 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
      <div className="mt-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-10 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800"
          />
        ))}
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupContent />
    </Suspense>
  );
}
