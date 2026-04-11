/** Term values stored in DB / report_cards.term */
export const REPORT_TERM_OPTIONS = [
  {
    value: "Term 1",
    label: "Term 1 (January – March)",
  },
  {
    value: "Term 2",
    label: "Term 2 (April – August)",
  },
  {
    value: "Term 3",
    label: "Term 3 (September – November)",
  },
  {
    value: "Annual",
    label: "Annual (full year)",
  },
] as const;

export type ReportTermValue = (typeof REPORT_TERM_OPTIONS)[number]["value"];

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
