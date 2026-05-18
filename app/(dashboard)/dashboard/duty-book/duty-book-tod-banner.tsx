import type { ActiveDutyTeacher } from "@/lib/teacher-on-duty/types";

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

export function DutyBookTodBanner(props: {
  activeTeachers: ActiveDutyTeacher[];
}) {
  const { activeTeachers } = props;
  if (activeTeachers.length === 0) return null;

  const latestEnd = activeTeachers.reduce(
    (max, t) => (t.endDate > max ? t.endDate : max),
    activeTeachers[0]!.endDate
  );

  const names = activeTeachers.map((t) => t.fullName);
  const label =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.length} teachers currently on duty`;

  return (
    <section className="rounded-xl border border-school-primary/25 bg-[rgb(var(--school-primary-rgb)/0.08)] px-4 py-3 dark:border-school-primary/35 dark:bg-[rgb(var(--school-primary-rgb)/0.12)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-school-primary">
        Teacher on duty
      </p>
      <p className="mt-1 text-sm text-slate-800 dark:text-zinc-200">
        {names.length <= 2 ? (
          <>
            <span className="font-medium text-slate-900 dark:text-white">
              {label}
            </span>
          </>
        ) : (
          <span className="font-medium text-slate-900 dark:text-white">
            {label}
          </span>
        )}
      </p>
      {names.length <= 4 && names.length > 2 ? (
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          {names.join(" · ")}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
        Assignment valid until {formatDate(latestEnd)}
      </p>
    </section>
  );
}
