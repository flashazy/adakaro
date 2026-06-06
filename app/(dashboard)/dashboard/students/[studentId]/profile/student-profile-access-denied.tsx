import { BackButton } from "@/components/dashboard/back-button";

export function StudentProfileAccessDenied({
  backHref,
}: {
  backHref: string;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Profile not available
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          You do not have permission to view this student&apos;s profile. If you
          believe this is a mistake, please contact your school administrator.
        </p>
        <div className="mt-6 flex justify-center">
          <BackButton
            href={backHref}
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Go back
          </BackButton>
        </div>
      </div>
    </div>
  );
}
