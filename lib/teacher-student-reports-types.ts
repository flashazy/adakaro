/** Shared row shape for Student reports (Marks) table — safe for client imports. */
export type StudentMarksSummaryRow = {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_name: string;
  gender: "male" | "female" | null;
  marksAveragePercent: number | null;
  marksCount: number;
  approximateGrade: string | null;
};
