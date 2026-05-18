import Link from "next/link";
import { BookOpen } from "lucide-react";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ] as const;
  return `${d} ${months[m - 1]} ${y}`;
}

export function TeacherOnDutyCard(props: {
  endDate: string;
}) {
  const { endDate } = props;
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-school-primary/25 bg-gradient-to-br from-[rgb(var(--school-primary-rgb)/0.12)] via-white to-white p-5 shadow-sm dark:border-school-primary/30 dark:from-[rgb(var(--school-primary-rgb)/0.18)] dark:via-zinc-900 dark:to-zinc-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-school-primary text-white shadow-md">
            <BookOpen className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-school-primary">
              Teacher on Duty
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
              Duty Book access
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              You are on duty until{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {formatDate(endDate)}
              </span>
              . Record daily events and remarks for the school.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/duty-book"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-school-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          Open Duty Book
        </Link>
      </div>
    </section>
  );
}
