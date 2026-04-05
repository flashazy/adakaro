import { redirect } from "next/navigation";
import Link from "next/link";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { combineSupabaseErrors } from "@/lib/dashboard/supabase-error";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { QueryErrorBanner } from "../query-error-banner";
import { ParentLinksTable } from "./parent-links-table";
import type { ParentLinkData } from "./link-row-types";

type Db = SupabaseClient<Database>;

type LinksFetchBundle = {
  studentsRes: { data: unknown; error: unknown };
  linksRes: { data: unknown; error: unknown };
};

/** PostgREST may return a single object or a one-element array for FK embeds. */
function classNameFromEmbed(
  cls: { name: string } | { name: string }[] | null | undefined
): string | null {
  if (cls == null) return null;
  if (Array.isArray(cls)) return cls[0]?.name ?? null;
  return cls.name ?? null;
}

/** True when this PostgREST / Postgres error should trigger a service-role refetch. */
function isRlsOrPermissionError(err: unknown): boolean {
  if (err == null) return false;

  const o = err as Record<string, unknown>;
  const codeRaw = o.code != null ? String(o.code) : "";
  const code = codeRaw.toUpperCase().replace(/^0+/, "") || codeRaw;

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

function anyQueryNeedsAdminFallback(bundle: LinksFetchBundle): boolean {
  return (
    isRlsOrPermissionError(bundle.studentsRes.error) ||
    isRlsOrPermissionError(bundle.linksRes.error)
  );
}

/** Session-scoped client: full selects including class name. */
async function fetchParentLinksWithClient(
  client: Db,
  schoolId: string,
  options: { includeClassJoin: boolean }
): Promise<LinksFetchBundle> {
  const studentSelect = options.includeClassJoin
    ? "id, full_name, admission_number, class_id, class:classes(name)"
    : "id, full_name, admission_number, class_id";

  const linkStudentSelect = options.includeClassJoin
    ? "student:students(full_name, class:classes(name))"
    : "student:students(full_name)";

  const [studentsRes, linksResAll] = await Promise.all([
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
    studentsRes,
    linksRes: { data: filtered, error: linksResAll.error },
  };
}

/** Service role: same class embed as session client so CLASS column stays correct after fallback. */
async function fetchParentLinksWithAdminClient(
  admin: Db,
  schoolId: string
): Promise<LinksFetchBundle> {
  const studentsRes = await admin
    .from("students")
    .select("id, full_name, admission_number, class_id, class:classes(name)")
    .eq("school_id", schoolId)
    .order("full_name");

  const studentRows = (studentsRes.data ?? []) as { id: string }[];
  const studentIds = studentRows.map((s) => s.id);

  const linksRes =
    studentIds.length > 0
      ? await admin
          .from("parent_students")
          .select(
            "id, parent_id, student_id, parent:profiles(full_name, email), student:students(full_name, class:classes(name))"
          )
          .in("student_id", studentIds)
      : { data: [] as unknown[], error: null };

  return { studentsRes, linksRes };
}

export default async function ParentLinksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  let { studentsRes, linksRes } = await fetchParentLinksWithClient(
    supabase,
    schoolId,
    { includeClassJoin: true }
  );

  let fetchError = combineSupabaseErrors([
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

  const anyUserQueryFailed =
    studentsRes.error != null || linksRes.error != null;

  if (
    anyQueryNeedsAdminFallback({ studentsRes, linksRes }) ||
    combinedSuggestsPermission ||
    anyUserQueryFailed
  ) {
    try {
      const admin = createAdminClient();
      const adminBundle = await fetchParentLinksWithAdminClient(admin, schoolId);
      const adminErr = combineSupabaseErrors([
        adminBundle.studentsRes.error,
        adminBundle.linksRes.error,
      ]);
      if (!adminErr) {
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

  const typedStudentsRes = (studentsRes.data ?? []) as {
    id: string;
    full_name: string;
    admission_number: string | null;
    class: { name: string } | { name: string }[] | null;
  }[];
  const students = typedStudentsRes.map((s) => ({
    id: s.id,
    full_name: s.full_name,
    admission_number: s.admission_number,
    className: classNameFromEmbed(s.class) ?? "No class",
  }));

  const typedLinks = (linksRes.data ?? []) as {
    id: string;
    parent_id: string;
    student_id: string;
    parent: { full_name: string; email: string | null } | null;
    student: {
      full_name: string;
      class: { name: string } | { name: string }[] | null;
    } | null;
  }[];

  const linkRows: ParentLinkData[] = typedLinks.map((l) => {
    const parent = l.parent as { full_name: string; email: string | null } | null;
    const student = l.student as {
      full_name: string;
      class: { name: string } | { name: string }[] | null;
    } | null;

    const fromEmbed = classNameFromEmbed(student?.class);
    const fromStudentList = students.find((s) => s.id === l.student_id)?.className;

    return {
      id: l.id,
      parentName: parent?.full_name ?? "Unknown",
      parentEmail: parent?.email ?? null,
      studentName: student?.full_name ?? "Unknown",
      className: fromEmbed ?? fromStudentList ?? "No class",
    };
  });

  const schoolStudentIds = new Set(students.map((s) => s.id));
  const filteredLinks = linkRows.filter((l) => {
    const orig = typedLinks.find((r) => r.id === l.id);
    return orig ? schoolStudentIds.has(orig.student_id) : true;
  });

  return (
    <>
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
                Approved Connections
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                View and manage approved parent-student connections
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
            Approved Connections
          </span>
        </nav>
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

        {fetchError ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Fix the error above to load links.
          </div>
        ) : (
          <ParentLinksTable links={filteredLinks} />
        )}
      </main>
      <SmartFloatingScrollButton sectionIds={[]} />
    </>
  );
}
