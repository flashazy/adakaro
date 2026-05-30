import type { GradebookMajorExamTypeValue } from "@/lib/gradebook-major-exams";

export const STREAMING_EXAM_LABELS: Record<GradebookMajorExamTypeValue, string> =
  {
    April_Midterm: "April Midterm",
    June_Terminal: "June Terminal",
    September_Midterm: "September Midterm",
    December_Annual: "December Annual",
  };

export function streamingExamLabel(
  examType: GradebookMajorExamTypeValue
): string {
  return STREAMING_EXAM_LABELS[examType];
}
