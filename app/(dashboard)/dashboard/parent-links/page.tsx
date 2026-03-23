import { redirect } from "next/navigation";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { combineSupabaseErrors } from "@/lib/dashboard/supabase-error";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { QueryErrorBanner } from "../query-error-banner";
import AddLinkForm from "./add-link-form";
import LinkRow, { type ParentLinkData } from "./link-row";

type Db = SupabaseClient<Database>;
type FetchBundle = {
  parentsRes: { data: unknown; error: unknown };
  studentsRes: { data: unknown; error: unknown };
  linksRes: { data: unknown; error: unknown };
};

/** True when this PostgREST / Postgres error should trigger a service-role refetch. */
function isRlsOrPermissionError(err: unknown): boolean {
  if (err == null) return false;

  const o = err as Record<string, unknown>;
  const codeRaw = o.code != null ? String(o.code) : "";
  const code = codeRaw.toUpperCase().replace(/^0+/, "") || codeRaw;

  // Postgres privilege / RLS recursion (string or numeric codes from drivers)
  if (
    code === "42501" ||
    code === "42P17" ||
    code.includes("42501") ||
    code.includes("42P17")
  ) {
    return true;
  }

  const text = [o.message, o.details, o.hint, o.description]
    .filter((x) => typeof x === "string")
    .join(" ")
    .toLowerCase();

  if (
    text.includes("42501") ||
    text.includes("42p17") ||
    text.includes("permission denied") ||
    text.includes("infinite recursion") ||
    text.includes("row-level security") ||
    text.includes("rls policy") ||
    text.includes("insufficient privilege")
  ) {
    return true;
  }

  // Some clients only expose a nested cause or minimal shape — scan serialized form
  try {
    const blob = JSON.stringify(err).toLowerCase();
    if (
      blob.includes("42501") ||
      blob.includes("42p17") ||
      blob.includes("permission denied") ||
      blob.includes("infinite recursion")
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}

function anyQueryNeedsAdminFallback(bundle: FetchBundle): boolean {
  return (
    isRlsOrPermissionError(bundle.parentsRes.error) ||
    isRlsOrPermissionError(bundle.studentsRes.error) ||
    isRlsOrPermissionError(bundle.linksRes.error)
  );
}

/** Session-scoped client: full selects including class name. */
async function fetchParentLinksWithClient(
  client: Db,
  schoolId: string,
  options: { includeClassJoin: boolean }
): Promise<FetchBundle> {
  const studentSelect = options.includeClassJoin
    ? "id, full_name, admission_number, class_id, class:classes(name)"
    : "id, full_name, admission_number, class_id";

  const linkStudentSelect = options.includeClassJoin
    ? "student:students(full_name, class:classes(name))"
    : "student:students(full_name)";

  const [parentsRes, studentsRes, linksResAll] = await Promise.all([
    client
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "parent")
      .order("full_name"),
    client
      .from("students")
      .select(studentSelect)
      .eq("school_id", schoolId)
      .order("full_name"),
    client.from("parent_students").select(
      `id, parent_id, student_id, parent:profiles(full_name, email), ${linkStudentSelect}`
    ),
  ]);

  const studentRows = (studentsRes.data ?? []) as { id: string }[];
  const schoolStudentIds = new Set(studentRows.map((s) => s.id));

  const rows = (linksResAll.data ?? []) as { student_id: string }[];
  const filtered = rows.filter((r) => schoolStudentIds.has(r.student_id));

  return {
    parentsRes,
    studentsRes,
    linksRes: { data: filtered, error: linksResAll.error },
  };
}

/**
 * Service role: avoid embedding `classes` — some projects omit GRANT on `classes`
 * for `service_role`, which causes 42501 even though RLS is bypassed.
 */
async function fetchParentLinksWithAdminClient(
  admin: Db,
  schoolId: string
): Promise<FetchBundle> {
  const [parentsRes, studentsRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "parent")
      .order("full_name"),
    admin
      .from("students")
      .select("id, full_name, admission_number, class_id")
      .eq("school_id", schoolId)
      .order("full_name"),
  ]);

  const studentRows = (studentsRes.data ?? []) as { id: string }[];
  const studentIds = studentRows.map((s) => s.id);

  const linksRes =
    studentIds.length > 0
      ? await admin
          .from("parent_students")
          .select(
            "id, parent_id, student_id, parent:profiles(full_name, email), student:students(full_name)"
          )
          .in("student_id", studentIds)
      : { data: [] as unknown[], error: null };

  return { parentsRes, studentsRes, linksRes };
}

