import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvitationClient } from "./accept-invitation-client";

export const dynamic = "force-dynamic";

function InvalidToken() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        Invalid invitation
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
        This link is missing a token. Ask your school admin to send a new
        invitation.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
      >
        ← Back to home
      </Link>
    </div>
  );
}

function InviteNotFound() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        Invitation unavailable
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
        This invitation may have expired, already been used, or the link is
        incorrect.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
      >
        Go to sign in
      </Link>
    </div>
  );
}

interface PeekResult {
  ok?: boolean;
  school_name?: string;
  invited_email?: string;
  expires_at?: string;
}

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = rawToken?.trim() ?? "";

  if (!token) {
    return <InvalidToken />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: peekRaw, error: peekErr } = await supabase.rpc(
    "peek_school_invitation",
    { p_token: token } as never
  );

  if (peekErr) {
    console.error("[accept-invitation] peek", peekErr);
    return <InviteNotFound />;
  }

  const peek = peekRaw as PeekResult;
  if (!peek?.ok || !peek.invited_email || !peek.school_name) {
    return <InviteNotFound />;
  }

  const nextPath = `/accept-invitation?token=${encodeURIComponent(token)}`;
  const loginUrl = `/login?next=${encodeURIComponent(nextPath)}`;
  const signupUrl = `/signup?next=${encodeURIComponent(nextPath)}`;

  return (
    <AcceptInvitationClient
      token={token}
      schoolName={peek.school_name}
      invitedEmail={peek.invited_email}
      isLoggedIn={!!user}
      userEmail={user?.email ?? null}
      loginUrl={loginUrl}
      signupUrl={signupUrl}
    />
  );
}
