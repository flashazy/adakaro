import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportCardPreview } from "@/app/(dashboard)/teacher-dashboard/report-cards/components/ReportCardPreview";
import { buildParentReportCardPreviewData } from "../build-parent-report-card-preview";

export const metadata = {
  title: "Report card — Parent",
};

export default async function ParentReportCardPage({
  searchParams,
}: {
  searchParams: Promise<{
    studentId?: string;
    term?: string;
    year?: string;
  }>;
}) {
  const sp = await searchParams;
  const studentId = sp.studentId?.trim();
  const term = sp.term?.trim() ?? "Term 1";
  const academicYear = sp.year?.trim() ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!studentId || !academicYear) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Report card
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          Open the link from your email, or ask the school to send it again. A
          student, term, and academic year are required.
        </p>
      </div>
    );
  }

  const built = await buildParentReportCardPreviewData(supabase, {
    parentUserId: user.id,
    studentId,
    term,
    academicYear,
  });

  if (!built.ok) {
    if (built.error === "not_linked") {
      return (
        <p className="text-sm text-red-600">
          You do not have access to this student&apos;s report card.
        </p>
      );
    }
    if (built.error === "not_shared") {
      return (
        <p className="text-sm text-slate-600">
          This report card is not yet available for viewing. Please check back
          later.
        </p>
      );
    }
    return (
      <p className="text-sm text-slate-600">
        No report card found for this term and year.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
        Report card
      </h1>
      <ReportCardPreview
        data={built.data}
        viewer="parent"
        reportCardStatus={built.status}
      />
    </div>
  );
}
