import type { SchoolLifecycleStatus } from "@/lib/super-admin/school-lifecycle";

export type SuperAdminContactType = "admin" | "teacher" | "parent";

export interface SuperAdminContactRow {
  id: string;
  contactType: SuperAdminContactType;
  name: string;
  email: string | null;
  phone: string | null;
  schoolId: string;
  schoolName: string;
  schoolPlan: string;
  schoolStatus: SchoolLifecycleStatus;
  healthScore: number | null;
  assignedClass: string | null;
  linkedStudents: string | null;
  /** Human-readable contact source for directory display. */
  sourceLabel: string;
  /** Populated by API response enrichment (not from contact loader). */
  schoolLogoUrl?: string | null;
}

export interface SuperAdminContactStats {
  total: number;
  admins: number;
  teachers: number;
  parents: number;
  withPhone: number;
  withEmail: number;
}

export interface SuperAdminContactInsights {
  schoolsRepresented: number;
  activeSchoolsRepresented: number;
  missingPhone: number;
  missingEmail: number;
  duplicatesDetected: number;
  mostCommonRole: string;
}

export interface SuperAdminContactCoverage {
  phonePercent: number;
  emailPercent: number;
  withPhone: number;
  withEmail: number;
  total: number;
  scopeLabel: string;
}

export interface SuperAdminSchoolOption {
  id: string;
  name: string;
  status: SchoolLifecycleStatus;
}

export interface SuperAdminContactsResponse {
  contacts: SuperAdminContactRow[];
  stats: SuperAdminContactStats;
  insights: SuperAdminContactInsights;
  coverage: SuperAdminContactCoverage;
  schoolOptions: SuperAdminSchoolOption[];
  lastUpdated: string;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** All phones/emails in the filtered set (for bulk copy). */
  filteredPhones: string[];
  filteredEmails: string[];
}

export type ContactTypeFilter = "all" | SuperAdminContactType;
export type ContactPlanFilter = "all" | "free" | "paid";
export type ContactStatusFilter =
  | "all"
  | "setup"
  | "active"
  | "inactive"
  | "archived";
export type ContactHasFilter = "all" | "yes" | "no";

export interface SuperAdminContactFilters {
  search: string;
  type: ContactTypeFilter;
  plan: ContactPlanFilter;
  schoolStatus: ContactStatusFilter;
  schoolId: string | null;
  hasPhone: ContactHasFilter;
  hasEmail: ContactHasFilter;
  includeEmpty: boolean;
}
