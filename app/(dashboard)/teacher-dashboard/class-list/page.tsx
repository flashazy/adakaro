import { redirect } from "next/navigation";

/** Legacy path — Class List lives at /teacher-dashboard/attendance */
export default async function ClassListRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const sp = await searchParams;
  const classId = sp.classId?.trim();
  const qs = classId ? `?classId=${encodeURIComponent(classId)}` : "";
  redirect(`/teacher-dashboard/attendance${qs}`);
}
