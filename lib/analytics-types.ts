export type AnalyticsPreset =
  | "last30d"
  | "last3m"
  | "last6m"
  | "last12m"
  | "custom";

export interface MonthlyTrendRow {
  monthKey: string;
  monthLabel: string;
  newSchools: number;
  newStudents: number;
  revenue: number;
}

export interface TopSchoolRow {
  schoolId: string;
  name: string;
  studentCount: number;
  totalRevenue: number;
}

export interface RevenueBySchoolRow {
  schoolId: string;
  name: string;
  revenue: number;
}

export interface StudentDistributionSlice {
  name: string;
  value: number;
}

export interface CumulativeSchoolPoint {
  label: string;
  cumulative: number;
}

export interface GrowthPercent {
  schools: number | null;
  students: number | null;
  revenue: number | null;
}

export interface SuperAdminAnalyticsPayload {
  meta: {
    preset: AnalyticsPreset | string;
    fromIso: string;
    toIso: string;
    bucketGranularity: "day" | "month";
  };
  summary: {
    totalSchools: number;
    totalStudents: number;
    totalRevenue: number;
    activeSchools: number;
    suspendedSchools: number;
    totalSchoolsPlatform: number;
    totalStudentsPlatform: number;
    growthPercent: GrowthPercent;
  };
  monthlyTrends: MonthlyTrendRow[];
  topSchoolsByStudents: TopSchoolRow[];
  topSchoolsByRevenue: TopSchoolRow[];
  revenueBySchoolTop10: RevenueBySchoolRow[];
  studentDistributionPie: StudentDistributionSlice[];
  cumulativeSchoolGrowth: CumulativeSchoolPoint[];
}

export type LoadSuperAdminAnalyticsResult =
  | { ok: true; data: SuperAdminAnalyticsPayload }
  | { ok: false; message: string };

export interface ActivityHighlightRow {
  created_at: string;
  action: string;
  user_email: string;
  school_id: string | null;
  action_details: unknown;
}
