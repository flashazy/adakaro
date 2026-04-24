import { redirect } from "next/navigation";
import { BackButton } from "@/components/dashboard/back-button";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import {
  defaultCoordinatorAcademicYear,
  defaultCoordinatorTerm,
} from "../data";
import { reportAcademicYearToEnrollmentYear } from "@/lib/student-subject-enrollment-queries";
import {
  ReportSettingsClient,
  type CoordinatorClassOption,
  type InitialSettings,
} from "./report-settings-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Report settings — Coordinator",
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

function parseClassIdParam(
  raw: unknown,
  allowed: Set<string>
): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return null;
  const id = v.trim();
  if (!id || !allowed.has(id)) return null;
  return id;
}

export default async function CoordinatorReportSettingsPage({
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
  const yearInt = reportAcademicYearToEnrollmentYear(academicYear);

  const { data: coordRows } = await supabase
    .from("teacher_coordinators")
    .select("class_id, classes ( id, name )")
    .eq("teacher_id", user.id);

  const classes: CoordinatorClassOption[] = [];
  const seen = new Set<string>();
  for (const r of (coordRows ?? []) as {
    class_id: string;
    classes: { id: string; name: string } | null;
  }[]) {
    const name = r.classes?.name?.trim();
    if (!name || seen.has(r.class_id)) continue;
    seen.add(r.class_id);
    classes.push({ id: r.class_id, name });
  }
  classes.sort((a, b) => a.name.localeCompare(b.name));

  const allowedIds = new Set(classes.map((c) => c.id));
  const selectedClassId =
    parseClassIdParam(params.classId, allowedIds) ?? classes[0]?.id ?? "";

  let initialSettings: InitialSettings = null;
  if (selectedClassId) {
    const { data: settingsRow } = await supabase
      .from("class_report_settings")
      .select(
        "closing_date, opening_date, coordinator_message, required_items"
      )
      .eq("class_id", selectedClassId)
      .eq("term", term)
      .eq("academic_year", yearInt)
      .maybeSingle();
    initialSettings = settingsRow as InitialSettings;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Report settings
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Set term dates, a coordinator message, and required items for next
            term. These appear on report cards for this class, term, and
            academic year.
          </p>
        </div>
        <BackButton
          href="/teacher-dashboard/coordinator"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          ← Coordinator dashboard
        </BackButton>
      </div>

      {classes.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          You are not assigned as coordinator for any classes. Ask your school
          administrator to promote you to Coordinator for the classes you lead.
        </section>
      ) : (
        <ReportSettingsClient
          key={`${selectedClassId}-${term}-${academicYear}`}
          classes={classes}
          term={term}
          academicYear={academicYear}
          selectedClassId={selectedClassId}
          initialSettings={initialSettings}
        />
      )}
    </div>
  );
}
