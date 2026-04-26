"use client";

import { useRouter } from "next/navigation";

export function ClassTeacherHomeClassSelect(props: {
  classes: { id: string; name: string }[];
  selectedClassId: string;
}) {
  const { classes, selectedClassId } = props;
  const router = useRouter();

  if (classes.length <= 1) return null;

  return (
    <div className="w-full min-w-0 sm:w-auto sm:max-w-xs">
      <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400">
        Class
        <select
          className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          value={selectedClassId}
          aria-label="Select class"
          onChange={(e) => {
            const id = e.target.value;
            router.push(
              `/teacher-dashboard/class-teacher?class=${encodeURIComponent(id)}`
            );
          }}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
