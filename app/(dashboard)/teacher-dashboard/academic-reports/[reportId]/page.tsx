import { redirect } from "next/navigation";

export default async function LegacyAcademicReportDetailPage(props: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await props.params;
  redirect(`/teacher-dashboard/academic/reports/${reportId}`);
}
