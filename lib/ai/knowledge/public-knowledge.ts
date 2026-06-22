import { FREE_TIER_STUDENT_LIMIT } from "@/lib/plans";

/**
 * Curated Adakaro knowledge for the public assistant.
 * Used as system context and as fallback when no LLM API key is configured.
 */
export const ADAKARO_PUBLIC_KNOWLEDGE = {
  pricing: {
    freeTierStudents: FREE_TIER_STUDENT_LIMIT,
    perStudentMonthlyTzs: 500,
    perStudentYearlyTzs: 5000,
    yearlySavingsPerStudentTzs: 1000,
    summary: `Start free with up to ${FREE_TIER_STUDENT_LIMIT} students. After that, Adakaro costs TSh 500 per student per month or TSh 5,000 per student per year. Every paying school gets the full system — no feature tiers.`,
  },
  features: [
    "Student enrollment and profiles",
    "Class and subject management",
    "Attendance tracking (class and subject level)",
    "Configurable report cards with grades, rankings, comments, and PDF export",
    "School finance: fee types, structures, payments, receipts, and balances",
    "Parent portal for fees, results, and communication",
    "Teacher dashboards for grading, attendance, and lesson plans",
    "Syllabus coverage tracking",
    "Promotions and academic department tools",
    "Broadcasts and in-app messaging",
    "Enrollment desk for streamlined student intake",
  ],
  reportCards:
    "Adakaro supports configurable report cards with grading, class rankings, teacher comments, coordinator signatures, and PDF exports. Schools can set up report card templates per class level.",
  attendance:
    "Track daily class attendance and subject-level attendance. Teachers mark attendance from their dashboard; admins get school-wide visibility.",
  finance:
    "Manage fee types, fee structures, record payments, generate receipts, and track outstanding balances. Finance department teachers can access payments workflows based on role.",
  syllabus:
    "Syllabus coverage lets schools define topics and track teaching progress across subjects and classes.",
  onboarding: `Typical setup: (1) Create classes, (2) Assign subjects, (3) Import or enroll students, (4) Configure fees, (5) Invite teachers and parents. Request a demo at /contact for a guided walkthrough.`,
  demoUrl: "/contact",
  signupUrl: "/signup?role=admin",
} as const;

export function buildPublicKnowledgeContext(): string {
  const k = ADAKARO_PUBLIC_KNOWLEDGE;
  return [
    "## Adakaro Platform Knowledge",
    "",
    "### Pricing",
    k.pricing.summary,
    "",
    "### Core Features",
    ...k.features.map((f) => `- ${f}`),
    "",
    "### Report Cards",
    k.reportCards,
    "",
    "### Attendance",
    k.attendance,
    "",
    "### Finance",
    k.finance,
    "",
    "### Syllabus Coverage",
    k.syllabus,
    "",
    "### Onboarding",
    k.onboarding,
    "",
    `Demo requests: ${k.demoUrl}`,
    `Sign up: ${k.signupUrl}`,
  ].join("\n");
}
