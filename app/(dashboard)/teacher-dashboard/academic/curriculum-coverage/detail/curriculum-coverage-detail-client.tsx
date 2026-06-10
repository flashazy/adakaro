"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ReadOnlySyllabusDetail } from "@/components/curriculum-coverage/read-only-syllabus-detail";
import type {
  SyllabusCoverageSummary,
  SyllabusTopicRow,
} from "@/lib/syllabus-coverage/types";
import { loadCurriculumCoverageDetailAction } from "../actions";

export function CurriculumCoverageDetailClient({
  classId,
  subjectId,
  teacherId,
  academicYear,
  subjectName,
  teacherName,
}: {
  classId: string;
  subjectId: string | null;
  teacherId: string;
  academicYear: string;
  subjectName: string;
  teacherName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState("");
  const [topics, setTopics] = useState<SyllabusTopicRow[]>([]);
  const [summary, setSummary] = useState<SyllabusCoverageSummary>({
    totalTopics: 0,
    totalSubtopics: 0,
    completedSubtopics: 0,
    coveragePercent: 0,
  });
  const [resolvedYear, setResolvedYear] = useState(academicYear);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await loadCurriculumCoverageDetailAction({
        classId,
        subjectId,
        teacherId,
        academicYear: academicYear || undefined,
      });
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setClassName(res.className);
      setTopics(res.topics);
      setSummary(res.summary);
      setResolvedYear(res.academicYear);
    })();
  }, [classId, subjectId, teacherId, academicYear]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading coverage details…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/teacher-dashboard/academic/curriculum-coverage"
        className="inline-flex items-center gap-2 text-sm font-medium text-school-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Curriculum Coverage
      </Link>
      <ReadOnlySyllabusDetail
        className={className}
        subjectName={subjectName}
        teacherName={teacherName}
        academicYear={resolvedYear}
        topics={topics}
        summary={summary}
      />
    </div>
  );
}
