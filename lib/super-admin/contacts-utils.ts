import type { SuperAdminContactRow } from "@/lib/super-admin/contacts-types";
import {
  type ContactHasFilter,
  type ContactPlanFilter,
  type ContactStatusFilter,
  type ContactTypeFilter,
  type SuperAdminContactCoverage,
  type SuperAdminContactFilters,
  type SuperAdminContactInsights,
  type SuperAdminContactStats,
  type SuperAdminSchoolOption,
} from "@/lib/super-admin/contacts-types";
import { isPaidPlanId } from "@/lib/plans";
import {
  normalizeEmail,
  normalizeTzPhoneDigits,
} from "@/lib/super-admin/contacts-phone";
import {
  normalizeSchoolLifecycleStatus,
  type SchoolLifecycleStatus,
} from "@/lib/super-admin/school-lifecycle";

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function contactTypeLabel(
  row: Pick<SuperAdminContactRow, "contactType" | "assignedClass">
): string {
  if (row.contactType === "teacher" && row.assignedClass) {
    return "Class Teacher";
  }
  switch (row.contactType) {
    case "admin":
      return "Admin";
    case "teacher":
      return "Teacher";
    case "parent":
      return "Parent";
  }
}

/** Secondary line under contact name (role-specific context). */
export function contactRoleContext(row: SuperAdminContactRow): string | null {
  if (row.contactType === "teacher" && row.assignedClass) {
    return row.assignedClass;
  }
  if (row.contactType === "parent" && row.linkedStudents) {
    return `Student: ${row.linkedStudents}`;
  }
  if (row.contactType === "admin") {
    return "School administrator";
  }
  return contactTypeLabel(row);
}

/** Muted tertiary details for a contact row. */
export function contactMutedDetails(_row: SuperAdminContactRow): string | null {
  return null;
}

export function contactSchoolStatusBadgeClass(
  status: SchoolLifecycleStatus
): string {
  switch (normalizeSchoolLifecycleStatus(status)) {
    case "active":
      return "bg-emerald-100 text-emerald-900 ring-emerald-300/80";
    case "setup":
      return "bg-amber-100 text-amber-900 ring-amber-300/80";
    case "inactive":
      return "bg-slate-200 text-slate-700 ring-slate-300/80";
    case "archived":
      return "bg-red-100 text-red-800 ring-red-300/80";
  }
}

export function schoolInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function schoolHealthStatus(score: number): {
  label: "Healthy" | "Attention Needed" | "Critical";
  barClassName: string;
  textClassName: string;
  badgeClassName: string;
} {
  if (score >= 80) {
    return {
      label: "Healthy",
      barClassName: "bg-emerald-500",
      textClassName: "text-emerald-700",
      badgeClassName: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    };
  }
  if (score >= 50) {
    return {
      label: "Attention Needed",
      barClassName: "bg-amber-500",
      textClassName: "text-amber-700",
      badgeClassName: "bg-amber-50 text-amber-800 ring-amber-200",
    };
  }
  return {
    label: "Critical",
    barClassName: "bg-red-500",
    textClassName: "text-red-700",
    badgeClassName: "bg-red-50 text-red-800 ring-red-200",
  };
}

const SOURCE_DISPLAY: Record<
  string,
  { icon: string; label: string }
> = {
  "parent account": { icon: "👨‍👩‍👧", label: "Parent Account" },
  "guardian on file": { icon: "📝", label: "Guardian Record" },
  "school admin": { icon: "🏫", label: "School Admin" },
  "class teacher": { icon: "👩‍🏫", label: "Class Teacher" },
  teacher: { icon: "👩‍🏫", label: "Teacher Account" },
};

export function contactSourceDisplay(sourceLabel: string): {
  icon: string;
  label: string;
} {
  const key = sourceLabel.trim().toLowerCase();
  const mapped = SOURCE_DISPLAY[key];
  if (mapped) return mapped;
  return { icon: "📇", label: sourceLabel };
}

export function coverageScopeLabel(type: ContactTypeFilter): string {
  switch (type) {
    case "admin":
      return "admins";
    case "teacher":
      return "teachers";
    case "parent":
      return "parents";
    default:
      return "contacts";
  }
}

