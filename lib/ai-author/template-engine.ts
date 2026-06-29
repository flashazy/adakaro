/**
 * Category-aware documentation section templates.
 */

import type { TemplateFamily } from "./lesson-analyzer";
import { detectSemanticSections } from "@/lib/ai-training/knowledge-answer-structure";

export interface SectionTemplate {
  title: string;
  purpose: string;
}

const TEMPLATE_SECTIONS: Record<TemplateFamily, SectionTemplate[]> = {
  identity: [
    { title: "Overview", purpose: "Direct summary of what Adakaro is." },
    { title: "Mission", purpose: "Organizational purpose and scope." },
    { title: "Purpose", purpose: "Problems Adakaro addresses for schools." },
    { title: "Audience", purpose: "Who uses Adakaro and in what roles." },
    { title: "Related Topics", purpose: "Connected lessons and modules." },
  ],
  capabilities: [
    { title: "Overview", purpose: "What this capability covers." },
    { title: "Key Capabilities", purpose: "Primary features and actions." },
    { title: "Benefits", purpose: "Operational outcomes for schools." },
    { title: "Permissions", purpose: "Who can access and configure." },
    { title: "Related Features", purpose: "Adjacent modules and workflows." },
  ],
  getting_started: [
    { title: "Overview", purpose: "What the reader will accomplish." },
    { title: "Before You Begin", purpose: "Prerequisites and access requirements." },
    { title: "Setup Steps", purpose: "Step-by-step configuration." },
    { title: "Next Steps", purpose: "Recommended follow-up actions." },
    { title: "Related Lessons", purpose: "Linked knowledge entries." },
  ],
  pricing: [
    { title: "Overview", purpose: "How Adakaro pricing works." },
    { title: "Plan Details", purpose: "Plans, tiers, and inclusions." },
    { title: "Billing", purpose: "Billing cycle and payment methods." },
    { title: "Limits", purpose: "Usage limits and quotas." },
    { title: "Upgrade Path", purpose: "How schools change plans." },
  ],
  finance: [
    { title: "Overview", purpose: "Finance module scope." },
    { title: "How it Works", purpose: "Core finance workflows." },
    { title: "Configuration", purpose: "Setup and settings." },
    { title: "Examples", purpose: "Typical school finance scenarios." },
    { title: "Related Features", purpose: "Connected modules." },
  ],
  general: [
    { title: "Overview", purpose: "Direct answer to the question." },
    { title: "Purpose", purpose: "Why this topic matters." },
    { title: "How it Works", purpose: "Operational explanation." },
    { title: "Requirements", purpose: "Access, data, or setup needed." },
    { title: "Important Notes", purpose: "Constraints and edge cases." },
    { title: "Related Features", purpose: "Connected Adakaro modules." },
  ],
};

/** Map structure headings from Step 6 into section templates. */
export function resolveSectionTemplates(
  templateFamily: TemplateFamily,
  structure?: string
): SectionTemplate[] {
  const base = TEMPLATE_SECTIONS[templateFamily] ?? TEMPLATE_SECTIONS.general;

  if (!structure?.trim()) return base;

  const detected = detectSemanticSections(structure);
  if (detected.length === 0) return base;

  const fromStructure = detected.map((section) => ({
    title: section.title,
    purpose: `Content for ${section.title}.`,
  }));

  const seen = new Set(fromStructure.map((s) => s.title.toLowerCase()));
  for (const section of base) {
    if (!seen.has(section.title.toLowerCase())) {
      fromStructure.push(section);
    }
  }

  return fromStructure;
}

export function getTemplateFamilyLabel(family: TemplateFamily): string {
  switch (family) {
    case "identity":
      return "Identity";
    case "capabilities":
      return "Capabilities";
    case "getting_started":
      return "Getting Started";
    case "pricing":
      return "Pricing";
    case "finance":
      return "Finance";
    default:
      return "General";
  }
}
