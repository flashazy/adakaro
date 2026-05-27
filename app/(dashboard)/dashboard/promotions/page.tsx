import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { enrichClassesWithNext } from "@/lib/promotions/resolve-next-class";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import { BackButton } from "@/components/dashboard/back-button";
import { PromotionsClient } from "./promotions-client";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: schoolId,
  } as never);
  if (!isAdmin) redirect("/dashboard");

  const [{ data: tracks }, { data: classes }, { data: students }] =
    await Promise.all([
      supabase
        .from("class_progression_tracks")
        .select("id, track_name")
        .eq("school_id", schoolId)
        .order("track_name"),
      supabase
        .from("classes")
        .select("id, name, track_id, progression_order, parent_class_id")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("students")
        .select("id, class_id")
        .eq("school_id", schoolId)
        .eq("status", "active")
        .eq("approval_status", "approved"),
    ]);

  const trackNameById = new Map(
    ((tracks ?? []) as { id: string; track_name: string }[]).map((t) => [
      t.id,
      t.track_name,
    ] as const)
  );

  const countByClass = new Map<string, number>();
  for (const s of (students ?? []) as { id: string; class_id: string }[]) {
    countByClass.set(s.class_id, (countByClass.get(s.class_id) ?? 0) + 1);
  }

  const classRows = (classes ?? []) as {
    id: string;
    name: string;
    track_id: string | null;
    progression_order: number | null;
    parent_class_id: string | null;
  }[];

  const enriched = enrichClassesWithNext(
    classRows.map((c) => ({
      id: c.id,
      name: c.name,
      track_id: c.track_id,
      progression_order: c.progression_order,
    }))
  );

  const promotionClasses = enriched
    .filter((c) => {
      const raw = classRows.find((r) => r.id === c.id);
      return !raw?.parent_class_id;
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      track_id: c.track_id,
      track_name: c.track_id ? trackNameById.get(c.track_id) ?? null : null,
      progression_order: c.progression_order,
      student_count: countByClass.get(c.id) ?? 0,
      next_class_id: c.next_class_id,
      next_class_name: c.next_class_name,
    }))
    .sort((a, b) => {
      const ta = a.track_name ?? "zzz";
      const tb = b.track_name ?? "zzz";
      if (ta !== tb) return ta.localeCompare(tb);
      const oa = a.progression_order ?? 9999;
      const ob = b.progression_order ?? 9999;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });

  const setupClasses = classRows.map((c) => ({
    id: c.id,
    name: c.name,
    track_id: c.track_id,
    progression_order: c.progression_order,
    parent_class_id: c.parent_class_id,
  }));

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <BackButton
              href="/dashboard"
              className="mb-2 inline-flex text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              ← Back to dashboard
            </BackButton>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Year-end promotions
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Move students to the next class, repeat, or graduate. History is
              kept for grades, attendance, and payments.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <PromotionsClient
          academicYear={currentAcademicYear()}
          tracks={(tracks ?? []) as { id: string; track_name: string }[]}
          classes={promotionClasses}
          setupClasses={setupClasses}
        />
      </main>
    </>
  );
}
