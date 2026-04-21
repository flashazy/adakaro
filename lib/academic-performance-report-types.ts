import type { SchoolLevel } from "@/lib/school-level";

/** Stored in `academic_reports.report_data`. */
export interface AcademicPerformanceReportData {
  version: 1;
  school_level: SchoolLevel;
  class_name: string;
  term: string;
  academic_year: string;
  /** necta = Roman divisions + INC/ABS; primary_grades = A–E style */
  division_mode: "necta" | "primary_grades";
  overall_performance: {
    total_students: number;
    overall_pass_rate_pct: number | null;
    boys_pass_rate_pct: number | null;
    girls_pass_rate_pct: number | null;
    overall_fail_rate_pct: number | null;
    boys_fail_rate_pct: number | null;
    girls_fail_rate_pct: number | null;
  };
  division_distribution: {
    division: string;
    boys: number;
    girls: number;
    total: number;
  }[];
  subject_ranking: {
    rank: number;
    subject: string;
    pass_rate_pct: number | null;
    fail_rate_pct: number | null;
    top_grade: string | null;
  }[];
  teacher_performance: {
    rank: number;
    subject: string;
    teacher: string;
    pass_rate_pct: number | null;
    class_average_pct: number | null;
  }[];
}
