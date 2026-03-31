import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const supportEmail =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@adakaro.com";

const DEFAULT_REASON_DISPLAY =
  "Please contact support for more information.";

/**
 * Resolves suspension_reason for the current user via service role (RLS hides
 * schools rows for suspended members).
 */
async function loadSuspensionReason(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const schoolIds = new Set<string>();

    const { data: members } = await admin
      .from("school_members")
      .select("school_id")
      .eq("user_id", userId);
    for (const m of (members ?? []) as { school_id: string }[]) {
      schoolIds.add(m.school_id);
    }

    const { data: createdSchools } = await admin
      .from("schools")
      .select("id")
      .eq("created_by", userId);
    for (const s of (createdSchools ?? []) as { id: string }[]) {
      schoolIds.add(s.id);
    }

    const { data: parentLinks } = await admin
      .from("parent_students")
      .select("student_id")
      .eq("parent_id", userId);
    const links = (parentLinks ?? []) as { student_id: string }[];
    if (links.length > 0) {
      const studentIds = links.map((l) => l.student_id);
      const { data: students } = await admin
        .from("students")
        .select("school_id")
        .in("id", studentIds);
      for (const s of (students ?? []) as { school_id: string }[]) {
        schoolIds.add(s.school_id);
      }
    }

    for (const schoolId of schoolIds) {
      const { data: school, error } = await admin
        .from("schools")
        .select("status, suspension_reason")
        .eq("id", schoolId)
        .maybeSingle();
      if (error) continue;
      const row = school as {
        status: string;
        suspension_reason: string | null;
      } | null;
      if (row?.status === "suspended") {
        return row.suspension_reason?.trim() || null;
      }
    }
  } catch {
    /* service role not configured or schema mismatch */
  }
  return null;
}

export default async function SchoolSuspendedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const rawReason = await loadSuspensionReason(user.id);
  const reasonDisplay =
    rawReason && rawReason.length > 0 ? rawReason : DEFAULT_REASON_DISPLAY;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          School Account Suspended
        </h1>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
            Reason
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-amber-950 dark:text-amber-100">
            {reasonDisplay}
          </p>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          This school account has been suspended. Please contact support at{" "}
          <a
            href={`mailto:${supportEmail}`}
            className="font-medium text-indigo-600 underline dark:text-indigo-400"
          >
            {supportEmail}
          </a>{" "}
          for assistance.
        </p>

        <p className="mt-6 text-sm font-medium text-slate-800 dark:text-zinc-200">
          To reactivate your account, please make the payment below:
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <Link
            href="/payment"
            className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Pay Now
          </Link>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:w-auto"
          >
            Home
          </Link>
        </div>

        <div className="mt-6 flex justify-end">
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
