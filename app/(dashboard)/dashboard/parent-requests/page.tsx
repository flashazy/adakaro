import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdsForAdminUser } from "@/lib/dashboard/get-school-ids";
import { combineSupabaseErrors } from "@/lib/dashboard/supabase-error";
import { QueryErrorBanner } from "../query-error-banner";
import RequestRow, { type RequestData } from "./request-row";

export default async function ParentRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const schoolIds = await getSchoolIdsForAdminUser(supabase, user.id);
  if (schoolIds.length === 0) redirect("/dashboard");

  // SECURITY DEFINER RPC (migration 00025): direct SELECT can be empty when RLS hides
  // student rows used in policy subqueries. Fallback keeps older DBs working until migrated.
  const [rpcRes, studentsRes] = await Promise.all([
    supabase.rpc("get_pending_parent_link_requests_for_admin"),
    supabase
      .from("students")
      .select("id, full_name, admission_number, class:classes(name)")
      .in("school_id", schoolIds)
      .order("full_name"),
  ]);

  let requestsRes: {
    data: typeof rpcRes.data;
    error: typeof rpcRes.error;
  };
  if (rpcRes.error) {
    console.error(
      "[parent-requests] get_pending_parent_link_requests_for_admin failed, using table query:",
      rpcRes.error.message
    );
    const fallback = await supabase
      .from("parent_link_requests")
      .select("id, parent_id, admission_number, student_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    requestsRes = { data: fallback.data as typeof rpcRes.data, error: fallback.error };
  } else {
    requestsRes = rpcRes;
  }

  const typedRequests = (requestsRes.data ?? []) as {
    id: string;
    parent_id: string;
    admission_number: string;
    student_id: string | null;
    created_at: string;
  }[];

  const parentIds = [...new Set(typedRequests.map((r) => r.parent_id))];
  let parentMap: Record<string, { full_name: string; email: string | null }> =
    {};
  let profilesError: unknown = null;
  if (parentIds.length > 0) {
    try {
      const admin = createAdminClient();
      const { data: parents, error } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", parentIds);
      profilesError = error;
      const typedParents = (parents ?? []) as {
        id: string;
        full_name: string;
        email: string | null;
      }[];
      for (const p of typedParents) {
        parentMap[p.id] = { full_name: p.full_name, email: p.email };
      }
    } catch (e) {
      profilesError = e instanceof Error ? e : new Error(String(e));
    }
  }

  const fetchError = combineSupabaseErrors([
    requestsRes.error,
    studentsRes.error,
    profilesError,
  ]);
  if (fetchError) {
    console.error("[parent-requests] error:", fetchError);
  }

  const requests: RequestData[] = typedRequests.map((r) => {
    const parent = parentMap[r.parent_id];

    return {
      id: r.id,
      parentName: parent?.full_name ?? "Unknown",
      parentEmail: parent?.email ?? null,
      admissionNumber: r.admission_number,
      matchedStudentId: r.student_id,
      createdAt: r.created_at,
    };
  });

  const typedStudentsRes = (studentsRes.data ?? []) as {
    id: string;
    full_name: string;
    admission_number: string | null;
    class: { name: string } | null;
  }[];
  const students = typedStudentsRes.map((s) => ({
    id: s.id,
    full_name: s.full_name,
    admission_number: s.admission_number,
    className: (s.class as { name: string } | null)?.name ?? "No class",
  }));


  return (
    <>
      {/* Header */}
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                Pending Approvals
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Review and approve parent access requests
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 py-8">
        <nav
          className="text-xs text-slate-500 dark:text-zinc-400"
          aria-label="Breadcrumb"
        >
          <Link
            href="/dashboard"
            className="text-slate-600 transition-colors hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-400"
          >
            Dashboard
          </Link>
          <span className="mx-1.5 text-slate-400 dark:text-zinc-600">/</span>
          <span className="text-slate-600 dark:text-zinc-300">
            Parent Links
          </span>
          <span className="mx-1.5 text-slate-400 dark:text-zinc-600">/</span>
          <span className="font-medium text-slate-900 dark:text-white">
            Pending Approvals
          </span>
        </nav>
        {fetchError ? (
          <QueryErrorBanner
            title="Could not load link requests"
            message={fetchError}
          >
            <p className="text-xs text-red-800 dark:text-red-200">
              Apply migrations{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                00019_admin_rls_is_school_admin
              </code>
              ,{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                00024_parent_link_requests_admin_visibility
              </code>
              ,{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                00025_admin_parent_link_request_rpcs
              </code>
              , and{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                00026_parent_link_request_visibility_and_cancel
              </code>{" "}
              for <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">parent_link_requests</code>{" "}
              visibility (admission match + RLS), RPC list, and admission lookup.
            </p>
          </QueryErrorBanner>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {/* Table header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Pending Approvals
            </h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {requests.length}
            </span>
          </div>

          {!fetchError && requests.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg className="mx-auto h-10 w-10 text-slate-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
                All caught up
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                No pending parent link requests at the moment.
              </p>
            </div>
          ) : fetchError ? (
            <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
              Fix the error above to load requests.
            </div>
          ) : (
            <div>
              {requests.map((req) => (
                <RequestRow
                  key={req.id}
                  request={req}
                  students={students}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
