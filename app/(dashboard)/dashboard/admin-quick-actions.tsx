import type { ReactNode } from "react";
import { AdminQuickActionCard } from "@/components/dashboard/admin-quick-action-card";
import { AdminQuickActionHub } from "@/components/dashboard/admin-quick-action-hub";
import { SchoolSettingsOnboardingCard } from "@/components/dashboard/school-settings-onboarding-card";
import { RequestUpgradeQuickAction } from "./request-upgrade-quick-action";
import {
  formatRemainingSlotsLabel,
  getFreePlanCapacityState,
  getPlanStatusCardTitle,
  getRemainingStudentSlots,
  type SchoolPlanStatus,
} from "@/lib/dashboard/subscription-banner";
import {
  dashboardSectionAccentClass,
  dashboardSubsectionLabelClass,
} from "@/components/dashboard/admin-quick-action-styles";
import { cn } from "@/lib/utils";

const ICON_CLASS = "h-5 w-5";

const icons = {
  classes: (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
    </svg>
  ),
  subjects: (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6.75 4.5v.75A8.967 8.967 0 0 1 12 6.375a8.967 8.967 0 0 1 5.25 1.635v-.75A8.967 8.967 0 0 0 12 6.042Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l7.5-3 7.5 3M4.5 5.25h15v12l-7.5 3-7.5-3V5.25Z" />
    </svg>
  ),
  students: (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  ),
  finance: (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
    </svg>
  ),
  parentAccess: (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  ),
  enrollmentDesk: (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75V6.75Zm0 9.75h.75v.75h-.75v-.75Zm9.75-9.75h.75v.75h-.75V6.75Zm-3 12h3.75v.75H16.5v-.75Zm3-3.75h.75v.75h-.75v-.75Zm-9 3.75v.75H7.5v-.75h3ZM12 18.75h.75v.75H12v-.75Zm3.75-12.75h.75v.75h-.75v-.75Zm-9 3.75h.75v.75h-.75v-.75Zm-3 3.75h.75v.75H4.5v-.75Zm9-9h.75v.75H12V6.75Z" />
    </svg>
  ),
  teachers: (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6.75 4.5v.75A8.967 8.967 0 0 1 12 6.375a8.967 8.967 0 0 1 5.25 1.635v-.75A8.967 8.967 0 0 0 12 6.042Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75c-2.343 0-4.5.893-6.11 2.398-.278.254-.39.643-.285 1.002l.317 1.11a.75.75 0 0 0 .72.542h11.716a.75.75 0 0 0 .72-.542l.317-1.11a.749.749 0 0 0-.285-1.002C16.5 13.643 14.343 12.75 12 12.75Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25v6.75M4.5 8.25v6.75" />
    </svg>
  ),
  assignments: (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </svg>
  ),
  team: (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Zm-13.5 0a2.625 2.625 0 1 1-4.5 0 2.625 2.625 0 0 1 4.5 0Z" />
    </svg>
  ),
  settings: (
    <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
} as const;

interface AdminQuickActionsProps {
  pendingParentLinkCount: number;
  schoolId: string;
  planStatus: SchoolPlanStatus;
  schoolProfileComplete: boolean;
  studentCount: number;
}

function QuickActionSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <span
          className={dashboardSectionAccentClass}
          aria-hidden
        />
        <h3 className={dashboardSubsectionLabelClass}>
          {title}
        </h3>
      </div>
      <div className="mt-1.5 grid grid-cols-1 items-stretch gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

function UpgradePlanButton({
  schoolId,
  currentPlan,
}: {
  schoolId: string;
  currentPlan: string;
}) {
  return (
    <div className="shrink-0 sm:self-center">
      <RequestUpgradeQuickAction
        schoolId={schoolId}
        currentPlan={currentPlan}
        appearance="filled-button"
      />
    </div>
  );
}

const planStatusCardClass = cn(
  "mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm",
  "dark:border-zinc-800 dark:bg-zinc-900"
);

const planStatusRowClass =
  "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4";

const planStatusLeftClass =
  "shrink-0 sm:w-40 sm:border-r sm:border-slate-100 sm:pr-4 dark:sm:border-zinc-800";

const statusBadgeBaseClass =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1";

function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: "active" | "free" | "paid";
}) {
  const styles = {
    active:
      "bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50",
    free: "bg-slate-100 text-slate-600 ring-slate-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
    paid: "bg-[rgb(var(--school-primary-rgb)/0.08)] text-school-primary ring-[rgb(var(--school-primary-rgb)/0.18)] dark:bg-[rgb(var(--school-primary-rgb)/0.14)] dark:ring-[rgb(var(--school-primary-rgb)/0.28)]",
  } as const;

  const dotStyles = {
    active: "bg-emerald-500",
    free: "bg-slate-400 dark:bg-zinc-500",
    paid: "bg-school-primary",
  } as const;

  return (
    <span className={cn(statusBadgeBaseClass, styles[variant])}>
      {variant !== "active" ? (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotStyles[variant])}
          aria-hidden
        />
      ) : null}
      {label}
    </span>
  );
}

