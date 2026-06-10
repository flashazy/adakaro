import { checkCurriculumCoverageAccessAction } from "./actions";
import { CurriculumCoverageClient } from "./curriculum-coverage-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Curriculum Coverage — Academic",
};

export default async function AcademicCurriculumCoveragePage() {
  const access = await checkCurriculumCoverageAccessAction();
  if (!access.ok) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/60 dark:bg-amber-950/40">
        <p className="text-sm text-slate-700 dark:text-zinc-300">
          {access.error}
        </p>
      </div>
    );
  }

  return <CurriculumCoverageClient />;
}
