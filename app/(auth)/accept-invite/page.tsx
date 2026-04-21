import Link from "next/link";
import { getTeacherInvitePreview } from "./actions";
import { AcceptInviteForm } from "./accept-invite-form";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token: raw } = await searchParams;
  const token = raw?.trim() ?? "";

  if (!token) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Invalid link
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          This invitation link is missing a token. Ask your school admin for a new
          invitation.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  const preview = await getTeacherInvitePreview(token);

  if (!preview.ok) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Invitation unavailable
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          {preview.error}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <AcceptInviteForm token={token} invitedEmail={preview.email} />
  );
}
