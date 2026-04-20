import { redirect } from "next/navigation";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { createClient } from "@/lib/supabase/server";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import { createAdminClient } from "@/lib/supabase/admin";
import { filterLeafClassOptions } from "@/lib/class-options";
import { fetchSubjectsForSchoolAdmin } from "./actions";
import { SubjectsPageClient } from "./subjects-page-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Subjects — School",
};

export default async function SubjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolved = await resolveSchoolDisplay(user.id, supabase);
  if (!resolved?.schoolId) redirect("/dashboard");

  const schoolId = resolved.schoolId;

  const { data: isAdmin } = await supabase.rpc(
    "is_school_admin",
    { p_school_id: schoolId } as never
  );

  if (!isAdmin) redirect("/dashboard");

  const rows = await fetchSubjectsForSchoolAdmin(schoolId);

  const admin = createAdminClient();
  const { data: classRows } = await admin
    .from("classes")
    .select("id, name, parent_class_id")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  // Subjects bind to concrete streams, not umbrella parent classes, so strip
  // parents from the picker while keeping standalone top-level classes.
  const classOptions = filterLeafClassOptions(
    (classRows ?? []) as {
      id: string;
      name: string;
      parent_class_id: string | null;
    }[]
  ).map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Subjects
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Define the subjects teachers can be assigned to. This keeps naming
            consistent for reporting and avoids typos.
          </p>
        </div>
        <SubjectsPageClient initialRows={rows} classOptions={classOptions} />
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}
