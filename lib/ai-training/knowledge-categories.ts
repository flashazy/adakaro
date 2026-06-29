/**
 * Enterprise knowledge category taxonomy for AI Operations Center.
 * Single source of truth for Add/Edit Entry, filters, curriculum, and exports.
 */

export const KNOWLEDGE_CATEGORY_TAXONOMY = [
  "About Adakaro",
  "Getting Started",
  "AI Copilot",
  "Pricing",
  "Integrations",
  "Analytics & Reporting",
  "Notifications",
  "System Updates",
  "Admissions",
  "Student Management",
  "Classes & Streams",
  "Attendance",
  "Report Cards",
  "Promotions",
  "Student Streaming",
  "Curriculum & Syllabus",
  "Teachers & Staff",
  "Parent Portal",
  "Finance",
  "Communication",
  "School Administration",
  "Security & Roles",
  "User Accounts",
  "Permissions",
  "Troubleshooting",
  "Technical Support",
  "Frequently Asked Questions",
  "Best Practices",
  "General",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORY_TAXONOMY)[number];

/** @deprecated Use KNOWLEDGE_CATEGORY_TAXONOMY — kept for backward-compatible imports. */
export const KNOWLEDGE_CATEGORIES = KNOWLEDGE_CATEGORY_TAXONOMY;

export type KnowledgeCategoryGroupId =
  | "platform"
  | "student_lifecycle"
  | "staff"
  | "parents"
  | "finance"
  | "communication"
  | "administration"
  | "help_center"
  | "general";

export interface KnowledgeCategoryGroup {
  id: KnowledgeCategoryGroupId;
  label: string;
  categories: readonly KnowledgeCategory[];
}

/** Grouped taxonomy for clean dropdown presentation. */
export const KNOWLEDGE_CATEGORY_GROUPS: KnowledgeCategoryGroup[] = [
  {
    id: "platform",
    label: "Platform",
    categories: [
      "About Adakaro",
      "Getting Started",
      "AI Copilot",
      "Pricing",
      "Integrations",
      "Analytics & Reporting",
      "Notifications",
      "System Updates",
    ],
  },
  {
    id: "student_lifecycle",
    label: "Student Lifecycle",
    categories: [
      "Admissions",
      "Student Management",
      "Classes & Streams",
      "Attendance",
      "Report Cards",
      "Promotions",
      "Student Streaming",
      "Curriculum & Syllabus",
    ],
  },
  {
    id: "staff",
    label: "Staff",
    categories: ["Teachers & Staff"],
  },
  {
    id: "parents",
    label: "Parents",
    categories: ["Parent Portal"],
  },
  {
    id: "finance",
    label: "Finance",
    categories: ["Finance"],
  },
  {
    id: "communication",
    label: "Communication",
    categories: ["Communication"],
  },
  {
    id: "administration",
    label: "Administration",
    categories: [
      "School Administration",
      "Security & Roles",
      "User Accounts",
      "Permissions",
    ],
  },
  {
    id: "help_center",
    label: "Help Center",
    categories: [
      "Troubleshooting",
      "Technical Support",
      "Frequently Asked Questions",
      "Best Practices",
    ],
  },
  {
    id: "general",
    label: "General",
    categories: ["General"],
  },
];

/** Maps legacy category labels to the current taxonomy. Unmapped values pass through unchanged. */
export const KNOWLEDGE_CATEGORY_MIGRATION_MAP: Record<string, KnowledgeCategory | string> = {
  General: "General",
  Support: "Technical Support",
  Syllabus: "Curriculum & Syllabus",
  Onboarding: "Getting Started",
  FAQ: "Frequently Asked Questions",
  Copilot: "AI Copilot",
  "AI Copilot Help": "AI Copilot",
  "User Account": "User Accounts",
  Accounts: "User Accounts",
  Permissions: "Permissions",
  Admin: "School Administration",
  Administration: "School Administration",
  Updates: "System Updates",
  "Best Practice": "Best Practices",
};

