import { Lock } from "lucide-react";
import type { TeacherLockedContactInfo } from "@/lib/teacher-assignment-status";

interface TeacherDashboardLockedProps {
  contact: TeacherLockedContactInfo | null;
}

export function TeacherDashboardLocked({ contact }: TeacherDashboardLockedProps) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
          <Lock
            className="h-7 w-7 text-amber-800 dark:text-amber-200"
            aria-hidden
          />
        </div>
        <h1 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">
          You are not assigned to any class or subject
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          Please contact your school administrator to get access to your
          classroom.
        </p>
      </div>

      {contact ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm dark:border-zinc-700 dark:bg-zinc-950/50">
          <p className="font-medium text-slate-800 dark:text-zinc-200">
            <span className="text-slate-500 dark:text-zinc-500">School:</span>{" "}
            {contact.schoolName}
          </p>
          <p className="mt-2 text-slate-700 dark:text-zinc-300">
            <span className="text-slate-500 dark:text-zinc-500">Admin:</span>{" "}
            {contact.adminName}
          </p>
          {contact.adminEmail || contact.adminPhone ? (
            <div className="mt-3 space-y-2">
              <p className="font-medium text-slate-800 dark:text-zinc-200">
                Contact your school administrator:
              </p>
              {contact.adminEmail ? (
                <p className="text-slate-700 dark:text-zinc-300">
                  <span className="text-slate-500 dark:text-zinc-500">
                    Email:
                  </span>{" "}
                  <a
                    href={`mailto:${contact.adminEmail}`}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {contact.adminEmail}
                  </a>
                </p>
              ) : null}
              {contact.adminPhone ? (
                <p className="text-slate-700 dark:text-zinc-300">
                  <span className="text-slate-500 dark:text-zinc-500">
                    Phone:
                  </span>{" "}
                  <a
                    href={`tel:${contact.adminPhone.replace(/\s/g, "")}`}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {contact.adminPhone}
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
