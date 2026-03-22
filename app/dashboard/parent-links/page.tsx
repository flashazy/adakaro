import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { combineSupabaseErrors } from "@/lib/dashboard/supabase-error";
import { QueryErrorBanner } from "../query-error-banner";
import AddLinkForm from "./add-link-form";
import LinkRow, { type ParentLinkData } from "./link-row";

export default async function ParentLinksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  // Fetch parents (profiles with role 'parent'), students for this school, and existing links in parallel
  const [parentsRes, studentsRes, linksRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "parent")
      .order("full_name"),
    supabase
      .from("students")
      .select("id, full_name, admission_number, class_id, class:classes(name)")
      .eq("school_id", schoolId)
      .order("full_name"),
    supabase
      .from("parent_students")
      .select(
        "id, parent_id, student_id, parent:profiles(full_name, email), student:students(full_name, class:classes(name))"
      ),
  ]);

  const fetchError = combineSupabaseErrors([
    parentsRes.error,
    studentsRes.error,
    linksRes.error,
  ]);
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
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
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

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
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
    </div>
  );
}
