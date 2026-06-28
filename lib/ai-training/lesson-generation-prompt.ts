/**
 * Prompts and module-specific question banks for AI lesson generation.
 * Provider-agnostic — consumed by rule-based and LLM providers alike.
 */

import type { CurriculumModuleId } from "./knowledge-curriculum";
import { buildKnowledgeWritingStandardMarkdown } from "./knowledge-writing-standard";

export type GenerationMode = "10" | "20" | "50" | "fill_remaining";

export interface ModuleQuestionSeed {
  question: string;
  intentLabel: string;
  priority?: "low" | "normal" | "high" | "critical";
  topicTag: string;
}

export const MODULE_QUESTION_BANK: Record<CurriculumModuleId, ModuleQuestionSeed[]> = {
  "about-adakaro": [
    { question: "What is Adakaro?", intentLabel: "Identity", topicTag: "platform-overview", priority: "critical" },
    { question: "What can Adakaro do?", intentLabel: "Capabilities", topicTag: "capabilities", priority: "critical" },
    { question: "Who is Adakaro built for?", intentLabel: "Identity", topicTag: "audience" },
    { question: "Why choose Adakaro?", intentLabel: "Reasoning", topicTag: "benefits" },
    { question: "Why was Adakaro created?", intentLabel: "Reasoning", topicTag: "origin" },
    { question: "Who uses Adakaro?", intentLabel: "Identity", topicTag: "users" },
    { question: "What problems does Adakaro solve?", intentLabel: "Capabilities", topicTag: "problems" },
    { question: "What makes Adakaro different?", intentLabel: "Comparison", topicTag: "differentiation" },
    { question: "How does Adakaro simplify school management?", intentLabel: "Capabilities", topicTag: "simplification" },
    { question: "Is Adakaro cloud based?", intentLabel: "Eligibility", topicTag: "cloud" },
    { question: "How secure is Adakaro?", intentLabel: "Security", topicTag: "security" },
    { question: "Can Adakaro scale to large schools?", intentLabel: "Eligibility", topicTag: "scale" },
    { question: "Can multiple schools use Adakaro?", intentLabel: "Eligibility", topicTag: "multi-school" },
    { question: "What devices support Adakaro?", intentLabel: "Eligibility", topicTag: "devices" },
    { question: "Can Adakaro replace spreadsheets?", intentLabel: "Comparison", topicTag: "spreadsheets" },
    { question: "Does Adakaro support large schools?", intentLabel: "Eligibility", topicTag: "large-schools" },
    { question: "Can Adakaro be customized?", intentLabel: "Eligibility", topicTag: "customization" },
    { question: "Can Adakaro work offline?", intentLabel: "Eligibility", topicTag: "offline" },
    { question: "What modules are included in Adakaro?", intentLabel: "Capabilities", topicTag: "modules" },
    { question: "How does Adakaro help school administrators?", intentLabel: "Capabilities", topicTag: "administrators" },
  ],
  pricing: [
    { question: "How much does Adakaro cost?", intentLabel: "Pricing", topicTag: "cost", priority: "critical" },
    { question: "Is there a free plan?", intentLabel: "Pricing", topicTag: "free-plan", priority: "high" },
    { question: "How does Adakaro pricing work?", intentLabel: "Pricing", topicTag: "pricing-model" },
    { question: "Is Adakaro billed per student?", intentLabel: "Pricing", topicTag: "per-student" },
    { question: "Can I pay monthly or yearly?", intentLabel: "Pricing", topicTag: "billing-cycle" },
    { question: "Are there feature tiers on paid plans?", intentLabel: "Pricing", topicTag: "tiers" },
    { question: "When does billing start?", intentLabel: "Pricing", topicTag: "billing-start" },
    { question: "What happens when I exceed the free tier?", intentLabel: "Pricing", topicTag: "free-limit" },
  ],
  "getting-started": [
    { question: "How do I get started with Adakaro?", intentLabel: "Setup", topicTag: "onboarding", priority: "critical" },
    { question: "How do I request a demo?", intentLabel: "Setup", topicTag: "demo" },
    { question: "What are the first steps after signing up?", intentLabel: "Setup", topicTag: "first-steps" },
    { question: "How long does setup take?", intentLabel: "Setup", topicTag: "setup-time" },
    { question: "Can I import existing student data?", intentLabel: "Workflow", topicTag: "import" },
    { question: "How do I invite teachers?", intentLabel: "Workflow", topicTag: "invite-teachers" },
    { question: "How do I invite parents?", intentLabel: "Workflow", topicTag: "invite-parents" },
  ],
  "student-management": [
    { question: "How do I add students to Adakaro?", intentLabel: "Workflow", topicTag: "add-students", priority: "high" },
    { question: "Can I import students from Excel?", intentLabel: "Workflow", topicTag: "excel-import" },
    { question: "How are student profiles managed?", intentLabel: "Workflow", topicTag: "profiles" },
    { question: "Can I archive a student without deleting records?", intentLabel: "Workflow", topicTag: "archive" },
    { question: "How do I search for a student?", intentLabel: "Workflow", topicTag: "search" },
  ],
  admissions: [
    { question: "How does the enrollment desk work?", intentLabel: "Workflow", topicTag: "enrollment-desk" },
    { question: "Can parents apply online?", intentLabel: "Eligibility", topicTag: "online-application" },
    { question: "How are admission applications reviewed?", intentLabel: "Workflow", topicTag: "review" },
  ],
  "classes-streams": [
    { question: "How do I create classes in Adakaro?", intentLabel: "Workflow", topicTag: "create-classes" },
    { question: "What are streams in Adakaro?", intentLabel: "Identity", topicTag: "streams" },
    { question: "How are subjects assigned to classes?", intentLabel: "Workflow", topicTag: "subjects" },
  ],
  "teachers-staff": [
    { question: "How do I add teachers to Adakaro?", intentLabel: "Workflow", topicTag: "add-teachers" },
    { question: "Can teachers have different roles?", intentLabel: "Eligibility", topicTag: "roles" },
    { question: "How are teachers assigned to classes?", intentLabel: "Workflow", topicTag: "assignments" },
  ],
  attendance: [
    { question: "How do teachers record attendance?", intentLabel: "Workflow", topicTag: "record", priority: "high" },
    { question: "Can parents see attendance?", intentLabel: "Parent", topicTag: "parent-view", priority: "high" },
    { question: "How are attendance reports generated?", intentLabel: "Workflow", topicTag: "reports" },
    { question: "Can attendance be corrected?", intentLabel: "Workflow", topicTag: "corrections" },
    { question: "Can attendance be exported?", intentLabel: "Workflow", topicTag: "export" },
    { question: "How does attendance affect report cards?", intentLabel: "Workflow", topicTag: "report-cards" },
  ],
  "report-cards": [
    { question: "How do report cards work in Adakaro?", intentLabel: "Workflow", topicTag: "overview", priority: "high" },
    { question: "Can report cards be exported as PDF?", intentLabel: "Eligibility", topicTag: "pdf" },
    { question: "Can parents download report cards?", intentLabel: "Parent", topicTag: "parent-access" },
    { question: "How are grades entered?", intentLabel: "Workflow", topicTag: "grades" },
  ],
  finance: [
    { question: "How does school finance work in Adakaro?", intentLabel: "Finance", topicTag: "overview", priority: "high" },
    { question: "Can I issue fee receipts?", intentLabel: "Finance", topicTag: "receipts" },
    { question: "How are fee balances calculated?", intentLabel: "Finance", topicTag: "balances" },
    { question: "Can parents view fee balances?", intentLabel: "Parent", topicTag: "parent-fees" },
    { question: "How do I set up fee structures?", intentLabel: "Workflow", topicTag: "fee-structures" },
  ],
  "parent-portal": [
    { question: "What can parents see in the Parent Portal?", intentLabel: "Parent", topicTag: "overview", priority: "high" },
    { question: "How do parents access Adakaro?", intentLabel: "Setup", topicTag: "access" },
    { question: "Can parents receive notifications?", intentLabel: "Parent", topicTag: "notifications" },
  ],
  communication: [
    { question: "How does messaging work in Adakaro?", intentLabel: "Communication", topicTag: "messaging" },
    { question: "Can schools send broadcasts?", intentLabel: "Communication", topicTag: "broadcasts" },
    { question: "Can teachers message parents directly?", intentLabel: "Communication", topicTag: "teacher-parent" },
  ],
  "curriculum-syllabus": [
    { question: "What is syllabus coverage in Adakaro?", intentLabel: "Identity", topicTag: "overview" },
    { question: "How do teachers track syllabus progress?", intentLabel: "Workflow", topicTag: "tracking" },
  ],
  promotions: [
    { question: "How do student promotions work?", intentLabel: "Workflow", topicTag: "promotions" },
    { question: "Can I promote an entire class at once?", intentLabel: "Eligibility", topicTag: "bulk-promote" },
  ],
  "student-streaming": [
    { question: "How does student streaming work?", intentLabel: "Workflow", topicTag: "streaming" },
    { question: "Can I move a student between streams?", intentLabel: "Workflow", topicTag: "stream-change" },
    { question: "Is class history preserved when students move?", intentLabel: "Eligibility", topicTag: "history" },
  ],
  "security-roles": [
    { question: "What user roles does Adakaro support?", intentLabel: "Security", topicTag: "roles" },
    { question: "How are permissions managed?", intentLabel: "Security", topicTag: "permissions" },
    { question: "Can I restrict finance access?", intentLabel: "Security", topicTag: "finance-access" },
  ],
  "ai-copilot": [
    { question: "What is Adakaro Copilot?", intentLabel: "Identity", topicTag: "overview" },
    { question: "What can Copilot help teachers do?", intentLabel: "Capabilities", topicTag: "teachers" },
    { question: "Is Copilot available on every plan?", intentLabel: "Eligibility", topicTag: "availability" },
  ],
  troubleshooting: [
    { question: "What should I do if a parent cannot log in?", intentLabel: "Troubleshooting", topicTag: "parent-login" },
    { question: "How do I reset a teacher password?", intentLabel: "Troubleshooting", topicTag: "password-reset" },
    { question: "Why is a report card not visible to parents?", intentLabel: "Troubleshooting", topicTag: "report-cards" },
  ],
};