const TAXONOMY_SET = new Set<string>(KNOWLEDGE_CATEGORY_TAXONOMY);

const CATEGORY_TO_GROUP = new Map<string, string>(
  KNOWLEDGE_CATEGORY_GROUPS.flatMap((group) =>
    group.categories.map((category) => [category, group.label])
  )
);

export const LAST_KNOWLEDGE_CATEGORY_STORAGE_KEY = "adakaro.knowledge.lastCategory";

export function isKnownKnowledgeCategory(category: string): category is KnowledgeCategory {
  return TAXONOMY_SET.has(category);
}

export function getCategoryGroupLabel(category: string): string {
  const migrated = migrateKnowledgeCategory(category);
  return CATEGORY_TO_GROUP.get(migrated) ?? "General";
}

/** Normalize legacy labels to the enterprise taxonomy without losing unknown values. */
export function migrateKnowledgeCategory(category: string | null | undefined): string {
  const trimmed = category?.trim();
  if (!trimmed) return "General";

  if (TAXONOMY_SET.has(trimmed)) return trimmed;

  const direct = KNOWLEDGE_CATEGORY_MIGRATION_MAP[trimmed];
  if (direct) return direct;

  const caseInsensitive = Object.entries(KNOWLEDGE_CATEGORY_MIGRATION_MAP).find(
    ([legacy]) => legacy.toLowerCase() === trimmed.toLowerCase()
  );
  if (caseInsensitive) return caseInsensitive[1];

  const taxonomyMatch = KNOWLEDGE_CATEGORY_TAXONOMY.find(
    (c) => c.toLowerCase() === trimmed.toLowerCase()
  );
  if (taxonomyMatch) return taxonomyMatch;

  return trimmed;
}

/** Alphabetically sorted canonical categories. */
export function getSortedKnowledgeCategories(): KnowledgeCategory[] {
  return [...KNOWLEDGE_CATEGORY_TAXONOMY].sort((a, b) => a.localeCompare(b));
}

export type GroupedCategoryListItem =
  | { type: "header"; id: string; label: string }
  | { type: "option"; value: string; groupLabel: string };

/** Build grouped list for combobox UI, optionally including legacy/extra categories. */
export function buildGroupedCategoryList(extraCategories: string[] = []): GroupedCategoryListItem[] {
  const extras = new Set<string>();
  for (const raw of extraCategories) {
    const normalized = migrateKnowledgeCategory(raw);
    if (normalized && !TAXONOMY_SET.has(normalized)) extras.add(normalized);
    else if (raw.trim() && !TAXONOMY_SET.has(raw.trim())) extras.add(raw.trim());
  }

  const items: GroupedCategoryListItem[] = [];

  for (const group of KNOWLEDGE_CATEGORY_GROUPS) {
    items.push({ type: "header", id: group.id, label: group.label });
    for (const category of group.categories) {
      items.push({ type: "option", value: category, groupLabel: group.label });
    }
  }

  if (extras.size > 0) {
    items.push({ type: "header", id: "legacy", label: "Legacy / Other" });
    for (const category of [...extras].sort((a, b) => a.localeCompare(b))) {
      items.push({ type: "option", value: category, groupLabel: "Legacy / Other" });
    }
  }

  return items;
}

/**
 * Categories for flat selects: canonical taxonomy plus any legacy values still in use.
 */
export function buildKnowledgeCategoryOptions(extraCategories: string[] = []): string[] {
  const merged = new Set<string>(getSortedKnowledgeCategories());
  for (const raw of extraCategories) {
    const normalized = migrateKnowledgeCategory(raw);
    if (normalized) merged.add(normalized);
    if (raw.trim() && !TAXONOMY_SET.has(raw.trim())) merged.add(raw.trim());
  }
  return [...merged].sort((a, b) => a.localeCompare(b));
}