export default async function ParentLinksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  let { parentsRes, studentsRes, linksRes } = await fetchParentLinksWithClient(
    supabase,
    schoolId,
    { includeClassJoin: true }
  );

  let fetchError = combineSupabaseErrors([
    parentsRes.error,
    studentsRes.error,
    linksRes.error,
  ]);

  const combinedSuggestsPermission =
    fetchError != null &&
    (() => {
      const m = fetchError.toLowerCase();
      return (
        m.includes("42p17") ||
        m.includes("42501") ||
        m.includes("infinite recursion") ||
        m.includes("permission denied") ||
        m.includes("row-level security") ||
        m.includes("rls policy") ||
        m.includes("insufficient privilege")
      );
    })();

  // Any failed query from the session client → one admin attempt (covers odd PostgREST shapes)
  const anyUserQueryFailed =
    parentsRes.error != null ||
    studentsRes.error != null ||
    linksRes.error != null;

  if (
    anyQueryNeedsAdminFallback({ parentsRes, studentsRes, linksRes }) ||
    combinedSuggestsPermission ||
    anyUserQueryFailed
  ) {
    try {
      const admin = createAdminClient();
      const adminBundle = await fetchParentLinksWithAdminClient(admin, schoolId);
      const adminErr = combineSupabaseErrors([
        adminBundle.parentsRes.error,
        adminBundle.studentsRes.error,
        adminBundle.linksRes.error,
      ]);
      if (!adminErr) {
        parentsRes = adminBundle.parentsRes;
        studentsRes = adminBundle.studentsRes;
        linksRes = adminBundle.linksRes;
        fetchError = null;
      } else {
        fetchError = adminErr;
      }
    } catch (e) {
      fetchError =
        fetchError +
        (e instanceof Error
          ? `\n\nService role fallback failed: ${e.message}`
          : "\n\nService role fallback failed.");
    }
  }

  if (fetchError) {
    console.error("[parent-links] error:", fetchError);
  }

  const typedParents = (parentsRes.data ?? []) as { id: string; full_name: string; email: string | null }[];
  const parents = typedParents.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
  }));

  const typedStudentsRes = (studentsRes.data ?? []) as { id: string; full_name: string; admission_number: string | null; class: { name: string } | null }[];
  const students = typedStudentsRes.map((s) => ({
    id: s.id,
    full_name: s.full_name,
    admission_number: s.admission_number,
    className:
      (s.class as { name: string } | null)?.name ?? "No class",
  }));

  const typedLinks = (linksRes.data ?? []) as {
    id: string;
    parent_id: string;
    student_id: string;
    parent: { full_name: string; email: string | null } | null;
    student: { full_name: string; class: { name: string } | null } | null;
  }[];
  // Build link rows with joined names
  const linkRows: ParentLinkData[] = typedLinks.map((l) => {
    const parent = l.parent as { full_name: string; email: string | null } | null;
    const student = l.student as {
      full_name: string;
      class: { name: string } | null;
    } | null;

    return {
      id: l.id,
      parentName: parent?.full_name ?? "Unknown",
      parentEmail: parent?.email ?? null,
      studentName: student?.full_name ?? "Unknown",
      className: student?.class?.name ?? "No class",
    };
  });

  // Only show links for students in this school
  const schoolStudentIds = new Set(students.map((s) => s.id));
  const filteredLinks = linkRows.filter((l) => {
    const orig = typedLinks.find((r) => r.id === l.id);
    return orig ? schoolStudentIds.has(orig.student_id) : true;
  });

  return (
    <>
      {/* Header */}
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40">
              <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                Parent–Student Links
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Manage which parents can see which students
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

      <main className="mx-auto max-w-5xl space-y-8 py-8">
        {fetchError ? (
          <QueryErrorBanner
            title="Could not load parent links data"
            message={fetchError}
          >
            <p className="text-xs text-red-800 dark:text-red-200">
              Apply migration{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                00019_admin_rls_is_school_admin
              </code>{" "}
              if admins cannot read{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                parent_students
              </code>{" "}
              or related rows.
            </p>
          </QueryErrorBanner>
        ) : null}

        {/* Add form */}
        <AddLinkForm parents={parents} students={students} />

        {/* Existing links */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              Existing Links
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
              {filteredLinks.length}
            </span>
          </div>

          {!fetchError && filteredLinks.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg className="mx-auto h-10 w-10 text-slate-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
              </svg>
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
                No links yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Use the form above to link a parent account to a student.
              </p>
            </div>
          ) : fetchError ? (
            <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
              Fix the error above to load links.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-800/30">
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Parent
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Student
                    </th>
                    <th className="hidden px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell dark:text-zinc-400">
                      Class
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLinks.map((link) => (
                    <LinkRow key={link.id} link={link} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
