import { Suspense } from "react";
import { LoginForm } from "./login-form";

function LoginFallback() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-7 w-40 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
      <div className="mt-2 h-4 w-56 animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
