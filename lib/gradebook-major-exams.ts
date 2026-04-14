export const GRADEBOOK_MAJOR_EXAM_TYPE_VALUES = [
  "April_Midterm",
  "June_Terminal",
  "September_Midterm",
  "December_Annual",
] as const;

export type GradebookMajorExamTypeValue =
  (typeof GRADEBOOK_MAJOR_EXAM_TYPE_VALUES)[number];

const SET = new Set<string>(GRADEBOOK_MAJOR_EXAM_TYPE_VALUES);

export function parseGradebookExamType(
  raw: string | null | undefined
): GradebookMajorExamTypeValue | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (!SET.has(t)) return null;
  return t as GradebookMajorExamTypeValue;
}

/**
 * Infer major exam from free-form title (legacy rows with exam_type NULL).
 * Matches preset-style names like "June Terminal Examination".
 */
export function inferMajorExamTypeFromTitle(
  raw: string | null | undefined
): GradebookMajorExamTypeValue | null {
  const t = (raw ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("september") && t.includes("midterm")) {
    return "September_Midterm";
  }
  if (t.includes("december") && t.includes("annual")) {
    return "December_Annual";
  }
  if (t.includes("june") && t.includes("terminal")) {
    return "June_Terminal";
  }
  if (t.includes("april") && t.includes("midterm")) {
    return "April_Midterm";
  }
  return null;
}

/** Same rules as create form: explicit exam type wins, else title inference. */
export function resolvedMajorExamKindForDuplicateCheck(
  examTypeRaw: string | null | undefined,
  title: string | null | undefined
): GradebookMajorExamTypeValue | null {
  return (
    parseGradebookExamType(examTypeRaw) ??
    inferMajorExamTypeFromTitle(title)
  );
}

export function duplicateMajorExamMessage(
  examType: GradebookMajorExamTypeValue
): string {
  switch (examType) {
    case "April_Midterm":
      return "April Midterm already exists for this class and subject";
    case "June_Terminal":
      return "June Terminal already exists for this class and subject";
    case "September_Midterm":
      return "September Midterm already exists for this class and subject";
    case "December_Annual":
      return "December Annual already exists for this class and subject";
    default:
      return "This exam type already exists for this class and subject";
  }
}

/** True for duplicate major exam errors from create / server validation. */
export function isDuplicateMajorExamErrorMessage(
  message: string | null | undefined
): boolean {
  if (!message?.trim()) return false;
  return message.includes("already exists for this class and subject");
}

/** Values for `<select>`; empty string = None (custom / no major exam slot). */
export const GRADEBOOK_EXAM_TYPE_DROPDOWN_OPTIONS: {
  value: "" | GradebookMajorExamTypeValue;
  label: string;
}[] = [
  { value: "", label: "None (default - for custom assignments)" },
  { value: "April_Midterm", label: "April Midterm (Term 1)" },
  { value: "June_Terminal", label: "June Terminal (Term 1)" },
  { value: "September_Midterm", label: "September Midterm (Term 2)" },
  { value: "December_Annual", label: "December Annual (Term 2)" },
];
