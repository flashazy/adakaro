import type { SchoolHealthCategory } from "@/lib/super-admin/school-health";
import type { SchoolLifecycleStatus } from "@/lib/super-admin/school-lifecycle";

export interface SuperAdminSchoolRow {
  id: string;
  name: string;
  plan: string;
  currency: string;
  created_at: string;
  created_by: string;
  admin_count: number;
  student_count: number;
  teacher_count: number;
  payment_count: number;
  school_status: SchoolLifecycleStatus;
  last_activity_at: string | null;
  health_score: number;
  health_category: SchoolHealthCategory;
  health_label: string;
  can_delete_permanently: boolean;
}

export interface SuperAdminLifecycleStats {
  setupSchools: number;
  activeSchools: number;
  inactiveSchools: number;
  archivedSchools: number;
  healthExcellent: number;
  healthHealthy: number;
  healthAtRisk: number;
  healthInactive: number;
  newSetupSchoolsLast30Days: number;
  setupSchoolsOlderThan14Days: number;
  activeSchoolsThisMonth: number;
  schoolsAtRisk: number;
}

export interface SuperAdminStats {
  totalSchools: number;
  totalStudents: number;
  totalAdmins: number;
  totalPayments: number;
  lifecycle: SuperAdminLifecycleStats;
}

export type LoadSuperAdminDashboardResult =
  | { ok: true; stats: SuperAdminStats; schools: SuperAdminSchoolRow[] }
  | { ok: false; message: string };
