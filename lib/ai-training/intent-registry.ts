export interface IntentDefinition {
  key: string;
  name: string;
  group: string;
  relatedIntents: string[];
  /** Legacy match terms — also used as trigger phrases. */
  matchTerms: string[];
  triggerPhrases?: string[];
  negativePhrases?: string[];
  intentKeywords?: string[];
  disambiguationHint?: string;
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
    triggerPhrases: ["try before paying", "try the system", "free plan", "free trial"],
    disambiguationHint: "trying Adakaro before paying",
  },
  {
    key: "pricing.billing_start",
    name: "When Billing Starts",
    group: "Pricing",
    relatedIntents: ["pricing.free_plan", "pricing.cost", "pricing.monthly_features"],
    matchTerms: ["when do i start paying", "start paying", "billing start"],
    triggerPhrases: ["when do i start paying", "start paying", "billing starts"],
    disambiguationHint: "when billing or payments begin",
  },
  {
    key: "pricing.starter_plan",
    name: "Starter Plan",
    group: "Pricing",
    relatedIntents: ["pricing.free_plan", "pricing.cost"],
    matchTerms: ["starter plan", "starter package", "starter tier"],
    triggerPhrases: ["starter plan", "starter package", "starter tier"],
    disambiguationHint: "the starter pricing package",
  },
  {
    key: "pricing.monthly_features",
    name: "Monthly Billing Features",
    group: "Pricing",
    relatedIntents: ["pricing.cost", "pricing.billing_start"],
    matchTerms: ["monthly billing", "lose features", "pay monthly"],
    triggerPhrases: [
      "lose features",
      "pay monthly",
      "monthly billing",
      "monthly plan features",
    ],
    disambiguationHint: "whether monthly billing removes features",
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
    triggerPhrases: [
      "bulk import",
      "import students in bulk",
      "another system",
      "bring learners",
      "migrate students",
      "external system",
    ],
    disambiguationHint: "importing students in bulk from another system",
  },
  {
    key: "student.excel_upload",
    name: "Excel Upload",
    group: "Student Management",
    relatedIntents: ["student.bulk_import", "student.csv_template"],
    matchTerms: ["upload excel", "excel file", "spreadsheet"],
    triggerPhrases: ["upload excel", "excel file", "excel upload", "spreadsheet"],
    disambiguationHint: "uploading Excel files",
  },
  {
    key: "student.csv_template",
    name: "CSV Template",
    group: "Student Management",
    relatedIntents: ["student.bulk_import", "student.excel_upload"],
    matchTerms: ["csv template", "download template"],
    triggerPhrases: ["csv template", "download template"],
  },
  {
    key: "student.class_transfer",
    name: "Class Transfer",
    group: "Student Management",
    relatedIntents: ["student.class_history", "student.archive_inactive"],
    matchTerms: [
      "transfer students",
      "change class",
      "another stream",
      "move pupil",
      "change pupil",
    ],
    triggerPhrases: [
      "transfer students",
      "change class",
      "another stream",
      "move pupil",
      "change pupil",
      "move to another class",
    ],
    disambiguationHint: "moving a student to another class or stream",
  },
  {
    key: "student.class_history",
    name: "Class History",
    group: "Student Management",
    relatedIntents: ["student.class_transfer", "student.archive_inactive"],
    matchTerms: ["class history", "movement history", "stream history"],
    triggerPhrases: [
      "previous classes",
      "class history",
      "movement history",
      "previous streams",
      "student journey",
      "class movement",
      "view movement history",
      "see previous classes",
    ],
    negativePhrases: [
      "active list",
      "active lists",
      "remove from active list",
      "remove from active lists",
      "hide student",
      "hide learner",
      "archive student",
      "deactivate student",
      "mark inactive",
      "remove learner",
      "keep records",
      "without deleting",
    ],
    intentKeywords: ["previous", "movement", "journey", "past classes"],
    disambiguationHint: "viewing a student's class movement history",
  },
  {
    key: "student.archive_inactive",
    name: "Archive / Deactivate Students",
    group: "Student Management",
    relatedIntents: ["student.class_history", "student.profile_information"],
    matchTerms: [
      "archive student",
      "deactivate student",
      "hide student",
      "keep history",
      "remove learner",
      "active lists",
    ],
    triggerPhrases: [
      "remove from active list",
      "remove from active lists",
      "hide student",
      "hide learner",
      "archive student",
      "deactivate student",
      "mark inactive",
      "keep records",
      "keep history",
      "student left school",
      "former student",
      "remove learner",
      "active list",
      "without deleting",
    ],
    intentKeywords: ["inactive", "archive", "hide", "deactivate", "soft delete"],
    disambiguationHint:
      "hiding or deactivating a student while keeping records and history",
  },
  {
    key: "student.profile_information",
    name: "Student Profile Information",
    group: "Student Management",
    relatedIntents: ["student.archive_inactive"],
    matchTerms: ["student information", "store student", "student profile"],
    triggerPhrases: ["student information", "store student data", "student profile"],
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

export interface IntentInferenceResult {
  key: string;
  name: string;
  group: string;
  relatedIntents: string[];
  confidence: number;
  reason: string;
}

const MAX_PHRASE_SCORE = 48;

function normalizeConfidence(rawScore: number, maxPossible: number): number {
  if (maxPossible <= 0) return 0.5;
  const ratio = Math.min(1, rawScore / maxPossible);
  return Math.round((0.55 + ratio * 0.44) * 100) / 100;
}

export function inferIntentWithConfidence(
  question: string,
  category?: string
): IntentInferenceResult | null {
  const normalized = question.toLowerCase();

  let best: {
    intent: IntentDefinition;
    score: number;
    matchedPhrase: string;
  } | null = null;

  for (const intent of INTENT_REGISTRY) {
    const phrases = [
      ...(intent.triggerPhrases ?? []),
      ...intent.matchTerms,
    ];
    let score = 0;
    let matchedPhrase = "";
    for (const term of phrases) {
      const lower = term.toLowerCase();
      if (normalized.includes(lower)) {
        const termScore = lower.length;
        score += termScore;
        if (termScore > matchedPhrase.length) matchedPhrase = term;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { intent, score, matchedPhrase };
    }
  }

  if (best) {
    const confidence = normalizeConfidence(best.score, MAX_PHRASE_SCORE);
    return {
      key: best.intent.key,
      name: best.intent.name,
      group: best.intent.group,
      relatedIntents: best.intent.relatedIntents,
      confidence,
      reason: best.matchedPhrase
        ? `Matched trigger phrase "${best.matchedPhrase}".`
        : "Matched intent registry terms.",
    };
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
        confidence: 0.62,
        reason: `Category "${category}" matched intent group.`,
      };
    }
  }

  return null;
}

export function inferIntentFromText(
  question: string,
  category?: string
): Pick<IntentDefinition, "key" | "name" | "group" | "relatedIntents"> | null {
  const result = inferIntentWithConfidence(question, category);
  if (!result) return null;
  return {
    key: result.key,
    name: result.name,
    group: result.group,
    relatedIntents: result.relatedIntents,
  };
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
