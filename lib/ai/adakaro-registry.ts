/**
 * Adakaro Platform Knowledge Registry
 *
 * Single source of truth for every Adakaro module, dashboard card, route,
 * permission, and searchable keyword. Copilot intent routing, navigation
 * help, and self-learning draft suggestions all derive from this registry.
 */

import type { CopilotRole } from "@/lib/ai/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdakaroModuleId =
  | "dashboard"
  | "school_settings"
  | "classes"
  | "subjects"
  | "teachers"
  | "students"
  | "team"
  | "finance"
  | "parent_access"
  | "enrollment_desk"
  | "assignments"
  | "syllabus_coverage"
  | "report_cards"
  | "promotions"
  | "attendance"
  | "reports"
  | "analytics"
  | "communications"
  | "ai_training"
  | "schools";

export type CopilotIntentType =
  | "navigation"
  | "explanation"
  | "data_lookup"
  | "report_request"
  | "analysis"
  | "comparison"
  | "action_request";

export interface RegistryCard {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  /** Executor tool id — when set, Copilot can fetch live data for this card. */
  dataTool?: string;
  /** Card explains a metric only (no live data tool yet). */
  explanationOnly?: boolean;
}

export interface AdakaroRegistryEntry {
  id: AdakaroModuleId;
  name: string;
  description: string;
  route: string;
  dashboardPage: string;
  /** Roles that may access this module (navigation + data). */
  permissions: CopilotRole[];
  relatedModules: AdakaroModuleId[];
  keywords: string[];
  navigationTool: string;
  cards: RegistryCard[];
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const ADAKARO_REGISTRY: AdakaroRegistryEntry[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    description:
      "Your school command center — overview KPIs for students, finance, attendance, and academic progress at a glance.",
    route: "/dashboard",
    dashboardPage: "Dashboard",
    permissions: ["admin", "super_admin", "finance", "coordinator", "teacher"],
    relatedModules: ["finance", "students", "attendance", "analytics"],
    keywords: ["dashboard", "home", "overview", "school overview", "main page"],
    navigationTool: "nav:dashboard",
    cards: [
      {
        id: "school_performance",
        label: "School Performance",
        description: "High-level summary of how the school is performing across finance, attendance, and academics.",
        keywords: ["school performance", "how is the school doing", "school summary", "summarize school"],
        dataTool: "school_performance_summary",
      },
    ],
  },
  {
    id: "school_settings",
    name: "School Settings",
    description:
      "Manage your school profile, logo, currency, academic year, term dates, timezone, and other preferences.",
    route: "/dashboard/school-settings",
    dashboardPage: "School Settings",
    permissions: ["admin", "super_admin"],
    relatedModules: ["team", "dashboard"],
    keywords: [
      "school settings",
      "school profile",
      "school logo",
      "academic year",
      "currency",
      "preferences",
      "settings",
      "term dates",
      "timezone",
    ],
    navigationTool: "nav:settings",
    cards: [],
  },
  {
    id: "classes",
    name: "Manage Classes",
    description:
      "Create and manage your school's classes and streams, assign students, and set up class teachers.",
    route: "/dashboard/classes",
    dashboardPage: "Classes",
    permissions: ["admin", "super_admin", "coordinator"],
    relatedModules: ["students", "subjects", "assignments"],
    keywords: ["manage classes", "classes", "streams", "class setup", "create class"],
    navigationTool: "nav:classes",
    cards: [
      {
        id: "active_classes",
        label: "Active Classes",
        description: "Number of active classes configured in your school.",
        keywords: ["active classes", "how many classes", "total classes", "class count", "number of classes"],
        dataTool: "class_count",
      },
    ],
  },
  {
    id: "subjects",
    name: "Manage Subjects",
    description:
      "Create and manage the subjects offered by your school. Assign subjects to classes and keep your academic setup organized.",
    route: "/dashboard/subjects",
    dashboardPage: "Subjects",
    permissions: ["admin", "super_admin", "coordinator"],
    relatedModules: ["classes", "assignments", "syllabus_coverage"],
    keywords: ["manage subjects", "school subjects", "subjects", "subject list", "add subject"],
    navigationTool: "nav:subjects",
    cards: [],
  },
  {
    id: "teachers",
    name: "Teachers",
    description:
      "Create and manage teacher accounts, assign them to classes and subjects, and control their dashboard access.",
    route: "/dashboard/teachers",
    dashboardPage: "Teachers",
    permissions: ["admin", "super_admin"],
    relatedModules: ["assignments", "team", "classes"],
    keywords: ["manage teachers", "teacher accounts", "teachers", "teaching staff", "add teacher"],
    navigationTool: "nav:teachers",
    cards: [],
  },
  {
    id: "students",
    name: "Manage Students",
    description:
      "Manage student admissions, enrollment, profiles, subjects, attendance, and academic records.",
    route: "/dashboard/students",
    dashboardPage: "Students",
    permissions: ["admin", "super_admin", "coordinator"],
    relatedModules: ["enrollment_desk", "attendance", "report_cards", "classes"],
    keywords: [
      "manage students",
      "student records",
      "student profiles",
      "student list",
      "add student",
      "enroll student",
    ],
    navigationTool: "nav:students",
    cards: [
      {
        id: "total_students",
        label: "Total Students",
        description: "Total approved students enrolled in your school.",
        keywords: [
          "total students",
          "how many students",
          "student count",
          "number of students",
          "students enrolled",
          "enrollment count",
        ],
        dataTool: "student_count",
      },
      {
        id: "new_admissions",
        label: "New Admissions",
        description: "Students admitted or enrolled this month.",
        keywords: [
          "new admissions",
          "new students",
          "newly enrolled",
          "admissions this month",
          "students joined",
          "joined this month",
        ],
        dataTool: "admissions_summary",
      },
    ],
  },
  {
    id: "team",
    name: "Team",
    description:
      "Manage school administrators and staff accounts. Control who has access to your school's Adakaro workspace.",
    route: "/dashboard/team",
    dashboardPage: "Team",
    permissions: ["admin", "super_admin"],
    relatedModules: ["school_settings", "teachers"],
    keywords: ["team", "administrators", "school administrators", "staff access", "admins", "school staff"],
    navigationTool: "nav:team",
    cards: [],
  },
  {
    id: "finance",
    name: "Finance",
    description:
      "Manage school fees, record payments, track collections, view outstanding balances, and generate finance reports.",
    route: "/dashboard/payments",
    dashboardPage: "Finance",
    permissions: ["admin", "super_admin", "finance"],
    relatedModules: ["reports", "students", "dashboard"],
    keywords: ["finance", "fees", "payments", "fee management", "school finance"],
    navigationTool: "nav:finance",
    cards: [
      {
        id: "monthly_income",
        label: "Monthly Income",
        description: "Total fee payments recorded during the current calendar month.",
        keywords: [
          "monthly income",
          "income this month",
          "monthly",
          "payment totals per month",
          "payment trends",
          "revenue this month",
          "revenue",
          "money collected this month",
        ],
        dataTool: "monthly_income",
      },
      {
        id: "fees_collected",
        label: "Fees Collected",
        description: "Total fees collected and the overall collection rate for your school.",
        keywords: [
          "fees collected",
          "collection rate",
          "collection performance",
          "how much have we collected",
          "how much collected",
          "total collected",
          "collections",
          "payment summary",
        ],
        dataTool: "collection_performance",
      },
      {
        id: "outstanding",
        label: "Outstanding",
        description: "Total unpaid fee balances across all students.",
        keywords: [
          "outstanding balance",
          "outstanding balances",
          "outstanding",
          "fee balance",
          "fee balances",
          "unpaid fees",
          "unpaid",
          "who has not paid",
          "students who owe",
          "debtors",
          "owe fees",
        ],
        dataTool: "fee_balances_summary",
      },
      {
        id: "payment_trends",
        label: "Payment Trends",
        description: "How fee collections compare month over month.",
        keywords: ["payment trends", "income trend", "collection trend"],
        explanationOnly: true,
      },
    ],
  },
  {
    id: "parent_access",
    name: "Parent Access",
    description:
      "Parent Access helps schools manage parent link requests, approved parent accounts, and parent communication access.",
    route: "/dashboard/parent-links/pending",
    dashboardPage: "Parent Access",
    permissions: ["admin", "super_admin"],
    relatedModules: ["students", "communications"],
    keywords: [
      "parent access",
      "parent links",
      "parent requests",
      "parent accounts",
      "link parent",
      "parent portal",
    ],
    navigationTool: "nav:parent_access",
    cards: [],
  },
  {
    id: "enrollment_desk",
    name: "Enrollment Desk",
    description:
      "Manage admission desk users and student intake workflows — pending approvals and capture-card enrollment.",
    route: "/dashboard/pending-approvals",
    dashboardPage: "Enrollment Desk",
    permissions: ["admin", "super_admin"],
    relatedModules: ["students"],
    keywords: [
      "enrollment desk",
      "admission desk",
      "pending approvals",
      "capture card",
      "student intake",
      "desk users",
    ],
    navigationTool: "nav:enrollment_desk",
    cards: [],
  },
  {
    id: "assignments",
    name: "Assignments",
    description:
      "Create and manage teacher class assignments — which teachers teach which subjects in which classes.",
    route: "/dashboard/assignments",
    dashboardPage: "Assignments",
    permissions: ["admin", "super_admin"],
    relatedModules: ["teachers", "subjects", "classes"],
    keywords: ["assignments", "teacher assignments", "class assignments", "subject assignments"],
    navigationTool: "nav:assignments",
    cards: [],
  },
  {
    id: "syllabus_coverage",
    name: "Syllabus Coverage",
    description:
      "Track teaching progress across classes and subjects. See which topics are completed and which classes are behind.",
    route: "/dashboard/syllabus-coverage",
    dashboardPage: "Syllabus Coverage",
    permissions: ["admin", "super_admin", "coordinator", "teacher"],
    relatedModules: ["subjects", "classes", "report_cards"],
    keywords: [
      "syllabus coverage",
      "syllabus",
      "curriculum progress",
      "curriculum",
      "topics completed",
      "subtopics",
      "classes behind syllabus",
      "behind syllabus",
      "teaching progress",
    ],
    navigationTool: "nav:syllabus",
    cards: [
      {
        id: "coverage_pct",
        label: "Syllabus Coverage",
        description: "Overall syllabus completion percentage across tracked classes.",
        keywords: ["coverage", "syllabus completion", "completion rate", "topics"],
        dataTool: "syllabus_coverage_summary",
      },
    ],
  },
  {
    id: "report_cards",
    name: "Report Cards",
    description:
      "Create, review, and publish student report cards. Track completion status across classes and terms.",
    route: "/dashboard/reports",
    dashboardPage: "Report Cards",
    permissions: ["admin", "super_admin", "coordinator"],
    relatedModules: ["students", "syllabus_coverage", "promotions"],
    keywords: ["report card", "report cards", "report card completion", "exam results", "grades"],
    navigationTool: "nav:report_cards",
    cards: [
      {
        id: "report_completion",
        label: "Report Completion",
        description: "Percentage of report cards completed for the current term.",
        keywords: ["report card completion", "report completion", "incomplete report cards"],
        dataTool: "report_card_completion",
      },
    ],
  },
  {
    id: "promotions",
    name: "Promotions",
    description:
      "Manage year-end student promotions — move students to the next class or graduate them at the end of the academic year.",
    route: "/dashboard/promotions",
    dashboardPage: "Promotions",
    permissions: ["admin", "super_admin"],
    relatedModules: ["students", "classes", "report_cards"],
    keywords: ["promotions", "year-end promotions", "promote students", "graduate students", "class progression"],
    navigationTool: "nav:promotions",
    cards: [],
  },
  {
    id: "attendance",
    name: "Attendance",
    description:
      "Record and review student attendance. See today's present/absent counts, attendance rates, and absent student lists.",
    route: "/dashboard/attendance",
    dashboardPage: "Attendance",
    permissions: ["admin", "super_admin", "coordinator", "teacher"],
    relatedModules: ["students", "reports"],
    keywords: ["attendance", "present", "absent", "late", "mark attendance"],
    navigationTool: "nav:attendance",
    cards: [
      {
        id: "attendance_today",
        label: "Attendance Today",
        description: "Present, absent, and late counts for today.",
        keywords: [
          "attendance today",
          "present today",
          "absent today",
          "who is absent today",
          "today's attendance",
          "late today",
        ],
        dataTool: "attendance_today",
      },
      {
        id: "attendance_rate",
        label: "Attendance Rate",
        description: "Overall attendance rate across recent records.",
        keywords: [
          "attendance rate",
          "attendance summary",
          "low attendance",
          "who has low attendance",
        ],
        dataTool: "attendance_overview",
      },
    ],
  },
  {
    id: "reports",
    name: "Reports",
    description:
      "Generate and export finance, attendance, and academic reports for your school leadership team.",
    route: "/dashboard/reports",
    dashboardPage: "Reports",
    permissions: ["admin", "super_admin", "finance", "coordinator"],
    relatedModules: ["finance", "attendance", "report_cards"],
    keywords: ["reports", "export report", "report center", "generate report"],
    navigationTool: "nav:reports",
    cards: [
      {
        id: "finance_report",
        label: "Finance Report",
        description: "Summary finance report for school leadership.",
        keywords: ["finance report", "financial report", "finance summary", "generate finance report"],
        dataTool: "finance_report",
      },
      {
        id: "attendance_report",
        label: "Attendance Report",
        description: "Attendance summary report for export.",
        keywords: ["attendance report", "generate attendance report"],
        dataTool: "attendance_report",
      },
      {
        id: "academic_report",
        label: "Academic Report",
        description: "Academic performance and exam results report.",
        keywords: ["academic report", "exam results", "exam performance", "performance report"],
        dataTool: "academic_report",
      },
    ],
  },
  {
    id: "analytics",
    name: "Analytics",
    description:
      "School analytics and performance insights — trends across finance, attendance, and academic data.",
    route: "/dashboard",
    dashboardPage: "Analytics",
    permissions: ["admin", "super_admin"],
    relatedModules: ["dashboard", "finance", "attendance"],
    keywords: ["analytics", "insights", "trends", "performance analytics", "school analytics"],
    navigationTool: "nav:analytics",
    cards: [],
  },
  {
    id: "communications",
    name: "Communications",
    description:
      "School broadcasts and messaging — send announcements to parents, teachers, and staff.",
    route: "/dashboard/messages",
    dashboardPage: "Communications",
    permissions: ["admin", "super_admin"],
    relatedModules: ["parent_access", "team"],
    keywords: ["communications", "messages", "broadcasts", "announcements", "notify parents"],
    navigationTool: "nav:communications",
    cards: [],
  },
  {
    id: "ai_training",
    name: "AI Training",
    description:
      "AI Operations Dashboard for super admins — manage Copilot knowledge, rollout, and training data.",
    route: "/super-admin/ai-training",
    dashboardPage: "AI Operations",
    permissions: ["super_admin"],
    relatedModules: ["schools"],
    keywords: ["ai training", "ai operations", "copilot training", "knowledge entries"],
    navigationTool: "nav:ai_training",
    cards: [],
  },
  {
    id: "schools",
    name: "Schools",
    description:
      "Super Admin schools directory — manage all schools on the Adakaro platform, plans, and lifecycle.",
    route: "/super-admin",
    dashboardPage: "Schools",
    permissions: ["super_admin"],
    relatedModules: ["ai_training"],
    keywords: ["schools", "all schools", "school list", "platform schools"],
    navigationTool: "nav:schools",
    cards: [],
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

function containsPhrase(paddedLower: string, needle: string): boolean {
  const n = needle.toLowerCase().trim();
  if (!n) return false;
  const idx = paddedLower.indexOf(n);
  if (idx === -1) return false;
  const before = paddedLower[idx - 1] ?? " ";
  const after = paddedLower[idx + n.length] ?? " ";
  const isBoundary = (ch: string) => !/[a-z0-9]/i.test(ch);
  return isBoundary(before) && isBoundary(after);
}

function scorePhrase(paddedLower: string, phrase: string): number {
  return containsPhrase(paddedLower, phrase) ? phrase.trim().length : 0;
}

export function findRegistryModule(text: string): AdakaroRegistryEntry | null {
  const lower = ` ${text.toLowerCase().trim()} `;
  let best: AdakaroRegistryEntry | null = null;
  let bestScore = 0;

  for (const mod of ADAKARO_REGISTRY) {
    for (const kw of mod.keywords) {
      const score = scorePhrase(lower, kw);
      if (score > bestScore) {
        best = mod;
        bestScore = score;
      }
    }
    const nameScore = scorePhrase(lower, mod.name);
    if (nameScore > bestScore) {
      best = mod;
      bestScore = nameScore;
    }
  }

  return best;
}

export interface RegistryCardMatch {
  module: AdakaroRegistryEntry;
  card: RegistryCard;
  score: number;
}

export function findRegistryCard(text: string): RegistryCardMatch | null {
  const lower = ` ${text.toLowerCase().trim()} `;
  let best: RegistryCardMatch | null = null;

  for (const mod of ADAKARO_REGISTRY) {
    for (const card of mod.cards) {
      for (const kw of card.keywords) {
        const score = scorePhrase(lower, kw);
        if (!best || score > best.score) {
          if (score > 0) best = { module: mod, card, score };
        }
      }
      const labelScore = scorePhrase(lower, card.label);
      if (labelScore > 0 && (!best || labelScore > best.score)) {
        best = { module: mod, card, score: labelScore };
      }
    }
  }

  return best;
}

/** All registry matches above a minimum score (for disambiguation). */
export function findAmbiguousRegistryMatches(
  text: string,
  minScore = 4
): RegistryCardMatch[] {
  const lower = ` ${text.toLowerCase().trim()} `;
  const matches: RegistryCardMatch[] = [];

  for (const mod of ADAKARO_REGISTRY) {
    for (const card of mod.cards) {
      let score = 0;
      for (const kw of card.keywords) {
        score = Math.max(score, scorePhrase(lower, kw));
      }
      score = Math.max(score, scorePhrase(lower, card.label));
      if (score >= minScore) {
        matches.push({ module: mod, card, score });
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

export function getRegistryModule(id: AdakaroModuleId): AdakaroRegistryEntry | undefined {
  return ADAKARO_REGISTRY.find((m) => m.id === id);
}

export function roleCanAccessModule(role: CopilotRole, module: AdakaroRegistryEntry): boolean {
  if (role === "super_admin") return true;
  return module.permissions.includes(role);
}

export function roleCanAccessDataTool(role: CopilotRole, tool: string): boolean {
  for (const mod of ADAKARO_REGISTRY) {
    const card = mod.cards.find((c) => c.dataTool === tool);
    if (card) return roleCanAccessModule(role, mod);
  }
  return true;
}
