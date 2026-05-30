import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { defaultCoordinatorAcademicYear } from "../data";
import { StudentStreamingClient } from "./streaming-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Student Streaming — Coordinator",
};

function parseYearParam(raw: unknown): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v === "string" && /^\d{4}$/.test(v.trim())) return v.trim();
  return defaultCoordinatorAcademicYear();
}

export default async function StudentStreamingPage({
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
  const academicYear = parseYearParam(params.year);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-0 pb-8 sm:px-1">
      <StudentStreamingClient initialAcademicYear={academicYear} />
    </div>
  );
}
