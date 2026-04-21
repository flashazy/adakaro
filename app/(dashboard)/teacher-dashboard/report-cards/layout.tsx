import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";

/**
 * Report card score entry and approval are restricted to teachers assigned as
 * class coordinators (see Coordinator dashboard). Regular teachers are redirected.
 */
export default async function TeacherReportCardsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkIsTeacher(supabase, user.id))) redirect("/dashboard");

  const { data: coordinatorRow } = await supabase
    .from("teacher_coordinators")
    .select("id")
    .eq("teacher_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!coordinatorRow) {
    redirect("/teacher-dashboard");
  }

  return children;
}
