"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatLocaleDateTime, formatShortLocaleDate } from "@/lib/format-date";
import { normalizePlanId, planDisplayName } from "@/lib/plans";
import { SchoolCurrencySelect } from "@/components/SchoolCurrencySelect";

const PLANS = ["free", "basic", "pro", "enterprise"] as const;

export interface SchoolDetail {
  id: string;
  name: string;
  plan: string;
  currency: string;
  created_at: string;
  created_by: string;
}

export interface MemberRow {
  user_id: string;
  role: string;
  full_name: string;
  email: string | null;
}

export interface StudentRow {
  id: string;
  full_name: string;
  admission_number: string | null;
  status: string;
}

export interface InvitationRow {
  id: string;
  invited_email: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface Props {
  school: SchoolDetail;
  members: MemberRow[];
  students: StudentRow[];
  studentCount: number;
  invitations: InvitationRow[];
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 dark:bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function SchoolDetailClient({
  school: initialSchool,
  members: initialMembers,
  students: initialStudents,
  studentCount: initialStudentCount,
  invitations: initialInvitations,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [school, setSchool] = useState(initialSchool);
  const [members, setMembers] = useState(initialMembers);
  const [students, setStudents] = useState(initialStudents);
  const [studentCount, setStudentCount] = useState(initialStudentCount);
  const [invitations, setInvitations] = useState(initialInvitations);

  useEffect(() => {
    setSchool(initialSchool);
    setMembers(initialMembers);
    setStudents(initialStudents);
    setStudentCount(initialStudentCount);
    setInvitations(initialInvitations);
  }, [
    initialSchool,
    initialMembers,
    initialStudents,
    initialStudentCount,
    initialInvitations,
  ]);

  const [planOpen, setPlanOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const stripQueryModalFlags = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    if (!sp.has("upgrade") && !sp.has("edit")) return;
    sp.delete("upgrade");
    sp.delete("edit");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const closePlanModal = useCallback(() => {
    setPlanOpen(false);
    stripQueryModalFlags();
  }, [stripQueryModalFlags]);

  const closeEditModal = useCallback(() => {
    setEditOpen(false);
    stripQueryModalFlags();
  }, [stripQueryModalFlags]);

  useEffect(() => {
    const u = searchParams.get("upgrade");
    const e = searchParams.get("edit");
    if (u === "1" || u === "true") setPlanOpen(true);
    if (e === "1" || e === "true") setEditOpen(true);
  }, [searchParams]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [invitePending, setInvitePending] = useState(false);

  const [plan, setPlan] = useState(() => normalizePlanId(school.plan));
  useEffect(() => {
    setPlan(normalizePlanId(school.plan));
  }, [school.plan]);

  const [editPlan, setEditPlan] = useState(() => normalizePlanId(school.plan));
  useEffect(() => {
    setEditPlan(normalizePlanId(school.plan));
  }, [school.plan]);

  async function refresh() {
    router.refresh();
  }

  async function submitPlan(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/super-admin/schools/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: school.id, plan }),
      credentials: "same-origin",
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      alert(body.error || "Could not update plan");
      return;
    }
    const nextPlan = normalizePlanId(plan);
    setSchool((s) => ({ ...s, plan: nextPlan }));
    setPlan(nextPlan);
    setEditPlan(nextPlan);
    closePlanModal();
    await refresh();
  }

  async function submitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/super-admin/schools/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: school.id,
        name: fd.get("name"),
        currency: fd.get("currency"),
        plan: editPlan,
      }),
      credentials: "same-origin",
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      plan?: string;
    };
    if (!res.ok) {
      alert(body.error || "Could not save");
      return;
    }
    const nextPlan = normalizePlanId(body.plan ?? editPlan);
    setSchool((s) => ({
      ...s,
      name: String(fd.get("name") ?? "").trim(),
      currency: String(fd.get("currency") ?? "").toUpperCase(),
      plan: nextPlan,
    }));
    setPlan(nextPlan);
    setEditPlan(nextPlan);
    closeEditModal();
    await refresh();
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInvitePending(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/super-admin/schools/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id, email: inviteEmail }),
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        inviteLink?: string;
      };
      if (!res.ok) {
        setInviteMsg(body.error || "Invite failed");
        return;
      }
      setInviteEmail("");
      setInviteMsg(
        body.inviteLink
          ? `Invite created. Share this link: ${body.inviteLink}`
          : "Invite created."
      );
      await refresh();
    } finally {
      setInvitePending(false);
    }
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this member from the school?")) return;
    const res = await fetch("/api/super-admin/schools/remove-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: school.id, userId }),
      credentials: "same-origin",
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      alert(body.error || "Remove failed");
      return;
    }
    setMembers((m) => m.filter((x) => x.user_id !== userId));
    await refresh();
  }

  async function changeRole(userId: string, role: string) {
    const res = await fetch("/api/super-admin/schools/member-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: school.id, userId, role }),
      credentials: "same-origin",
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      alert(body.error || "Update failed");
      return;
    }
    setMembers((m) =>
      m.map((x) => (x.user_id === userId ? { ...x, role } : x))
    );
    await refresh();
  }

  async function resendInvitation(invitationId: string) {
    const res = await fetch("/api/super-admin/invitations/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
      credentials: "same-origin",
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      inviteLink?: string;
    };
    if (!res.ok) {
      alert(body.error || "Resend failed");
      return;
    }
    if (body.inviteLink) {
      alert(`Link (copy to send): ${body.inviteLink}`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <div className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/super-admin"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            ← Back to dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {school.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            School ID: {school.id}
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setPlanOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Change plan
          </button>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Edit school
          </button>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Details
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500 dark:text-zinc-400">Plan</dt>
              <dd className="font-medium text-slate-900 dark:text-white">
                {planDisplayName(school.plan)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-zinc-400">Currency</dt>
              <dd className="font-medium text-slate-900 dark:text-white">
                {school.currency}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-zinc-400">Created</dt>
              <dd className="font-medium text-slate-900 dark:text-white">
                {formatLocaleDateTime(school.created_at)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Invite admin
          </h2>
          <form onSubmit={sendInvite} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            />
            <button
              type="submit"
              disabled={invitePending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            >
              {invitePending ? "Sending…" : "Invite"}
            </button>
          </form>
          {inviteMsg ? (
            <p className="mt-3 break-all text-sm text-slate-600 dark:text-zinc-400">
              {inviteMsg}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Admins &amp; members
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-700">
                  <th className="py-2 pr-4 font-semibold">Name</th>
                  <th className="py-2 pr-4 font-semibold">Email</th>
                  <th className="py-2 pr-4 font-semibold">Role</th>
                  <th className="py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {members.map((m) => {
                  const isCreator = m.user_id === school.created_by;
                  return (
                    <tr key={m.user_id}>
                      <td className="py-2 pr-4">{m.full_name}</td>
                      <td className="py-2 pr-4 text-slate-600 dark:text-zinc-400">
                        {m.email ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          value={m.role}
                          disabled={isCreator && m.role === "admin"}
                          title={
                            isCreator && m.role === "admin"
                              ? "School creator must stay an admin"
                              : undefined
                          }
                          onChange={(e) =>
                            changeRole(m.user_id, e.target.value)
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                        >
                          <option value="admin">admin</option>
                          <option value="parent">parent</option>
                        </select>
                        {isCreator ? (
                          <span className="ml-2 text-xs text-slate-500">
                            (creator)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          disabled={isCreator}
                          onClick={() => removeMember(m.user_id)}
                          className="text-xs font-medium text-red-600 disabled:opacity-40 dark:text-red-400"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Students ({studentCount})
          </h2>
          <div className="mt-4 max-h-80 overflow-y-auto overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-700">
                  <th className="py-2 pr-4 font-semibold">Name</th>
                  <th className="py-2 pr-4 font-semibold">Admission #</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-4">{s.full_name}</td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-zinc-400">
                      {s.admission_number ?? "—"}
                    </td>
                    <td className="py-2">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">No students yet.</p>
            ) : null}
            {studentCount > students.length ? (
              <p className="mt-2 text-xs text-slate-500">
                Showing first {students.length} of {studentCount}.
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Pending invitations
          </h2>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-zinc-800">
            {invitations.length === 0 ? (
              <li className="py-3 text-sm text-slate-500">None.</li>
            ) : (
              invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {inv.invited_email}
                    </span>
                    <span className="ml-2 text-slate-500">
                      expires{" "}
                      {formatShortLocaleDate(inv.expires_at)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => resendInvitation(inv.id)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium dark:border-zinc-600"
                  >
                    Resend (copy link)
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>

      {planOpen ? (
        <ModalShell title="Change plan" onClose={closePlanModal}>
          <form onSubmit={submitPlan} className="space-y-4">
            <select
              value={plan}
              onChange={(e) => setPlan(normalizePlanId(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {planDisplayName(p)}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Choose any tier (upgrade or downgrade). Saving updates plan limits
              immediately.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closePlanModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {editOpen ? (
        <ModalShell title="Edit school" onClose={closeEditModal}>
          <form key={school.id} onSubmit={submitEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
                School name
              </label>
              <input
                name="name"
                required
                defaultValue={school.name}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
                Currency
              </label>
              <SchoolCurrencySelect
                id={`detail-edit-curr-${school.id}`}
                defaultValue={school.currency}
              />
            </div>
            <div>
              <label
                htmlFor={`detail-edit-plan-${school.id}`}
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Plan
              </label>
              <select
                id={`detail-edit-plan-${school.id}`}
                value={editPlan}
                onChange={(e) => setEditPlan(normalizePlanId(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              >
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {planDisplayName(p)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                You can set any tier; limits update automatically when you save.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}
