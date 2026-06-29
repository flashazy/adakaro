/**
 * Semantic fact clustering — groups accepted facts by documentation meaning.
 * Composition-only; does not affect scoring, ranking, or acceptance.
 */

import type { ScoredFact } from "./types";

export type FactCluster =
  | "identity"
  | "purpose"
  | "audience"
  | "capabilities"
  | "benefits"
  | "permissions"
  | "pricing"
  | "deployment"
  | "security"
  | "notes";

const CAPABILITY_TERMS =
  /\b(includes|supports|provides|manages|enables|offers|features|modules?)\b/i;
const FEATURE_NOUNS =
  /\b(finance|attendance|enrollment|report(?:ing)?|portal|admission|billing|invoice|gradebook|timetable|fee|receipt|dashboard|notification)\b/i;
const BENEFIT_TERMS =
  /\b(saves?|reduces?|improves?|streamlines?|centralizes?|faster|better|easier|efficient|less manual|accuracy|time savings?)\b/i;
const PURPOSE_TERMS =
  /\b(helps?|designed to|built to|simplify|digitize|addresses?|solve|mission|purpose|daily operations|one secure platform)\b/i;
const IDENTITY_TERMS =
  /\b(adakaro is|school management|cloud[- ]based|platform|product|system)\b/i;
const AI_TERMS = /\b(ai assistant|copilot|answer questions|chatbot|ai-powered|generates? answers)\b/i;
const AUDIENCE_TERMS =
  /\b(school owners?|principals?|teachers?|parents?|students?|finance officers?|administrators?|coordinators?|built for|suitable for|intended for)\b/i;
const ROLE_ONLY =
  /^(school owners?|principals?|teachers?|parents?|students?|finance officers?|administrators?|academic coordinators?)$/i;

function cleanText(text: string): string {
  return text.trim().replace(/^[-•*]\s+/, "").replace(/\*\*/g, "").trim();
}

