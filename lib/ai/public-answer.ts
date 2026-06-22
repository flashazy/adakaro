import { ADAKARO_PUBLIC_KNOWLEDGE } from "@/lib/ai/knowledge/public-knowledge";

export type PublicIntentKind =
  | "parent_attendance_visibility"
  | "parent_report_card_access"
  | "parent_portal_general"
  | "finance_receipts"
  | "finance_general"
  | "student_streaming"
  | "report_cards_pdf"
  | "report_cards_general"
  | "attendance_teacher"
  | "attendance_general"
  | "pricing"
  | "syllabus_general"
  | "demo"
  | "onboarding"
  | "features_overview"
  | "platform_overview";

export interface PublicIntent {
  kind: PublicIntentKind;
}

function normalize(message: string): string {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((t) => text.includes(t));
}

function hasParentContext(text: string): boolean {
  return hasAny(text, ["parent", "parents", "guardian", "guardians", "parent portal"]);
}

function hasAttendanceContext(text: string): boolean {
  return hasAny(text, [
    "attendance",
    "absent",
    "absence",
    "present",
    "late",
    "lateness",
  ]);
}

function hasReportCardContext(text: string): boolean {
  return hasAny(text, [
    "report card",
    "report cards",
    "term results",
    "term report",
  ]);
}

function isBroadOverviewQuestion(text: string): boolean {
  return hasAny(text, [
    "what features",
    "what's included",
    "whats included",
    "what is included",
    "what does adakaro",
    "what can adakaro",
    "tell me about adakaro",
    "how does adakaro work",
  ]);
}

export function classifyPublicIntent(message: string): PublicIntent {
  const q = normalize(message);

  if (
    (hasParentContext(q) && hasAttendanceContext(q)) ||
    (hasAttendanceContext(q) &&
      hasAny(q, [
        "notification",
        "notifications",
        "notify",
        "updates",
        "update",
        "see",
        "view",
        "access",
        "track",
        "monitor",
      ]) &&
      hasAny(q, ["parent", "parents", "family", "guardian"]))
  ) {
    return { kind: "parent_attendance_visibility" };
  }

  if (
    (hasParentContext(q) && hasReportCardContext(q)) ||
    (hasReportCardContext(q) &&
      hasAny(q, ["download", "access", "view", "see", "parent", "parents"]))
  ) {
    return { kind: "parent_report_card_access" };
  }

  if (
    hasParentContext(q) &&
    hasAny(q, ["portal", "login", "account", "communicate", "message", "fees", "fee"])
  ) {
    return { kind: "parent_portal_general" };
  }

  if (hasAny(q, ["receipt", "receipts"])) {
    return { kind: "finance_receipts" };
  }

  if (hasAny(q, ["stream", "streaming", "class placement", "promotion"])) {
    return { kind: "student_streaming" };
  }

  if (
    hasAny(q, ["price", "pricing", "cost", "how much", "tzs", "billing", "subscription"])
  ) {
    return { kind: "pricing" };
  }

  if (hasAny(q, ["demo", "walkthrough", "live demo"])) {
    return { kind: "demo" };
  }

  if (
    hasAny(q, [
      "getting started",
      "get started",
      "onboard",
      "onboarding",
      "set up",
      "setup",
      "how to start",
    ])
  ) {
    return { kind: "onboarding" };
  }

  if (hasAny(q, ["syllabus", "coverage", "curriculum"])) {
    return { kind: "syllabus_general" };
  }

  if (
    hasReportCardContext(q) &&
    hasAny(q, ["pdf", "export", "print", "download"])
  ) {
    return { kind: "report_cards_pdf" };
  }

  if (hasReportCardContext(q)) {
    return { kind: "report_cards_general" };
  }

  if (
    hasAttendanceContext(q) &&
    hasAny(q, ["teacher", "mark", "record", "take attendance", "daily"])
  ) {
    return { kind: "attendance_teacher" };
  }

  if (hasAttendanceContext(q)) {
    return { kind: "attendance_general" };
  }

  if (
    hasAny(q, [
      "finance",
      "fee",
      "fees",
      "payment",
      "payments",
      "balance",
      "outstanding",
      "collect",
    ])
  ) {
    return { kind: "finance_general" };
  }

  if (isBroadOverviewQuestion(q)) {
    return { kind: "features_overview" };
  }

  return { kind: "platform_overview" };
}

