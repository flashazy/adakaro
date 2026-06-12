import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CoordinatorSyllabusCoverageClient } from "./syllabus-coverage-client";

export const dynamic = "force-dynamic";

export default async function CoordinatorSyllabusCoveragePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isTeacher = await checkIsTeacher(supabase, user.id);
  if (!isTeacher) redirect("/dashboard");

  return (
    <>
      <CoordinatorSyllabusCoverageClient />
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}
