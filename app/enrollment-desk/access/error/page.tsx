export default function EnrollmentDeskAccessErrorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-6 py-12 dark:bg-zinc-950">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Link not valid
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          This Enrollment Desk QR link is no longer valid. Please ask the
          school admin for a new one.
        </p>
      </div>
    </main>
  );
}
