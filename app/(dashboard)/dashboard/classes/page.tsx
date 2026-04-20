import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { describeSupabaseError } from "@/lib/dashboard/supabase-error";
import { QueryErrorBanner } from "../query-error-banner";
import { AddClassForm } from "./add-class-form";
import { ClassesList } from "./classes-list";
import Link from "next/link";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";

export default async function ClassesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  const { data: classes, error } = await supabase
    .from("classes")
    .select("*")
    .eq("school_id", schoolId)
    .order("name");

  const fetchError = describeSupabaseError(error);
  if (error) {
    console.error(
      "[classes] fetch error:",
      error instanceof Object && "message" in error
        ? (error as { message?: string }).message
        : error,
      describeSupabaseError(error)
    );
  }

  const typedClasses = (classes || []) as {
    id: string;
    name: string;
    description: string | null;
    parent_class_id: string | null;
    school_id: string;
    created_at: string;
    updated_at: string;
  }[];

  // Group child streams under their parent class so the list reads as a tree.
  // Top-level classes (no parent) come first in alphabetical order; each
  // child stream follows its parent immediately. Orphans (parent missing
  // from the visible set) fall back to top-level so they remain editable.
  const byId = new Map(typedClasses.map((c) => [c.id, c] as const));
  const childrenByParent = new Map<string, typeof typedClasses>();
  const topLevel: typeof typedClasses = [];
  for (const c of typedClasses) {
    if (c.parent_class_id && byId.has(c.parent_class_id)) {
      const list = childrenByParent.get(c.parent_class_id) ?? [];
      list.push(c);
      childrenByParent.set(c.parent_class_id, list);
    } else {
      topLevel.push(c);
    }
  }
  topLevel.sort((a, b) => a.name.localeCompare(b.name));
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  const orderedClasses: { cls: (typeof typedClasses)[number]; isStream: boolean; streamCount: number }[] = [];
  for (const parent of topLevel) {
    const children = childrenByParent.get(parent.id) ?? [];
    orderedClasses.push({
      cls: parent,
      isStream: false,
      streamCount: children.length,
    });
    for (const child of children) {
      orderedClasses.push({ cls: child, isStream: true, streamCount: 0 });
    }
  }

  // Only top-level classes can act as parents — streams cannot nest further
  // (enforced by trigger). Excluding the row's own id is handled per-row.
  const parentOptions = topLevel.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Classes
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Manage your school&apos;s classes and grades.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 py-10">
        {fetchError ? (
          <QueryErrorBanner
            title="Could not load classes"
            message={fetchError}
          >
            <p>
              If this persists, apply migrations{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-950/60">
                00018_get_my_school_id.sql
              </code>{" "}
              and{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-950/60">
                00019_admin_rls_is_school_admin.sql
              </code>{" "}
              in Supabase, then reload the schema.
            </p>
          </QueryErrorBanner>
        ) : null}
        <AddClassForm parentOptions={parentOptions} />

        {!fetchError && typedClasses.length > 0 ? (
          <ClassesList items={orderedClasses} parentOptions={parentOptions} />
        ) : !fetchError ? (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No classes yet. Add your first class above.
            </p>
          </div>
        ) : null}
      </main>
      <SmartFloatingScrollButton sectionIds={[]} />
    </>
  );
}
