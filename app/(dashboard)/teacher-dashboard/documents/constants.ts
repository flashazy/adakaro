/** Max file size for teacher document uploads (must stay in sync with `next.config.ts` serverActions.bodySizeLimit). */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10MB

export const TEACHER_DOCUMENT_CATEGORY_KEYS = [
  "Certificates",
  "CV/Resume",
  "Lesson Plans",
  "Training",
  "Administrative",
  "Personal",
  "Other",
] as const;

export type TeacherDocumentCategory =
  (typeof TEACHER_DOCUMENT_CATEGORY_KEYS)[number];