export function buildLessonGenerationSystemPrompt(): string {
  return [
    "You are an expert curriculum author for Adakaro, a school management platform in Africa.",
    "Generate knowledge base lessons — facts only, not conversational chat.",
    "",
    "Rules:",
    "- One intent per question.",
    "- Professional, accurate, retrieval-ready answers.",
    "- Follow the Adakaro Knowledge Writing Standard.",
    "- Never invent features that do not exist.",
    "- No marketing exaggeration.",
    "- Include structured sections when appropriate: Short Answer, Overview, Key Facts, Benefits, Best For, Example, Related Topics, Summary.",
    "- Short Answer must be one clear paragraph that answers immediately.",
    "- Write like a knowledgeable Adakaro product specialist—not generic AI.",
    "- Vary sentence structure. Avoid repetitive phrasing.",
    "",
    buildKnowledgeWritingStandardMarkdown().slice(0, 2000),
  ].join("\n");
}

export function buildLessonGenerationUserPrompt(input: {
  moduleName: string;
  moduleDescription: string;
  count: number;
  existingQuestions: string[];
  missingTopics: string[];
  missingIntents: string[];
}): string {
  return JSON.stringify(
    {
      task: "Generate knowledge lessons as JSON array",
      module: input.moduleName,
      description: input.moduleDescription,
      count: input.count,
      avoidQuestions: input.existingQuestions,
      prioritizeTopics: input.missingTopics,
      prioritizeIntents: input.missingIntents,
      outputSchema: {
        lessons: [
          {
            question: "string",
            answer: "string (markdown: Short Answer, Overview, Key Facts, Benefits, Best For, Example, Related Topics, Summary)",
            intentLabel: "string",
            priority: "low|normal|high|critical",
            topicTag: "string",
          },
        ],
      },
    },
    null,
    2
  );
}

export function modeToCount(
  mode: GenerationMode,
  remaining: number
): number {
  switch (mode) {
    case "10":
      return Math.min(10, remaining);
    case "20":
      return Math.min(20, remaining);
    case "50":
      return Math.min(50, remaining);
    case "fill_remaining":
      return Math.max(1, Math.min(remaining, 50));
    default:
      return 10;
  }
}
