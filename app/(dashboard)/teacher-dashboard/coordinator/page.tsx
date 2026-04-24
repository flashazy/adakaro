import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import {
  defaultCoordinatorAcademicYear,
  defaultCoordinatorTerm,
  loadCoordinatorOverview,
} from "./data";
import { CoordinatorDashboardClient } from "./coordinator-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Coordinator — Teacher",
};

function parseTermParam(raw: unknown): "Term 1" | "Term 2" {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "Term 2") return "Term 2";
  if (v === "Term 1") return "Term 1";
  return defaultCoordinatorTerm();
}

function parseYearParam(raw: unknown): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v === "string" && /^\d{4}$/.test(v.trim())) return v.trim();
  return defaultCoordinatorAcademicYear();
}

export default async function CoordinatorDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkIsTeacher(supabase, user.id))) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const term = parseTermParam(params.term);
  const academicYear = parseYearParam(params.year);

  const overview = await loadCoordinatorOverview({
    userId: user.id,
    term,
    academicYear,
  });

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-8 px-0 pb-8 sm:px-1">
        {overview.classes.length === 0 ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Coordinator Dashboard
            </h1>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              You are not currently assigned as coordinator for any classes. Ask
              your school administrator to promote you to Coordinator from the
              Teachers page (requires the Academic role).
            </section>
          </>
        ) : (
          <CoordinatorDashboardClient
            overview={overview}
            term={term}
            academicYear={academicYear}
          />
        )}
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}
