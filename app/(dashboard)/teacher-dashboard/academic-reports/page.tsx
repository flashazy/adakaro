import { ACADEMIC_REPORTS } from "@/lib/academic/academic-hub-paths";
import { redirect } from "next/navigation";

export default function LegacyAcademicReportsPage() {
  redirect(ACADEMIC_REPORTS);
}