function PlanStatusLeftColumn({ planTitle }: { planTitle: string }) {
  return (
    <div className={planStatusLeftClass}>
      <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-zinc-100">
        {planTitle}
      </p>
      <div className="mt-1 sm:mt-1.5">
        <StatusBadge label="🟢 Active" variant="active" />
      </div>
    </div>
  );
}

function SubscriptionActiveButton() {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      className="inline-flex h-9 w-full shrink-0 cursor-default items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-5 text-sm font-medium text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 sm:w-auto sm:min-w-[9.5rem] sm:self-center"
    >
      Subscription Active
    </button>
  );
}

function UnavailablePlanButton() {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      className="inline-flex h-9 w-full shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-5 text-sm font-medium text-slate-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-500 sm:w-auto sm:min-w-[7.5rem] sm:self-center"
    >
      Unavailable
    </button>
  );
}

function PlanStatusCard({
  schoolId,
  planStatus,
  studentCount,
}: {
  schoolId: string;
  planStatus: SchoolPlanStatus;
  studentCount: number;
}) {
  if (planStatus.availability === "unavailable" || !planStatus.planId) {
    return (
      <div className={planStatusCardClass}>
        <div className={planStatusRowClass}>
          <div className={planStatusLeftClass}>
            <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-zinc-100">
              Plan status unavailable
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs leading-snug text-slate-500 dark:text-zinc-400">
              We could not load your school&apos;s subscription details. Please
              refresh the page or contact support if this continues.
            </p>
          </div>

          <UnavailablePlanButton />
        </div>
      </div>
    );
  }

  const { planId, isPaid, studentLimit } = planStatus;

  if (isPaid) {
    return (
      <div className={planStatusCardClass}>
        <div className={planStatusRowClass}>
          <PlanStatusLeftColumn planTitle={getPlanStatusCardTitle(true)} />

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-slate-400 dark:text-zinc-500">
              Student Capacity
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-slate-900 dark:text-zinc-100">
              {studentCount} Students Enrolled
            </p>
            <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-zinc-400">
              Unlimited student capacity included.
            </p>
          </div>

          <SubscriptionActiveButton />
        </div>
      </div>
    );
  }

  const freeLimit = studentLimit ?? 20;
  const capacityState = getFreePlanCapacityState(studentCount, freeLimit);
  const remainingSlots = getRemainingStudentSlots(studentCount, freeLimit);
  const isLimitReached = capacityState === "limit_reached";

  return (
    <div
      className={cn(
        planStatusCardClass,
        isLimitReached && "border-slate-300 dark:border-zinc-700"
      )}
    >
      <div className={planStatusRowClass}>
        <PlanStatusLeftColumn planTitle={getPlanStatusCardTitle(false)} />

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-slate-400 dark:text-zinc-500">
            Student Capacity
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug text-slate-900 dark:text-zinc-100">
            {studentCount} of {freeLimit} Students Used
          </p>

          {isLimitReached ? (
            <>
              <p className="mt-1 text-xs font-medium text-slate-700 dark:text-zinc-300">
                Student limit reached.
              </p>
              <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-zinc-400">
                Upgrade your plan to continue enrolling additional students.
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-zinc-400">
              {formatRemainingSlotsLabel(remainingSlots)}
            </p>
          )}
        </div>

        <UpgradePlanButton schoolId={schoolId} currentPlan={planId} />
      </div>
    </div>
  );
}

