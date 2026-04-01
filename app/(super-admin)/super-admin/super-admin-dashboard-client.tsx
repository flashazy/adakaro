"use client";

import Link from "next/link";
import { formatDate } from "@/lib/format-date";
import { planDisplayName } from "@/lib/plans";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface School {
  id: string;
  name: string;
  currency: string;
  plan: string;
  created_at: string;
  admin_count: number;
  student_count: number;
}

export interface PendingUpgradeRow {
  id: string;
  school_id: string;
  school_name: string;
  requester_display: string;
  current_plan: string;
  requested_plan: string;
  created_at: string;
}

interface DashboardData {
  stats: {
    schools: number;
    students: number;
    admins: number;
    payments: number;
  };
  schools: School[];
}

interface SuperAdminDashboardClientProps {
  initialData: DashboardData;
  /** Defaults to [] if omitted (avoids crashes during HMR or stale renders). */
  initialPendingUpgrades?: PendingUpgradeRow[];
}

export function SuperAdminDashboardClient({
  initialData,
  initialPendingUpgrades = [],
}: SuperAdminDashboardClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [pendingUpgrades, setPendingUpgrades] = useState(initialPendingUpgrades);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);

  useEffect(() => {
    setPendingUpgrades(initialPendingUpgrades);
  }, [initialPendingUpgrades]);

  const filteredSchools = initialData.schools.filter((school) => {
    const matchesSearch = school.name.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === "all" || school.plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  const planNames: Record<string, string> = {
    free: "Free",
    basic: "Basic",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  async function reviewRequest(requestId: string, approve: boolean) {
    setReviewBusyId(requestId);
    try {
      const res = await fetch("/api/super-admin/upgrade-requests/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, approve }),
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(body.error || "Could not update request.");
        return;
      }
      setPendingUpgrades((rows) => rows.filter((r) => r.id !== requestId));
      router.refresh();
    } finally {
      setReviewBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
          <Link
            href="/super-admin/activity-logs"
            className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Activity logs
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {pendingUpgrades.length > 0 ? (
            <span
              className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
              title="Pending plan upgrade requests"
            >
              {pendingUpgrades.length} pending upgrade
              {pendingUpgrades.length === 1 ? "" : "s"}
            </span>
          ) : null}
          <a
            href="/super-admin/create"
            className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Create School
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4 shadow dark:bg-zinc-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Schools</p>
          <p className="text-2xl font-bold">{initialData.stats.schools}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow dark:bg-zinc-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
          <p className="text-2xl font-bold">{initialData.stats.students}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow dark:bg-zinc-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Admin Memberships</p>
          <p className="text-2xl font-bold">{initialData.stats.admins}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow dark:bg-zinc-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Payments</p>
          <p className="text-2xl font-bold">{initialData.stats.payments}</p>
        </div>
      </div>

      {pendingUpgrades.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 shadow dark:border-amber-900/40 dark:bg-amber-950/20">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Pending upgrades
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            School admins requested a plan change. Approve to update the school plan, or deny to
            close the request.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-amber-200/80 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-zinc-800">
                  <th className="px-3 py-2 text-left">School</th>
                  <th className="px-3 py-2 text-left">Requested by</th>
                  <th className="px-3 py-2 text-left">From → To</th>
                  <th className="px-3 py-2 text-left">Requested</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUpgrades.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <a
                        href={`/super-admin/schools/${row.school_id}`}
                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {row.school_name}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-zinc-300">
                      {row.requester_display}
                    </td>
                    <td className="px-3 py-2">
                      {planDisplayName(row.current_plan)} →{" "}
                      {planDisplayName(row.requested_plan)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={reviewBusyId === row.id}
                          onClick={() => reviewRequest(row.id, true)}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={reviewBusyId === row.id}
                          onClick={() => reviewRequest(row.id, false)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                        >
                          Deny
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search schools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="rounded border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="all">All plans</option>
          <option value="free">Free</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50 dark:bg-zinc-800">
              <th className="px-4 py-3 text-left">School</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Admins</th>
              <th className="px-4 py-3 text-left">Students</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchools.map((school) => (
              <tr key={school.id} className="border-b">
                <td className="px-4 py-3">{school.name}</td>
                <td className="px-4 py-3">{planNames[school.plan] || school.plan}</td>
                <td className="px-4 py-3">{school.admin_count}</td>
                <td className="px-4 py-3">{school.student_count}</td>
                <td className="px-4 py-3">{formatDate(school.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/super-admin/schools/${school.id}`}
                      className="rounded border px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                      View
                    </a>
                    <a
                      href={`/super-admin/schools/${school.id}?upgrade=1`}
                      className="rounded border px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                      Upgrade plan
                    </a>
                    <a
                      href={`/super-admin/schools/${school.id}?edit=1`}
                      className="rounded border px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                      Edit
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
