import { checkIsTeacher } from "@/lib/teacher-auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TeacherSyllabusCoverageClient } from "./teacher-syllabus-client";

export const dynamic = "force-dynamic";

export default async function TeacherSyllabusCoveragePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isTeacher = await checkIsTeacher(supabase, user.id);
  if (!isTeacher) redirect("/dashboard");

  return (
    <div className="space-y-6 bg-gray-50 px-2 py-6 dark:bg-zinc-950 sm:px-4 lg:px-6">
      <TeacherSyllabusCoverageClient />
    </div>
  );
}
