import type {
  FullGradeReportMeta,
  PassRateStats,
  FailRateStats,
  RankingRow,
} from "@/lib/gradebook-full-report-compute";
import type { SchoolLevel } from "@/lib/school-level";

export type ParentMajorExamClassResultOption = {
  id: string;
  label: string;
  meta: FullGradeReportMeta;
  assignment: { id: string; title: string; max_score: number };
  schoolLevel: SchoolLevel;
  passing: PassRateStats;
  failing: FailRateStats;
  dist: { A: number; B: number; C: number; D: number; E: number; F: number };
  ranking: RankingRow[];
  scoreRows: {
    name: string;
    genderLabel: string;
    scoreLabel: string;
    grade: string;
    remarks: string;
  }[];
};

export type ParentMajorExamClassResultsPayload = {
  options: ParentMajorExamClassResultOption[];
  defaultOptionId: string;
};
