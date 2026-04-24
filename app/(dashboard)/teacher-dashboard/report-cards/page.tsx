import { redirect } from "next/navigation";

/**
 * Class coordinators use the Coordinator dashboard to generate report cards.
 * This URL is kept for old bookmarks and revalidation targets.
 */
export default function TeacherReportCardsPage() {
  redirect("/teacher-dashboard/coordinator");
}
