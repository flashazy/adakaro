import { ACADEMIC_STUDENT_PROFILES } from "@/lib/academic/academic-hub-paths";
import { redirect } from "next/navigation";

export default function AcademicHubIndexPage() {
  redirect(ACADEMIC_STUDENT_PROFILES);
}
