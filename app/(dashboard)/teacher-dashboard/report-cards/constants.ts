/** Term values stored in DB / report_cards.term (Tanzania calendar). */
export const REPORT_TERM_OPTIONS = [
  {
    value: "Term 1",
    label: "Term 1 (June Terminal Report)",
  },
  {
    value: "Term 2",
    label: "Term 2 (December Annual Report)",
  },
] as const;

export type ReportTermValue = (typeof REPORT_TERM_OPTIONS)[number]["value"];

/** Exam names shown per term (two scores; final = average). */
export const REPORT_CARD_EXAM_LABELS: Record<
  ReportTermValue,
  { exam1: string; exam2: string }
> = {
  "Term 1": { exam1: "April Midterm", exam2: "June Terminal" },
  "Term 2": { exam1: "September Midterm", exam2: "December Annual" },
};

/** Quick-insert comment templates for teachers */
export const COMMENT_TEMPLATES = [
  "Excellent performance, keep it up",
  "Good progress this term",
  "Satisfactory performance",
  "Needs improvement in [subject]",
  "Struggles with [topic]",
  "Shows great effort",
  "Late submission of assignments",
  "Participates well in class",
] as const;
