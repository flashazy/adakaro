import type { AttendanceRollupCounts } from "@/lib/attendance-counts";

export type DutyBookGenderFilter = "all" | "boys" | "girls";

export type DutyBookSchoolSummary = {
  date: string;
  registered: number;
  boys: number;
  girls: number;
} & AttendanceRollupCounts;

export type DutyBookClassRow = {
  classId: string;
  className: string;
  boys: number;
  girls: number;
  total: number;
  present: number | null;
  absent: number | null;
  ill: number | null;
  permitted: number | null;
  /** True when at least one student in this class has attendance saved for the date. */
  hasAttendance: boolean;
};

export type DutyBookViewSlice = {
  summary: DutyBookSchoolSummary;
  classes: DutyBookClassRow[];
};

export type DutyBookPayload = {
  schoolName: string;
  views: Record<DutyBookGenderFilter, DutyBookViewSlice>;
};
