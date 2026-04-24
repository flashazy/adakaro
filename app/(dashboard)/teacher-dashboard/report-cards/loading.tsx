export default function ReportCardsLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-school-primary border-t-transparent"
        aria-hidden
      />
      <p className="text-sm text-slate-600 dark:text-zinc-400">
        Loading report cards…
      </p>
    </div>
  );
}