export function filterGroupedCategoryList(
  items: GroupedCategoryListItem[],
  query: string,
  allowEmpty?: boolean,
  emptyLabel?: string
): GroupedCategoryListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    if (allowEmpty) {
      return [{ type: "option", value: "", groupLabel: "All" }, ...items];
    }
    return items;
  }

  const result: GroupedCategoryListItem[] = [];

  if (allowEmpty && emptyLabel && emptyLabel.toLowerCase().includes(q)) {
    result.push({ type: "option", value: "", groupLabel: "All" });
  }

  let index = 0;
  while (index < items.length) {
    const item = items[index];
    if (item.type !== "header") {
      index++;
      continue;
    }

    const header = item;
    const groupMatches = header.label.toLowerCase().includes(q);
    const matchedOptions: GroupedCategoryListItem[] = [];
    index++;

    while (index < items.length && items[index]?.type === "option") {
      const option = items[index] as Extract<GroupedCategoryListItem, { type: "option" }>;
      if (groupMatches || option.value.toLowerCase().includes(q)) {
        matchedOptions.push(option);
      }
      index++;
    }

    if (matchedOptions.length > 0) {
      result.push(header, ...matchedOptions);
    }
  }

  return result;
}

/** Selectable options only (for keyboard navigation). */
export function selectableOptionsFromGrouped(
  items: GroupedCategoryListItem[]
): Array<{ value: string; groupLabel: string }> {
  return items
    .filter((item): item is Extract<GroupedCategoryListItem, { type: "option" }> => item.type === "option")
    .map((item) => ({ value: item.value, groupLabel: item.groupLabel }));
}

export function getLastKnowledgeCategory(): KnowledgeCategory {
  if (typeof window === "undefined") return "General";
  try {
    const stored = window.localStorage.getItem(LAST_KNOWLEDGE_CATEGORY_STORAGE_KEY);
    if (stored) return migrateKnowledgeCategory(stored) as KnowledgeCategory;
  } catch {
    /* ignore storage errors */
  }
  return "General";
}

export function rememberLastKnowledgeCategory(category: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LAST_KNOWLEDGE_CATEGORY_STORAGE_KEY,
      migrateKnowledgeCategory(category)
    );
  } catch {
    /* ignore storage errors */
  }
}

export type KnowledgeCategoryIconKey =
  | "about"
  | "ai"
  | "start"
  | "pricing"
  | "students"
  | "admissions"
  | "classes"
  | "teachers"
  | "attendance"
  | "reports"
  | "finance"
  | "parents"
  | "communication"
  | "curriculum"
  | "promotions"
  | "streaming"
  | "security"
  | "analytics"
  | "integrations"
  | "notifications"
  | "accounts"
  | "permissions"
  | "administration"
  | "support"
  | "troubleshooting"
  | "practices"
  | "faq"
  | "updates"
  | "general";

const CATEGORY_ICON_KEYS: Record<string, KnowledgeCategoryIconKey> = {
  "About Adakaro": "about",
  "AI Copilot": "ai",
  "Getting Started": "start",
  Pricing: "pricing",
  "Student Management": "students",
  Admissions: "admissions",
  "Classes & Streams": "classes",
  "Teachers & Staff": "teachers",
  Attendance: "attendance",
  "Report Cards": "reports",
  Finance: "finance",
  "Parent Portal": "parents",
  Communication: "communication",
  "Curriculum & Syllabus": "curriculum",
  Promotions: "promotions",
  "Student Streaming": "streaming",
  "Security & Roles": "security",
  "Analytics & Reporting": "analytics",
  Integrations: "integrations",
  Notifications: "notifications",
  "User Accounts": "accounts",
  Permissions: "permissions",
  "School Administration": "administration",
  "Technical Support": "support",
  Troubleshooting: "troubleshooting",
  "Best Practices": "practices",
  "Frequently Asked Questions": "faq",
  "System Updates": "updates",
  General: "general",
};

export function getKnowledgeCategoryIconKey(category: string): KnowledgeCategoryIconKey {
  const migrated = migrateKnowledgeCategory(category);
  return CATEGORY_ICON_KEYS[migrated] ?? "general";
}