function nextSteps(lines: string[]): string {
  return `**Next steps**\n\n${lines.join("\n")}`;
}

function supporting(label: string, body: string): string {
  return `**${label}**\n\n${body}`;
}

const DEMO_CTA = "✓ [Request a Demo](/contact)";
const PRICING_CTA = "✓ [View pricing](/pricing)";
const CONTACT_CTA = "✓ [Open Contact Page](/contact)";
const SIGNUP_CTA = "✓ [Start free](/signup?role=admin)";

function answerForIntent(intent: PublicIntent): string {
  switch (intent.kind) {
    case "parent_attendance_visibility":
      return [
        "Yes. Adakaro includes a **Parent Portal** where parents can view attendance information for their children.",
        "",
        "Parents can:",
        "• View attendance history",
        "• Monitor absences and lateness",
        "• Track attendance trends",
        "• Stay informed about school participation",
        "",
        supporting(
          "How it works",
          "Teachers mark daily class and subject-level attendance from their dashboard. Schools invite parents to the portal and control what each family can see."
        ),
        "",
        "Attendance visibility depends on the permissions configured by the school.",
        "",
        nextSteps([DEMO_CTA, PRICING_CTA]),
      ].join("\n");

    case "parent_report_card_access":
      return [
        "Yes, parents can access report cards through the **Parent Portal**.",
        "",
        "Once a school publishes approved report cards, parents can:",
        "• View term report cards for their children",
        "• See grades, rankings, and teacher comments",
        "• Review attendance summaries included on report cards",
        "",
        supporting(
          "Publishing",
          ADAKARO_PUBLIC_KNOWLEDGE.reportCards
        ),
        "",
        "Download and print options depend on how the school configures report card publishing.",
        "",
        nextSteps([DEMO_CTA, PRICING_CTA]),
      ].join("\n");

    case "parent_portal_general":
      return [
        "Yes. Adakaro includes a **Parent Portal** so families can stay connected to school life.",
        "",
        "Parents can typically access:",
        "• Attendance records and updates",
        "• Report cards and academic results",
        "• Fee balances and payment receipts",
        "• Messages from class teachers",
        "",
        supporting(
          "Access",
          "Schools invite parents and link them to their children. What each parent sees depends on the school's portal setup and permissions."
        ),
        "",
        nextSteps([DEMO_CTA, PRICING_CTA]),
      ].join("\n");

    case "finance_receipts":
      return [
        "Yes, Adakaro supports **fee receipts**.",
        "",
        "When payments are recorded, the finance module can:",
        "• Generate receipt numbers automatically",
        "• Store receipts linked to student payments",
        "• Let finance staff view and share receipts from the dashboard",
        "• Show payment receipts to parents in the Parent Portal",
        "",
        supporting(
          "Finance module",
          ADAKARO_PUBLIC_KNOWLEDGE.finance
        ),
        "",
        nextSteps([DEMO_CTA, PRICING_CTA]),
      ].join("\n");

    case "finance_general":
      return [
        "Yes, Adakaro includes **school finance** tools for fees and payments.",
        "",
        "Schools can:",
        "• Set up fee types and fee structures",
        "• Record payments and track outstanding balances",
        "• Generate receipts for completed payments",
        "• Give parents fee visibility through the Parent Portal",
        "",
        supporting("Overview", ADAKARO_PUBLIC_KNOWLEDGE.finance),
        "",
        nextSteps([DEMO_CTA, PRICING_CTA]),
      ].join("\n");

    case "student_streaming":
      return [
        "Yes, Adakaro supports **student streaming** and class placement.",
        "",
        "Schools can:",
        "• Place students into classes and streams",
        "• Manage promotions between academic levels",
        "• Track class assignments across terms",
        "• Handle enrollment and class changes from the admin dashboard",
        "",
        supporting(
          "Student management",
          "Adakaro covers student enrollment, profiles, class assignments, and promotions — so schools can organize learners by level, class, and stream."
        ),
        "",
        nextSteps([DEMO_CTA, PRICING_CTA]),
      ].join("\n");

    case "report_cards_pdf":
      return [
        "Yes, Adakaro supports **PDF export** for report cards.",
        "",
        "Schools can:",
        "• Configure report card templates per class level",
        "• Include grades, rankings, comments, and signatures",
        "• Export report cards as PDF for printing or sharing",
        "",
        supporting("Report cards", ADAKARO_PUBLIC_KNOWLEDGE.reportCards),
        "",
        nextSteps([DEMO_CTA, PRICING_CTA]),
      ].join("\n");

    case "report_cards_general":
      return [
        "Yes, Adakaro supports **configurable report cards** for schools.",
        "",
        "Report cards can include:",
        "• Grades and class rankings",
        "• Teacher comments and coordinator signatures",
        "• Attendance summaries for the term",
        "• PDF export for printing or sharing",
        "",
        supporting("How it works", ADAKARO_PUBLIC_KNOWLEDGE.reportCards),
        "",
        nextSteps([DEMO_CTA, PRICING_CTA]),
      ].join("\n");

    case "attendance_teacher":
      return [
        "Yes. Teachers mark **attendance directly from their dashboard** in Adakaro.",
        "",
        "Teachers can:",
        "• Record daily class attendance",
        "• Mark subject-level attendance when needed",
        "• Update records during the school day",
        "",
        supporting(
          "School-wide visibility",
          "Administrators get school-wide attendance visibility, while parents can view attendance updates through the Parent Portal when enabled."
        ),
        "",
        nextSteps([DEMO_CTA, PRICING_CTA]),
      ].join("\n");

    case "attendance_general":
      return [
        "Yes, Adakaro includes **attendance tracking** at class and subject level.",
        "",
        "The platform supports:",
        "• Daily class attendance from teacher dashboards",
        "• Subject-level attendance for detailed records",
        "• School-wide visibility for administrators",
        "• Parent Portal access so families can monitor attendance",
        "",
        supporting("Overview", ADAKARO_PUBLIC_KNOWLEDGE.attendance),
        "",
        nextSteps([DEMO_CTA, PRICING_CTA]),
      ].join("\n");

    case "pricing":
      return [
        `**${ADAKARO_PUBLIC_KNOWLEDGE.pricing.summary}**`,
        "",
        "• Start free with up to " +
          `${ADAKARO_PUBLIC_KNOWLEDGE.pricing.freeTierStudents} students`,
        "• Full system access — no feature tiers on paid plans",
        "• Monthly or yearly billing per student",
        "",
        nextSteps([DEMO_CTA, PRICING_CTA, SIGNUP_CTA]),
      ].join("\n");

    case "syllabus_general":
      return [
        "Yes, Adakaro includes **syllabus coverage** tracking.",
        "",
        "Schools can:",
        "• Define topics per subject",
        "• Track teaching progress across classes",
        "• Give academic coordinators visibility into coverage",
        "",
        supporting("Overview", ADAKARO_PUBLIC_KNOWLEDGE.syllabus),
        "",
        nextSteps([DEMO_CTA]),
      ].join("\n");

    case "demo":
      return [
        "You can request a **personalized demo** for your school.",
        "",
        "• Fill out the demo form on our contact page",
        "• Message us on WhatsApp for the fastest response",
        "• We'll tailor the walkthrough to your school's needs",
        "",
        nextSteps([CONTACT_CTA, "→ [View pricing](/pricing)"]),
      ].join("\n");

    case "onboarding":
      return [
        "Here's how schools typically **get started** with Adakaro:",
        "",
        "• Create classes and assign subjects",
        "• Import or enroll students",
        "• Configure fees and fee structures",
        "• Invite teachers and parents to the platform",
        "",
        supporting(
          "Guided setup",
          "Request a demo at /contact for a walkthrough tailored to your school."
        ),
        "",
        nextSteps([SIGNUP_CTA, DEMO_CTA]),
      ].join("\n");

    case "features_overview":
      return [
        "Adakaro brings school operations into **one platform**.",
        "",
        "Core capabilities include:",
        ...ADAKARO_PUBLIC_KNOWLEDGE.features.map((f) => `• ${f}`),
        "",
        nextSteps([PRICING_CTA, DEMO_CTA]),
      ].join("\n");

    case "platform_overview":
    default:
      return [
        "I'm **Adakaro AI** — I can answer specific questions about the platform.",
        "",
        "Try asking about:",
        "• Report cards and grading",
        "• Attendance and parent visibility",
        "• School finance and receipts",
        "• Pricing and getting started",
        "",
        nextSteps([DEMO_CTA, PRICING_CTA]),
      ].join("\n");
  }
}

export function buildPublicAnswer(message: string): string {
  const intent = classifyPublicIntent(message);
  return answerForIntent(intent);
}
