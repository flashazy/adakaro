export interface IntentDefinition {
  key: string;
  name: string;
  group: string;
  relatedIntents: string[];
  /** Terms used for query matching when no entry exists yet. */
  matchTerms: string[];
}

export const INTENT_REGISTRY: IntentDefinition[] = [
  {
    key: "pricing.cost",
    name: "Adakaro Pricing",
    group: "Pricing",
    relatedIntents: ["pricing.free_plan", "pricing.starter_plan", "pricing.billing_start"],
    matchTerms: ["how much", "cost", "price", "pricing"],
  },
  {
    key: "pricing.free_plan",
    name: "Free Plan",
    group: "Pricing",
    relatedIntents: ["pricing.starter_plan", "pricing.billing_start", "demo.request"],
    matchTerms: ["free plan", "try before paying", "free trial", "try the system"],
  },
  {
    key: "pricing.billing_start",
    name: "When Billing Starts",
    group: "Pricing",
    relatedIntents: ["pricing.free_plan", "pricing.cost", "pricing.monthly_features"],
    matchTerms: ["when do i start paying", "start paying", "billing start"],
  },
  {
    key: "pricing.starter_plan",
    name: "Starter Plan",
    group: "Pricing",
    relatedIntents: ["pricing.free_plan", "pricing.cost"],
    matchTerms: ["starter plan", "starter package", "starter tier"],
  },
  {
    key: "pricing.monthly_features",
    name: "Monthly Billing Features",
    group: "Pricing",
    relatedIntents: ["pricing.cost", "pricing.billing_start"],
    matchTerms: ["monthly billing", "lose features", "pay monthly"],
  },
  {
    key: "student.bulk_import",
    name: "Bulk Student Import",
    group: "Student Management",
    relatedIntents: [
      "student.excel_upload",
      "student.csv_template",
      "student.admissions",
      "student.migration",
    ],
    matchTerms: [
      "bulk import",
      "import students",
      "another system",
      "bring learners",
      "migrate students",
    ],
  },
  {
    key: "student.excel_upload",
    name: "Excel Upload",
    group: "Student Management",
    relatedIntents: ["student.bulk_import", "student.csv_template"],
    matchTerms: ["upload excel", "excel file", "spreadsheet"],
  },
  {
    key: "student.csv_template",
    name: "CSV Template",
    group: "Student Management",
    relatedIntents: ["student.bulk_import", "student.excel_upload"],
    matchTerms: ["csv template", "download template"],
  },
  {
    key: "student.class_transfer",
    name: "Class Transfer",
    group: "Student Management",
    relatedIntents: [
      "student.class_history",
      "student.archive_inactive",
    ],
    matchTerms: [
      "transfer students",
      "change class",
      "another stream",
      "move pupil",
      "change pupil",
    ],
  },
  {
    key: "student.class_history",
    name: "Class History",
    group: "Student Management",
    relatedIntents: ["student.class_transfer"],
    matchTerms: ["class history", "movement history", "stream history"],
  },
  {
    key: "student.archive_inactive",
    name: "Archive / Deactivate Students",
    group: "Student Management",
    relatedIntents: ["student.profile_information"],
    matchTerms: [
      "archive student",
      "deactivate student",
      "hide student",
      "keep history",
      "remove learner",
      "active lists",
    ],
  },
  {
    key: "student.profile_information",
    name: "Student Profile Information",
    group: "Student Management",
    relatedIntents: ["student.archive_inactive"],
    matchTerms: ["student information", "store student", "student profile"],
  },
  {
    key: "attendance.tracking",
    name: "Attendance Tracking",
    group: "Attendance",
    relatedIntents: ["parents.access"],
    matchTerms: ["attendance", "mark attendance"],
  },
  {
    key: "report_cards.generation",
    name: "Report Cards",
    group: "Report Cards",
    relatedIntents: ["parents.access"],
    matchTerms: ["report cards", "report card", "grades"],
  },
  {
    key: "finance.fees",
    name: "School Fees",
    group: "Finance",
    relatedIntents: ["parents.access"],
    matchTerms: ["fees", "finance", "payments"],
  },
  {
    key: "parents.access",
    name: "Parent Portal Access",
    group: "Parent Portal",
    relatedIntents: ["attendance.tracking", "report_cards.generation"],
    matchTerms: ["parent portal", "parents see", "parent access"],
  },
  {
    key: "demo.request",
    name: "Demo Request",
    group: "Support",
    relatedIntents: ["pricing.free_plan"],
    matchTerms: ["demo", "book a demo", "see a demo"],
  },
];

const REGISTRY_BY_KEY = new Map(
  INTENT_REGISTRY.map((intent) => [intent.key, intent])
);

export function getIntentDefinition(key: string): IntentDefinition | undefined {
  return REGISTRY_BY_KEY.get(key);
}

export function inferIntentFromText(
  question: string,
  category?: string
): Pick<IntentDefinition, "key" | "name" | "group" | "relatedIntents"> | null {
  const normalized = question.toLowerCase();

  for (const intent of INTENT_REGISTRY) {
    if (intent.matchTerms.some((term) => normalized.includes(term.toLowerCase()))) {
      return {
        key: intent.key,
        name: intent.name,
        group: intent.group,
        relatedIntents: intent.relatedIntents,
      };
    }
  }

  if (category) {
    const byGroup = INTENT_REGISTRY.find(
      (intent) => intent.group.toLowerCase() === category.toLowerCase()
    );
    if (byGroup) {
      return {
        key: byGroup.key,
        name: byGroup.name,
        group: byGroup.group,
        relatedIntents: byGroup.relatedIntents,
      };
    }
  }

  return null;
}

export function resolveEntryIntent(entry: {
  question: string;
  category: string;
  intent_key?: string | null;
  intent_name?: string | null;
  intent_group?: string | null;
  related_intents?: string[];
}): {
  intent_key: string | null;
  intent_name: string | null;
  intent_group: string | null;
  related_intents: string[];
} {
  if (entry.intent_key) {
    const def = getIntentDefinition(entry.intent_key);
    return {
      intent_key: entry.intent_key,
      intent_name: entry.intent_name ?? def?.name ?? entry.intent_key,
      intent_group: entry.intent_group ?? def?.group ?? entry.category,
      related_intents:
        entry.related_intents?.length
          ? entry.related_intents
          : def?.relatedIntents ?? [],
    };
  }

  const inferred = inferIntentFromText(entry.question, entry.category);
  if (!inferred) {
    return {
      intent_key: null,
      intent_name: null,
      intent_group: entry.category,
      related_intents: entry.related_intents ?? [],
    };
  }

  return {
    intent_key: inferred.key,
    intent_name: inferred.name,
    intent_group: inferred.group,
    related_intents:
      entry.related_intents?.length
        ? entry.related_intents
        : inferred.relatedIntents,
  };
}
