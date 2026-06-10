"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { ReadOnlySyllabusDetail } from "@/components/curriculum-coverage/read-only-syllabus-detail";
import { CurriculumProgressComparison } from "@/components/curriculum-coverage/curriculum-coverage-ui";
import type { CurriculumCoverageRow } from "@/lib/curriculum-coverage/types";
import type {
  SyllabusCoverageSummary,
  SyllabusTopicRow,
} from "@/lib/syllabus-coverage/types";
import { loadCurriculumCoverageDetailAction } from "@/app/(dashboard)/teacher-dashboard/academic/curriculum-coverage/actions";
import { cn } from "@/lib/utils";

export function CurriculumCoverageDetailDrawer({
  row,
  academicYear,
  onClose,
}: {
  row: CurriculumCoverageRow | null;
  academicYear: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [className, setClassName] = useState("");
  const [topics, setTopics] = useState<SyllabusTopicRow[]>([]);
  const [summary, setSummary] = useState<SyllabusCoverageSummary>({
    totalTopics: 0,
    totalSubtopics: 0,
    completedSubtopics: 0,
    coveragePercent: 0,
  });

  useEffect(() => {
    if (!row) return;
    void (async () => {
      setLoading(true);
      const res = await loadCurriculumCoverageDetailAction({
        classId: row.classId,
        subjectId: row.subjectId,
        teacherId: row.teacherId,
        academicYear,
      });
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setClassName(res.className);
      setTopics(res.topics);
      setSummary(res.summary);
    })();
  }, [row, academicYear]);

  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside
        className={cn(
          "relative flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950",
          "animate-in slide-in-from-right duration-200"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Curriculum coverage details"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Coverage details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading details…
            </div>
          ) : (
            <div className="space-y-4">
              <CurriculumProgressComparison
                actual={row.coveragePercent}
                expected={row.expectedProgressPercent}
                variance={row.progressVariance}
                compact
              />
              <ReadOnlySyllabusDetail
                className={className}
                subjectName={row.subjectName}
                teacherName={row.teacherName}
                academicYear={academicYear}
                topics={topics}
                summary={summary}
              />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