export function contactRowCopyText(row: SuperAdminContactRow): string {
  return [
    row.name,
    contactTypeLabel(row),
    row.sourceLabel,
    row.schoolName,
    row.phone ?? "",
    row.email ?? "",
    row.schoolPlan,
    row.schoolStatus,
  ].join("\t");
}

export function computeContactStats(
  rows: SuperAdminContactRow[]
): SuperAdminContactStats {
  let admins = 0;
  let teachers = 0;
  let parents = 0;
  let withPhone = 0;
  let withEmail = 0;

  for (const row of rows) {
    if (row.contactType === "admin") admins += 1;
    if (row.contactType === "teacher") teachers += 1;
    if (row.contactType === "parent") parents += 1;
    if (row.phone) withPhone += 1;
    if (row.email) withEmail += 1;
  }

  return {
    total: rows.length,
    admins,
    teachers,
    parents,
    withPhone,
    withEmail,
  };
}

export function computeContactInsights(
  rows: SuperAdminContactRow[]
): SuperAdminContactInsights {
  const stats = computeContactStats(rows);
  const schoolIds = new Set<string>();
  const activeSchoolIds = new Set<string>();

  for (const row of rows) {
    schoolIds.add(row.schoolId);
    if (normalizeSchoolLifecycleStatus(row.schoolStatus) === "active") {
      activeSchoolIds.add(row.schoolId);
    }
  }

  const roleCounts = [
    { label: "Admin", count: stats.admins },
    { label: "Teacher", count: stats.teachers },
    { label: "Parent", count: stats.parents },
  ];
  const topRole = roleCounts.reduce((best, current) =>
    current.count > best.count ? current : best
  );

  return {
    schoolsRepresented: schoolIds.size,
    activeSchoolsRepresented: activeSchoolIds.size,
    missingPhone: stats.total - stats.withPhone,
    missingEmail: stats.total - stats.withEmail,
    duplicatesDetected: countDuplicateContacts(rows),
    mostCommonRole:
      stats.total === 0 || topRole.count === 0 ? "—" : topRole.label,
  };
}

export function computeContactCoverage(
  rows: SuperAdminContactRow[],
  typeFilter: ContactTypeFilter = "all"
): SuperAdminContactCoverage {
  const stats = computeContactStats(rows);

  if (stats.total === 0) {
    return {
      phonePercent: 0,
      emailPercent: 0,
      withPhone: 0,
      withEmail: 0,
      total: 0,
      scopeLabel: coverageScopeLabel(typeFilter),
    };
  }
  return {
    phonePercent: Math.round((stats.withPhone / stats.total) * 100),
    emailPercent: Math.round((stats.withEmail / stats.total) * 100),
    withPhone: stats.withPhone,
    withEmail: stats.withEmail,
    total: stats.total,
    scopeLabel: coverageScopeLabel(typeFilter),
  };
}

function countDuplicateContacts(rows: SuperAdminContactRow[]): number {
  const phoneHits = new Map<string, number>();
  const emailHits = new Map<string, number>();
  let duplicates = 0;

  for (const row of rows) {
    if (row.phone) {
      const key = normalizeTzPhoneDigits(row.phone);
      if (key) {
        const count = (phoneHits.get(key) ?? 0) + 1;
        phoneHits.set(key, count);
        if (count > 1) duplicates += 1;
      }
    }
    if (row.email) {
      const key = normalizeEmail(row.email);
      if (key) {
        const count = (emailHits.get(key) ?? 0) + 1;
        emailHits.set(key, count);
        if (count > 1) duplicates += 1;
      }
    }
  }

  return duplicates;
}