export function AdminQuickActions({
  pendingParentLinkCount,
  schoolId,
  planStatus,
  schoolProfileComplete,
  studentCount,
}: AdminQuickActionsProps) {
  return (
    <>
      <div className="space-y-4">
        <QuickActionSection title="School Setup">
          <SchoolSettingsOnboardingCard
            schoolId={schoolId}
            schoolProfileComplete={schoolProfileComplete}
            href="/dashboard/school-settings"
            title="School Settings"
            description="Configure school profile, logo, currency, academic year and preferences."
            icon={icons.settings}
          />
          <AdminQuickActionCard
            href="/dashboard/classes"
            title="Manage Classes"
            description="Create and organize classes, grades and streams."
            icon={icons.classes}
          />
          <AdminQuickActionCard
            href="/dashboard/subjects"
            title="Manage Subjects"
            description="Create and manage subjects offered by the school."
            icon={icons.subjects}
          />
        </QuickActionSection>

        <QuickActionSection title="People">
          <AdminQuickActionCard
            href="/dashboard/teachers"
            title="Teachers"
            description="Create and manage teacher accounts."
            icon={icons.teachers}
          />
          <AdminQuickActionCard
            href="/dashboard/students"
            title="Manage Students"
            description="Enrol and manage students."
            icon={icons.students}
          />
          <AdminQuickActionCard
            href="/dashboard/team"
            title="Team"
            description="Manage school administrators and staff accounts."
            icon={icons.team}
          />
        </QuickActionSection>

        <QuickActionSection title="Academics">
          <AdminQuickActionCard
            href="/dashboard/assignments"
            title="Assignments"
            description="Create and manage teacher class assignments."
            icon={icons.assignments}
          />
          <AdminQuickActionCard
            href="/dashboard/syllabus-coverage"
            title="Syllabus Coverage"
            description="Track teaching progress across classes and subjects."
            icon={icons.subjects}
          />
          <AdminQuickActionCard
            href="/dashboard/promotions"
            title="Year-end Promotions"
            description="Move students to the next class or graduate."
            icon={icons.students}
          />
        </QuickActionSection>

        <QuickActionSection title="Administration">
          <AdminQuickActionCard
            href="/dashboard/payments"
            title="Finance"
            description="Manage fees, payments, collections and reports."
            icon={icons.finance}
          />
          <AdminQuickActionHub
            title="Parent Access"
            description="Manage parent requests, links and access."
            icon={icons.parentAccess}
            actions={[
              {
                href: "/dashboard/parent-links/pending",
                label: "Requests",
                badgeCount: pendingParentLinkCount,
              },
              {
                href: "/dashboard/parent-links/approved",
                label: "Approved",
              },
            ]}
          />
          <AdminQuickActionHub
            title="Enrollment Desk"
            description="Manage admission desk users and student intake."
            icon={icons.enrollmentDesk}
            actions={[
              {
                href: "/dashboard/pending-approvals",
                label: "Students",
              },
              {
                href: "/dashboard/capture-card-users",
                label: "Desk Users",
              },
            ]}
          />
        </QuickActionSection>
      </div>
      <PlanStatusCard
        schoolId={schoolId}
        planStatus={planStatus}
        studentCount={studentCount}
      />
    </>
  );
}
