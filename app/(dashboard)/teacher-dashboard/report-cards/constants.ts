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

/**
 * Gradebook assignment titles (teacher presets) used to auto-fill report card
 * exam % fields from `teacher_scores` + `teacher_gradebook_assignments`.
 */
export const GRADEBOOK_EXAM_ASSIGNMENT_TITLES = {
  aprilMidterm: "April Midterm Examination",
  juneTerminal: "June Terminal Examination",
  septemberMidterm: "September Midterm Examination",
  decemberAnnual: "December Annual Examination",
} as const;

export const DEFAULT_REPORT_CARD_GRADEBOOK_EXAM_NAMES: readonly string[] = [
  GRADEBOOK_EXAM_ASSIGNMENT_TITLES.aprilMidterm,
  GRADEBOOK_EXAM_ASSIGNMENT_TITLES.juneTerminal,
  GRADEBOOK_EXAM_ASSIGNMENT_TITLES.septemberMidterm,
  GRADEBOOK_EXAM_ASSIGNMENT_TITLES.decemberAnnual,
];

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
  "Shows improvement in understanding the subject",
  "Needs to work on completing assignments on time",
  "Active participant in class discussions",
  "Requires extra support in this subject",
  "Good understanding of core concepts",
  "Needs to improve on exam technique",
  "Demonstrates consistent effort and dedication",
  "Would benefit from extra practice at home",
] as const;