export function buildSchoolOptions(
  rows: SuperAdminContactRow[]
): SuperAdminSchoolOption[] {
  const map = new Map<string, SuperAdminSchoolOption>();
  for (const row of rows) {
    if (!map.has(row.schoolId)) {
      map.set(row.schoolId, {
        id: row.schoolId,
        name: row.schoolName,
        status: normalizeSchoolLifecycleStatus(row.schoolStatus),
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterSuperAdminContacts(
  rows: SuperAdminContactRow[],
  filters: SuperAdminContactFilters
): SuperAdminContactRow[] {
  const q = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    const status = normalizeSchoolLifecycleStatus(row.schoolStatus);

    if (!filters.includeEmpty && !row.phone && !row.email) {
      return false;
    }

    if (filters.schoolStatus === "archived") {
      if (status !== "archived") return false;
    } else if (filters.schoolStatus !== "all") {
      if (status !== filters.schoolStatus) return false;
    } else {
      if (status === "archived") return false;
    }

    if (filters.schoolId && row.schoolId !== filters.schoolId) {
      return false;
    }

    if (filters.type !== "all" && row.contactType !== filters.type) {
      return false;
    }

    if (filters.plan === "free" && isPaidPlanId(row.schoolPlan)) return false;
    if (filters.plan === "paid" && !isPaidPlanId(row.schoolPlan)) return false;

    if (filters.hasPhone === "yes" && !row.phone) return false;
    if (filters.hasPhone === "no" && row.phone) return false;
    if (filters.hasEmail === "yes" && !row.email) return false;
    if (filters.hasEmail === "no" && row.email) return false;

    if (q) {
      const phoneDigits = row.phone ? normalizeTzPhoneDigits(row.phone) : "";
      const haystack = [
        row.name,
        row.phone ?? "",
        phoneDigits,
        row.email ?? "",
        row.schoolName,
        row.linkedStudents ?? "",
        row.assignedClass ?? "",
        row.sourceLabel,
      ]
        .join(" ")
        .toLowerCase();
      const queryDigits = normalizeTzPhoneDigits(q);
      const matchesText = haystack.includes(q);
      const matchesPhone =
        queryDigits.length >= 6 &&
        phoneDigits.includes(queryDigits.replace(/^255/, ""));
      if (!matchesText && !matchesPhone) return false;
    }

    return true;
  });
}

export function buildContactsCsv(rows: SuperAdminContactRow[]): string {
  const header = [
    "Name",
    "Type",
    "Source",
    "School",
    "Phone",
    "Email",
    "Plan",
    "School Status",
    "Health Score",
    "Assigned Class",
    "Linked Students",
  ].join(",");

  const lines = rows.map((row) =>
    [
      csvEscape(row.name),
      csvEscape(contactTypeLabel(row)),
      csvEscape(row.sourceLabel),
      csvEscape(row.schoolName),
      csvEscape(row.phone ?? ""),
      csvEscape(row.email ?? ""),
      csvEscape(row.schoolPlan),
      csvEscape(row.schoolStatus),
      csvEscape(row.healthScore != null ? String(row.healthScore) : ""),
      csvEscape(row.assignedClass ?? ""),
      csvEscape(row.linkedStudents ?? ""),
    ].join(",")
  );

  return [header, ...lines].join("\n");
}

export function buildContactsExcelCsv(rows: SuperAdminContactRow[]): string {
  return `\uFEFF${buildContactsCsv(rows)}`;
}

export function parseContactFilters(searchParams: URLSearchParams): SuperAdminContactFilters {
  const type = searchParams.get("type") as ContactTypeFilter | null;
  const plan = searchParams.get("plan") as ContactPlanFilter | null;
  const schoolStatus = searchParams.get(
    "schoolStatus"
  ) as ContactStatusFilter | null;
  const hasPhone = searchParams.get("hasPhone") as ContactHasFilter | null;
  const hasEmail = searchParams.get("hasEmail") as ContactHasFilter | null;
  const schoolId = searchParams.get("schoolId")?.trim() || null;

  return {
    search: searchParams.get("search")?.trim() ?? "",
    type:
      type === "admin" || type === "teacher" || type === "parent" ? type : "all",
    plan: plan === "free" || plan === "paid" ? plan : "all",
    schoolStatus:
      schoolStatus === "setup" ||
      schoolStatus === "active" ||
      schoolStatus === "inactive" ||
      schoolStatus === "archived"
        ? schoolStatus
        : "all",
    schoolId,
    hasPhone: hasPhone === "yes" || hasPhone === "no" ? hasPhone : "all",
    hasEmail: hasEmail === "yes" || hasEmail === "no" ? hasEmail : "all",
    includeEmpty: searchParams.get("includeEmpty") === "1",
  };
}
