/**
 * Adakaro dashboard intent map — derived from the platform registry.
 *
 * Maps dashboard pages, KPI card names, module names, keywords, and natural
 * language phrases to Copilot intents. Each intent is either a `data` intent
 * (fetches real school data via a tool) or a `navigation` intent (explains a
 * page / card and offers a link).
 */

import {
  ADAKARO_REGISTRY,
  findAmbiguousRegistryMatches,
  findRegistryCard,
  findRegistryModule,
  type AdakaroModuleId,
} from "@/lib/ai/adakaro-registry";

export type DashboardModule =
  | "finance"
  | "students"
  | "attendance"
  | "academics"
  | "syllabus"
  | "subjects"
  | "classes"
  | "teachers"
  | "team"
  | "settings"
  | "reports"
  | "overview"
  | "parent_access"
  | "enrollment"
  | "assignments"
  | "promotions"
  | "communications"
  | "analytics"
  | "dashboard";

export type DashboardIntentKind = "data" | "navigation";

export interface DashboardTopic {
  id: string;
  module: DashboardModule;
  kind: DashboardIntentKind;
  tool: string;
  label: string;
  dashboardPage: string;
  href?: string;
  description?: string;
  cardNames: string[];
  keywords: string[];
  registryModuleId?: AdakaroModuleId;
}

/** Map registry module ids to dashboard module slugs used by the executor guard. */
function registryModuleToDashboardModule(id: AdakaroModuleId): DashboardModule {
  const map: Partial<Record<AdakaroModuleId, DashboardModule>> = {
    dashboard: "overview",
    school_settings: "settings",
    classes: "classes",
    subjects: "subjects",
    teachers: "teachers",
    students: "students",
    team: "team",
    finance: "finance",
    parent_access: "parent_access",
    enrollment_desk: "enrollment",
    assignments: "assignments",
    syllabus_coverage: "syllabus",
    report_cards: "academics",
    promotions: "promotions",
    attendance: "attendance",
    reports: "reports",
    analytics: "analytics",
    communications: "communications",
    ai_training: "dashboard",
    schools: "dashboard",
  };
  return map[id] ?? "overview";
}

function buildTopicsFromRegistry(): DashboardTopic[] {
  const topics: DashboardTopic[] = [];

  for (const mod of ADAKARO_REGISTRY) {
    const dashModule = registryModuleToDashboardModule(mod.id);

    topics.push({
      id: mod.id,
      module: dashModule,
      kind: "navigation",
      tool: mod.navigationTool,
      label: mod.name,
      dashboardPage: mod.dashboardPage,
      href: mod.route,
      description: mod.description,
      cardNames: [],
      keywords: mod.keywords,
      registryModuleId: mod.id,
    });

    for (const card of mod.cards) {
      if (!card.dataTool) continue;
      topics.push({
        id: card.id,
        module: dashModule,
        kind: "data",
        tool: card.dataTool,
        label: card.label,
        dashboardPage: mod.dashboardPage,
        href: mod.route,
        description: card.description,
        cardNames: [card.label],
        keywords: card.keywords,
        registryModuleId: mod.id,
      });
    }
  }

  // Legacy tool aliases used by composed reports.
  topics.push({
    id: "top_debtors",
    module: "finance",
    kind: "data",
    tool: "top_debtors",
    label: "Top Debtors",
    dashboardPage: "Finance",
    href: "/dashboard/payments",
    cardNames: ["Top Debtors"],
    keywords: ["top debtors", "highest balance", "sort by balance", "biggest debtors"],
  });

  topics.push({
    id: "absent_students",
    module: "attendance",
    kind: "data",
    tool: "absent_students",
    label: "Absent Students",
    dashboardPage: "Attendance",
    cardNames: ["Absent Students"],
    keywords: ["absent students", "who is absent", "absent list"],
  });

  topics.push({
    id: "management_report",
    module: "reports",
    kind: "data",
    tool: "management_report",
    label: "Management Report",
    dashboardPage: "Reports",
    href: "/dashboard/reports",
    cardNames: ["Management Report"],
    keywords: ["management report", "school operations report"],
  });

  return topics;
}

export const DASHBOARD_TOPICS: DashboardTopic[] = buildTopicsFromRegistry();

export function moduleForTool(tool: string): DashboardModule | null {
  const match = DASHBOARD_TOPICS.find((t) => t.tool === tool);
  if (match) return match.module;
  switch (tool) {
    case "top_debtors":
      return "finance";
    case "absent_students":
      return "attendance";
    case "management_report":
      return "reports";
    default:
      return null;
  }
}

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

export function findDashboardTopic(text: string): DashboardTopic | null {
  const lower = ` ${text.toLowerCase().trim()} `;
  let bestTopic: DashboardTopic | null = null;
  let bestScore = 0;

  const consider = (topic: DashboardTopic, phrase: string) => {
    const needle = phrase.toLowerCase().trim();
    if (!needle) return;
    if (!containsPhrase(lower, needle)) return;
    const score = needle.length;
    if (bestTopic === null || score > bestScore) {
      bestTopic = topic;
      bestScore = score;
    }
  };

  for (const topic of DASHBOARD_TOPICS) {
    for (const keyword of topic.keywords) consider(topic, keyword);
    for (const card of topic.cardNames) consider(topic, card);
  }

  return bestTopic;
}

const AMBIGUOUS_HINTS: Array<{ test: RegExp; topicId: string }> = [
  { test: /\bmonthly\b/, topicId: "monthly_income" },
  { test: /\bfees?\b/, topicId: "fees_collected" },
  { test: /\bbalance\b/, topicId: "outstanding" },
  { test: /\bclass\b/, topicId: "active_classes" },
  { test: /\bstudent\b/, topicId: "total_students" },
  { test: /\bteacher\b/, topicId: "teachers" },
  { test: /\bsubject\b/, topicId: "subjects" },
  { test: /\breport\b/, topicId: "reports" },
  { test: /\bteam\b/, topicId: "team" },
  { test: /\bparent\b/, topicId: "parent_access" },
];

export function findAmbiguousHint(text: string): DashboardTopic | null {
  const lower = text.toLowerCase();
  for (const hint of AMBIGUOUS_HINTS) {
    if (hint.test.test(lower)) {
      return DASHBOARD_TOPICS.find((t) => t.id === hint.topicId) ?? null;
    }
  }

  const registryMatches = findAmbiguousRegistryMatches(text, 3);
  if (registryMatches.length === 1) {
    const { card } = registryMatches[0]!;
    return DASHBOARD_TOPICS.find((t) => t.id === card.id) ?? null;
  }

  return null;
}

export function clarificationMessage(guess?: DashboardTopic | null): string {
  if (guess) {
    const ambiguous = findAmbiguousRegistryMatches(guess.label, 4);
    if (ambiguous.length > 1) {
      const options = ambiguous
        .slice(0, 3)
        .map((m) => `**${m.card.label}** (${m.module.dashboardPage})`)
        .join(" or ");
      return `Did you mean ${options}?`;
    }
    return `Did you mean **${guess.label}** from the ${guess.dashboardPage} dashboard?`;
  }

  return [
    "I can help with any part of Adakaro — students, finance, attendance, classes, subjects, teachers, parent access, reports, and more.",
    "",
    "Try asking naturally, for example: *Monthly income*, *How many students*, *Parent Access*, or *Attendance today*.",
  ].join("\n");
}

/** Re-export registry lookups for the query router. */
export { findRegistryCard, findRegistryModule, findAmbiguousRegistryMatches };
