import Link from "next/link";
import type { ClassTeacherClassRow } from "@/lib/class-teacher";
import type {
  ClassTeacherAcademicBanner,
  ClassTeacherHomeSummary,
} from "@/lib/class-teacher-dashboard-home";
import { ClassTeacherHomeClassSelect } from "@/components/class-teacher/class-teacher-home-class-select";
import {
  ClassTeacherDashboardNavTextLink,
  ClassTeacherDashboardQuickNavButton,
  ClassTeacherDashboardReplyNavButton,
} from "@/components/class-teacher/class-teacher-dashboard-nav-buttons";
import { ClassTeacherMessageAllParentsButton } from "@/components/class-teacher/class-teacher-message-all-parents-button";
import { ClassTeacherPhoneSection } from "@/components/class-teacher/class-teacher-phone-section";

function formatRecentWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function ClassTeacherDashboardHomeView(props: {
  classes: ClassTeacherClassRow[];
  selectedClassId: string;
  selectedClassName: string;
  academic: ClassTeacherAcademicBanner;
  summary: ClassTeacherHomeSummary;
  teacherPhone: string | null;
}) {
  const {
    classes,
    selectedClassId,
    selectedClassName,
    academic,
    summary,
    teacherPhone,
  } = props;
  const overviewHref = `/teacher-dashboard/class-teacher/${selectedClassId}`;
  const messagesHref = "/teacher-dashboard/class-teacher/messages";
  const unread = summary.unreadMessageCount;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Class Teacher Dashboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-300">
            <span className="font-medium text-slate-800 dark:text-zinc-100">
              {selectedClassName}
            </span>
            <span className="mx-1.5 text-slate-300 dark:text-zinc-600">·</span>
            <span>{academic.yearLabel}</span>
            {academic.termLabel ? (
              <>
                <span className="mx-1.5 text-slate-300 dark:text-zinc-600">
                  ·
                </span>
                <span>{academic.termLabel}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end lg:flex-col lg:items-end">
          <ClassTeacherHomeClassSelect
            classes={classes}
            selectedClassId={selectedClassId}
          />
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
            <ClassTeacherDashboardNavTextLink
              href={messagesHref}
              className="text-school-primary hover:opacity-90 dark:text-school-primary"
            >
              <>
                Messages
                {unread > 0 ? (
                  <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[0.65rem] font-bold leading-none text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </>
            </ClassTeacherDashboardNavTextLink>
            <Link
              href="/teacher-dashboard"
              className="text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
            >
              ← Teacher home
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Students
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {summary.activeStudentCount}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            active students
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Parents linked
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {summary.linkedParentCount}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            guardians with a link
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Unread messages
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-white">
            <span className="tabular-nums">
              {summary.unreadMessageCount} unread
            </span>
            {unread > 0 ? (
              <span className="inline-flex rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
                New
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            In this class
          </p>
        </div>
      </div>

      <ClassTeacherPhoneSection initialPhone={teacherPhone} />

      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Quick actions
        </h2>
        <div className="mt-3 flex flex-row flex-nowrap gap-4">
          <ClassTeacherDashboardQuickNavButton
            href={overviewHref}
            icon="👥"
            label="View students"
          />
          <ClassTeacherDashboardQuickNavButton
            href={messagesHref}
            icon="💬"
            label="Messages"
            relative
            badge={
              unread > 0 ? (
                <span className="absolute -right-1 -top-1 z-[1] inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[0.65rem] font-bold leading-none text-white dark:border-zinc-900">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : undefined
            }
          />
          <ClassTeacherMessageAllParentsButton
            classId={selectedClassId}
            linkedParentCount={summary.linkedParentCount}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recent messages from parents
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              Up to 10 most recent parent messages for this class.
            </p>
          </div>
          <ClassTeacherDashboardNavTextLink
            href={messagesHref}
            className="shrink-0 text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
          >
            View all messages →
          </ClassTeacherDashboardNavTextLink>
        </div>
        <div className="h-[300px] overflow-y-auto overflow-x-hidden">
        <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
          {summary.recentFromParents.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
              No parent messages yet for this class.
            </li>
          ) : (
            summary.recentFromParents.map((row) => {
              const replyHref = `${messagesHref}?parentId=${encodeURIComponent(row.parentId)}&studentName=${encodeURIComponent(row.primaryStudentName)}`;
              return (
                <li
                  key={row.messageId}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {row.parentName}
                      <span className="font-normal text-slate-500 dark:text-zinc-400">
                        {" "}
                        ({row.studentNamesDisplay})
                      </span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-zinc-300">
                      {row.messagePreview}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
                      {formatRecentWhen(row.createdAt)}
                    </p>
                  </div>
                  <div className="shrink-0 sm:pl-4">
                    <ClassTeacherDashboardReplyNavButton href={replyHref} />
                  </div>
                </li>
              );
            })
          )}
        </ul>
        </div>
      </section>

      <div className="flex justify-center border-t border-slate-200 pt-6 dark:border-zinc-800">
        <ClassTeacherDashboardNavTextLink
          href={overviewHref}
          className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
        >
          Open full class overview →
        </ClassTeacherDashboardNavTextLink>
      </div>
    </div>
  );
}