export function extractAudienceRole(text: string): string | null {
  const cleaned = cleanText(text);
  if (ROLE_ONLY.test(cleaned)) return titleCase(cleaned);

  if (/\bbuilt for schools and administrators\b/i.test(cleaned)) return "School administrators";
  if (/\bteachers manage classes\b/i.test(cleaned)) return "Teachers";
  if (/\bparents use the portal\b/i.test(cleaned)) return "Parents";
  if (/\bprincipal\b/i.test(cleaned)) return "Principals";
  if (/\bschool owner\b/i.test(cleaned)) return "School owners";
  if (/\bfinance officer\b/i.test(cleaned)) return "Finance officers";
  if (/\bstudent\b/i.test(cleaned) && /\bportal\b/i.test(cleaned)) return "Students";
  if (/\bteacher\b/i.test(cleaned) && !/\bmanage\b/i.test(cleaned)) return "Teachers";
  if (/\bparent\b/i.test(cleaned) && !/\bportal\b/i.test(cleaned)) return "Parents";
  if (/\badministrator\b/i.test(cleaned)) return "School administrators";
  if (/\bcoordinator\b/i.test(cleaned)) return "Academic coordinators";

  const builtFor = cleaned.match(/\bbuilt for\s+(.+?)(?:\.|$)/i);
  if (builtFor?.[1]) {
    const segment = builtFor[1].trim();
    if (!CAPABILITY_TERMS.test(segment) && !FEATURE_NOUNS.test(segment)) {
      return titleCase(segment.replace(/\band\b/gi, ",").split(",")[0]?.trim() ?? segment);
    }
  }

  return null;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function isAudienceOnlyFact(text: string): boolean {
  const cleaned = cleanText(text);
  if (/\b(manage[sd]?|includes|supports|provides|use[s]? the|has an?|enables|offers)\b/i.test(cleaned)) {
    return false;
  }
  if (ROLE_ONLY.test(cleaned)) return true;
  if (/\bbuilt for\b/i.test(cleaned) && !FEATURE_NOUNS.test(cleaned)) return true;
  return /\b(suitable for|intended audience|target users)\b/i.test(cleaned);
}

function isCapabilityFact(text: string): boolean {
  const cleaned = cleanText(text);
  if (AI_TERMS.test(cleaned)) return true;
  if (CAPABILITY_TERMS.test(cleaned) && FEATURE_NOUNS.test(cleaned)) return true;
  if (/\bmanage[sd]?\s+(classes|students|fees|attendance|grades)\b/i.test(cleaned)) return true;
  if (/\buse[s]?\s+the\s+portal\b/i.test(cleaned)) return true;
  if (/\bhas an?\s+/i.test(cleaned) && FEATURE_NOUNS.test(cleaned)) return true;
  return FEATURE_NOUNS.test(cleaned) && !BENEFIT_TERMS.test(cleaned);
}

function isBenefitFact(text: string): boolean {
  const cleaned = cleanText(text);
  if (AI_TERMS.test(cleaned)) return false;
  if (isCapabilityFact(cleaned) && !BENEFIT_TERMS.test(cleaned)) return false;
  if (isAudienceOnlyFact(cleaned)) return false;
  return BENEFIT_TERMS.test(cleaned);
}

function isPurposeFact(text: string): boolean {
  const cleaned = cleanText(text);
  if (IDENTITY_TERMS.test(cleaned) && !PURPOSE_TERMS.test(cleaned)) return false;
  return PURPOSE_TERMS.test(cleaned);
}

function isIdentityFact(text: string): boolean {
  const cleaned = cleanText(text);
  if (/\bcloud[- ]based\b/i.test(cleaned) && !PURPOSE_TERMS.test(cleaned)) return true;
  return (
    /\badakaro is\b/i.test(cleaned) ||
    /\bschool management (system|platform|software)\b/i.test(cleaned)
  );
}

export function classifyFact(fact: ScoredFact): FactCluster {
  const text = cleanText(fact.text);
  const hint = fact.sectionHint?.toLowerCase() ?? "";

  if (hint.includes("audience") || hint.includes("suitable")) {
    if (isAudienceOnlyFact(text)) return "audience";
  }
  if (hint.includes("benefit")) {
    if (isBenefitFact(text)) return "benefits";
  }
  if (hint.includes("capabilit") || hint.includes("feature") || hint.includes("module")) {
    if (isCapabilityFact(text)) return "capabilities";
  }
  if (hint.includes("purpose")) {
    if (isPurposeFact(text)) return "purpose";
  }
  if (hint.includes("overview") || hint.includes("identity")) {
    if (isIdentityFact(text)) return "identity";
  }

  if (/\b(permission|role access|rbac|authorization)\b/i.test(text)) return "permissions";
  if (/\b(pricing|subscription|free plan|billing cycle|cost per)\b/i.test(text)) return "pricing";
  if (/\b(encrypt|sso|authentication|secure access|data protection)\b/i.test(text)) return "security";

  if (isCapabilityFact(text)) return "capabilities";
  if (isAudienceOnlyFact(text)) return "audience";
  if (isBenefitFact(text)) return "benefits";
  if (isPurposeFact(text)) return "purpose";
  if (isIdentityFact(text)) return "identity";

  if (/\b(runs online|hosted online|cloud hosted)\b/i.test(text) && /\badakaro\b/i.test(text)) {
    return "identity";
  }

  if (/\b(deploy|hosting|infrastructure)\b/i.test(text)) return "deployment";

  return "notes";
}

export function clusterFacts(facts: ScoredFact[]): Map<FactCluster, ScoredFact[]> {
  const clusters = new Map<FactCluster, ScoredFact[]>();

  for (const fact of facts) {
    const cluster = classifyFact(fact);
    const list = clusters.get(cluster) ?? [];
    list.push(fact);
    clusters.set(cluster, list);
  }

  return clusters;
}

export function collectAudienceRoles(facts: ScoredFact[]): string[] {
  const roles: string[] = [];

  for (const fact of facts) {
    const role = extractAudienceRole(fact.text);
    if (role && !roles.some((r) => r.toLowerCase() === role.toLowerCase())) {
      roles.push(role);
    }
  }

  return roles;
}

export function tokenSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const matches = a.filter((t) => setB.has(t)).length;
  return matches / Math.max(a.length, b.length);
}
