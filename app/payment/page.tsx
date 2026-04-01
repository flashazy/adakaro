import Link from "next/link";
import { redirect } from "next/navigation";
import SchoolReactivationPaymentClient from "@/components/payment/SchoolReactivationPaymentClient";
import type { SuspendedSchoolContext } from "@/lib/payment/school-reactivation";
import { findSuspendedSchoolForAdmin } from "@/lib/payment/school-reactivation";
import { PLANS } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Flip to `true` when ClickPesa is production-ready. The full payment UI in
 * `SchoolReactivationPaymentClient` stays wired; only this gate changes.
 */
const PAYMENT_PROCESSING_ENABLED = false;

const supportEmail =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@adakaro.com";

function PaymentComingSoonView({ ctx }: { ctx: SuspendedSchoolContext }) {
  const planLabel = PLANS[ctx.plan]?.name ?? ctx.plan;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div
        className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-100"
        role="status"
      >
        <p className="font-medium">
          Payment processing is currently being set up. Please contact support to
          reactivate your account.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
              Account status
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              Reactivate your school
            </h1>
          </div>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            Suspended
          </span>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-slate-500 dark:text-zinc-500">
              School
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">
              {ctx.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 dark:text-zinc-500">
              Plan
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">
              {planLabel}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-slate-500 dark:text-zinc-500">
              Suspension reason
            </dt>
            <dd className="mt-0.5 text-slate-800 dark:text-zinc-200">
              {ctx.suspensionReason?.trim()
                ? ctx.suspensionReason
                : "No reason was provided. Contact support if you need details."}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Payment processing coming soon
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          We&apos;re setting up payment processing. To reactivate your account,
          please contact:
        </p>
        <p className="mt-3">
          <a
            href={`mailto:${supportEmail}`}
            className="text-base font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-500 dark:text-indigo-400 dark:decoration-indigo-600 dark:hover:text-indigo-300"
          >
            {supportEmail}
          </a>
        </p>

        <div className="mt-8">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex min-h-[48px] w-full cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500 shadow-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500 sm:w-auto sm:min-w-[220px]"
          >
            Pay now — Coming soon
          </button>
          <p className="mt-3 text-xs text-slate-500 dark:text-zinc-500">
            Online payment is not available yet. Use the email above to reach
            support.
          </p>

          <p className="mt-8 text-sm font-medium text-slate-700 dark:text-zinc-300">
            While you wait, you can:
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
            <Link
              href="/dashboard"
              title="Open your school dashboard"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              Go to dashboard
            </Link>
            <Link
              href="/"
              prefetch={false}
              title="Go to the landing page"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Go to homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function PaymentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-slate-600 dark:text-zinc-400">
        <p>Payment is temporarily unavailable. Please try again later.</p>
      </div>
    );
  }

  const ctx = await findSuspendedSchoolForAdmin(admin, user.id);

  if (!ctx) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            No suspended school to pay for
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            This page is only for school administrators whose school is suspended.
            If your account is blocked, go to the suspension notice page.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/school-suspended"
              className="inline-flex justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Suspension notice
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-10 dark:bg-zinc-950">
      {PAYMENT_PROCESSING_ENABLED ? (
        <SchoolReactivationPaymentClient initial={ctx} />
      ) : (
        <PaymentComingSoonView ctx={ctx} />
      )}
    </div>
  );
}
