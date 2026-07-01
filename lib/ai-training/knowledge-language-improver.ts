/**
 * Enterprise language improvement — professional tone, timeless wording, structure.
 */

export type AnswerImproveAction =
  | "improve_professional_tone"
  | "improve_structure"
  | "make_more_concise"
  | "expand_explanation"
  | "remove_marketing_language"
  | "make_timeless"
  | "fix_grammar"
  | "improve_readability";

import type { ValidationIssueLocation } from "./knowledge-validation-locations";
import { locateCharInAnswer } from "./knowledge-validation-locations";

export interface LanguageIssue {
  word: string;
  category: "marketing" | "timeless" | "conversational";
  suggestion: string;
  sentence: string;
  reason: string;
  charIndex?: number;
  location?: ValidationIssueLocation;
}

export interface LanguageAnalysis {
  marketingIssues: LanguageIssue[];
  timelessIssues: LanguageIssue[];
  conversationalIssues: LanguageIssue[];
  score: number;
}

/** Genuinely promotional wording only — not neutral documentation terms. */
export const PROFESSIONAL_REPLACEMENTS: Record<string, string> = {
  best: "appropriate",
  "world-class": "enterprise-grade",
  "industry-leading": "widely used",
  revolutionary: "significant",
  "next-generation": "modern",
  powerful: "comprehensive",
  amazing: "effective",
  effortless: "streamlined",
  seamless: "integrated",
  ultimate: "primary",
  leading: "established",
  smart: "automated",
  "intelligent assistant": "automated assistant",
  "game-changing": "significant",
  "game-changer": "significant improvement",
  unmatched: "distinct",
};

const MARKETING_REASONS: Record<string, string> = {
  best: "Marketing adjective.",
  "world-class": "Promotional superlative.",
  "industry-leading": "Promotional superlative.",
  revolutionary: "Hype language.",
  "next-generation": "Marketing buzzword.",
  powerful: "Promotional adjective.",
  amazing: "Hype language.",
  effortless: "Promotional adjective.",
  seamless: "Marketing buzzword.",
  ultimate: "Promotional superlative.",
  leading: "Promotional superlative.",
  smart: "Marketing buzzword.",
  "intelligent assistant": "Marketing product language.",
  "game-changing": "Hype language.",
  "game-changer": "Hype language.",
  unmatched: "Promotional superlative.",
};

/** Phrases that use marketing words in acceptable technical contexts. */
const MARKETING_ALLOWLIST: RegExp[] = [
  /\bbest practices?\b/i,
  /\bbest practice\b/i,
];

interface TimelessPattern {
  pattern: RegExp;
  phrase: string;
  suggestion: string;
  reason: string;
}

/** Actual temporal references — not neutral documentation phrasing. */
const TIMELESS_PATTERNS: TimelessPattern[] = [
  { pattern: /\bcurrently\b/i, phrase: "currently", suggestion: "(remove)", reason: "Temporal reference." },
  { pattern: /\btoday\b/i, phrase: "today", suggestion: "(remove)", reason: "Temporal reference." },
  { pattern: /\b(right now|as of now)\b/i, phrase: "now", suggestion: "(remove)", reason: "Temporal reference." },
  { pattern: /\bas of\b/i, phrase: "as of", suggestion: "(remove)", reason: "Temporal reference." },
  { pattern: /\blatest\b/i, phrase: "latest", suggestion: "current", reason: "Temporal reference." },
  { pattern: /\bcoming soon\b/i, phrase: "coming soon", suggestion: "planned", reason: "Temporal reference." },
  { pattern: /\bthis year\b/i, phrase: "this year", suggestion: "(remove)", reason: "Temporal reference." },
  { pattern: /\bnext release\b/i, phrase: "next release", suggestion: "planned release", reason: "Temporal reference." },
  { pattern: /\brecently\b/i, phrase: "recently", suggestion: "(remove)", reason: "Temporal reference." },
  { pattern: /\bfuture\b/i, phrase: "future", suggestion: "(remove)", reason: "Temporal reference." },
  {
    pattern: /\b(the new|brand new|new feature|new version|new update|new release|new capability|new module)\b/i,
    phrase: "new",
    suggestion: "available",
    reason: "Temporal product reference.",
  },
  {
    pattern: /(?<![a-zA-Z])now(?![a-zA-Z])/i,
    phrase: "now",
    suggestion: "(remove)",
    reason: "Temporal reference.",
  },
];

const CONVERSATIONAL_PATTERNS: Array<{ pattern: RegExp; replacement: string; reason: string }> = [
  { pattern: /\bi'?d be happy to help\b/gi, replacement: "", reason: "Conversational chatbot phrasing." },
  { pattern: /\bif you'?d like\b/gi, replacement: "", reason: "Conversational chatbot phrasing." },
  { pattern: /\blet me know\b/gi, replacement: "", reason: "Conversational chatbot phrasing." },
  { pattern: /\bfeel free to\b/gi, replacement: "", reason: "Conversational chatbot phrasing." },
  { pattern: /\bthank you for asking\b/gi, replacement: "", reason: "Conversational chatbot phrasing." },
  { pattern: /\bi hope this helps\b/gi, replacement: "", reason: "Conversational chatbot phrasing." },
  { pattern: /\bhello\b/gi, replacement: "", reason: "Greeting — use facts only." },
  { pattern: /\bhi there\b/gi, replacement: "", reason: "Greeting — use facts only." },
];

function escapeRegex(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncateSentence(sentence: string, max = 140): string {
  const trimmed = sentence.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3).trimEnd()}...`;
}

function findSentenceForMatch(text: string, phrase: string, charIndex?: number): string {
  if (charIndex !== undefined) {
    const located = locateCharInAnswer(text, charIndex);
    return truncateSentence(text.slice(located.charStart, located.charEnd));
  }

  const lines = text.split("\n");
  for (const line of lines) {
    const pattern = new RegExp(escapeRegex(phrase), "i");
    if (pattern.test(line)) {
      return truncateSentence(line);
    }
  }

  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  for (const sentence of sentences) {
    const pattern = new RegExp(escapeRegex(phrase), "i");
    if (pattern.test(sentence)) {
      return truncateSentence(sentence);
    }
  }

  return truncateSentence(text);
}

function buildLanguageIssueLocation(
  text: string,
  charIndex: number
): ValidationIssueLocation {
  const located = locateCharInAnswer(text, charIndex);
  const sentenceText = text.slice(located.charStart, located.charEnd);

  let sectionTitle = "Answer";
  let offset = 0;
  for (const line of text.split("\n")) {
    const bold = line.trim().match(/^\*\*([^*]+)\*\*$/);
    if (bold) sectionTitle = bold[1]!.trim();
    if (offset + line.length >= charIndex) break;
    offset += line.length + 1;
  }

  return {
    section: "Answer",
    field: sectionTitle,
    paragraphIndex: located.paragraphIndex,
    sentenceIndex: located.sentenceIndex,
    charStart: located.charStart,
    charEnd: located.charEnd,
  };
}

function isAllowlistedMarketing(text: string, phrase: string, index: number): boolean {
  for (const allow of MARKETING_ALLOWLIST) {
    const match = text.match(allow);
    if (!match || match.index === undefined) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (index >= start && index < end) return true;
  }
  return false;
}

function findMarketingIssues(text: string): LanguageIssue[] {
  const issues: LanguageIssue[] = [];
  const seen = new Set<string>();

  const phrases = Object.keys(PROFESSIONAL_REPLACEMENTS).sort((a, b) => b.length - a.length);

  for (const phrase of phrases) {
    const pattern = new RegExp(escapeRegex(phrase), "gi");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (isAllowlistedMarketing(text, phrase, match.index)) continue;

      const key = `${phrase}:${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);

      issues.push({
        word: match[0],
        category: "marketing",
        suggestion: PROFESSIONAL_REPLACEMENTS[phrase],
        sentence: findSentenceForMatch(text, match[0], match.index),
        reason: MARKETING_REASONS[phrase] ?? "Marketing language.",
        charIndex: match.index,
        location: buildLanguageIssueLocation(text, match.index),
      });
    }
  }

  return issues;
}

function findTimelessIssues(text: string): LanguageIssue[] {
  const issues: LanguageIssue[] = [];
  const seen = new Set<string>();

  for (const { pattern, phrase, suggestion, reason } of TIMELESS_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const key = `${phrase}:${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);

      issues.push({
        word: match[0],
        category: "timeless",
        suggestion,
        sentence: findSentenceForMatch(text, match[0], match.index),
        reason,
        charIndex: match.index,
        location: buildLanguageIssueLocation(text, match.index),
      });
    }
  }

  return issues;
}

export function analyzeAnswerLanguage(answer: string): LanguageAnalysis {
  const marketingIssues = findMarketingIssues(answer);
  const timelessIssues = findTimelessIssues(answer);

  const conversationalIssues: LanguageIssue[] = [];
  for (const { pattern, reason } of CONVERSATIONAL_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    const match = regex.exec(answer);
    if (match && match.index !== undefined) {
      conversationalIssues.push({
        word: match[0],
        category: "conversational",
        suggestion: "Remove conversational phrasing",
        sentence: findSentenceForMatch(answer, match[0], match.index),
        reason,
        charIndex: match.index,
        location: buildLanguageIssueLocation(answer, match.index),
      });
    }
  }

  const penalty = marketingIssues.length * 8 + timelessIssues.length * 5 + conversationalIssues.length * 10;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return { marketingIssues, timelessIssues, conversationalIssues, score };
}

function applyReplacements(text: string, map: Record<string, string>): string {
  let result = text;
  const phrases = Object.keys(map).sort((a, b) => b.length - a.length);

  for (const phrase of phrases) {
    const replacement = map[phrase];
    const pattern = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
    result = result.replace(pattern, (match) => {
      if (!replacement) return "";
      if (match[0] === match[0].toUpperCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }

  return result
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/g, ""))
    .join("\n")
    .trimEnd();
}

function applyTimelessFixes(text: string): string {
  let result = text;
  for (const { pattern, suggestion } of TIMELESS_PATTERNS) {
    result = result.replace(pattern, (match) => {
      if (!suggestion || suggestion === "(remove)") return "";
      if (match[0] === match[0].toUpperCase()) {
        return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
      }
      return suggestion;
    });
  }
  return result;
}

export function autoFixProfessionalLanguage(answer: string): string {
  let result = applyReplacements(answer, PROFESSIONAL_REPLACEMENTS);
  for (const { pattern, replacement } of CONVERSATIONAL_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return cleanupAnswer(result);
}

export function autoFixTimelessWording(answer: string): string {
  return cleanupAnswer(applyTimelessFixes(answer));
}

function cleanupAnswer(text: string): string {
  return text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/  +/g, " ")
    .trim();
}

export function improveAnswerStructure(answer: string, question: string): string {
  const trimmed = answer.trim();
  if (!trimmed) {
    return buildStructureTemplate(question);
  }

  const lower = trimmed.toLowerCase();
  const sections = ["Overview", "Core Facts", "Key Capabilities", "Benefits", "Related Features"];
  const missing = sections.filter((s) => !lower.includes(s.toLowerCase()));

  if (missing.length === 0) return trimmed;

  let result = trimmed;
  if (!lower.includes("overview")) {
    result = `**Overview**\n\n${trimmed.split("\n\n")[0] ?? trimmed}\n\n${result}`;
  }
  if (!lower.includes("core facts") && !lower.includes("key capabilities")) {
    result += `\n\n**Core Facts**\n\n- Key fact about ${question.replace(/\?+$/, "")}\n`;
  }
  return cleanupAnswer(result);
}

function buildStructureTemplate(question: string): string {
  const topic = question.replace(/\?+$/, "").trim() || "Topic";
  return [
    "**Overview**",
    "",
    `${topic} — direct summary.`,
    "",
    "**Core Facts**",
    "",
    "- Fact one",
    "- Fact two",
    "",
    "**Key Capabilities**",
    "",
    "- Capability one",
  ].join("\n");
}

export function makeAnswerConcise(answer: string): string {
  return cleanupAnswer(
    answer
      .replace(/\b(in order to|for the purpose of)\b/gi, "to")
      .replace(/\b(it is important to note that|please note that)\b/gi, "")
      .replace(/\b(as a matter of fact|the fact of the matter is)\b/gi, "")
      .split("\n")
      .map((line) => {
        if (line.length > 220 && !line.startsWith("**")) {
          return line.slice(0, 217).trimEnd() + "…";
        }
        return line;
      })
      .join("\n")
  );
}

export function expandAnswerExplanation(answer: string, question: string): string {
  const trimmed = answer.trim();
  if (trimmed.length >= 200) return trimmed;

  const topic = question.replace(/\?+$/, "").trim();
  return cleanupAnswer(
    `${trimmed}\n\n**Additional Details**\n\n- ${topic} supports standard school workflows.\n- Administrators configure settings from the dashboard.\n- Teachers and parents access relevant views based on their roles.`
  );
}

export function fixAnswerGrammar(answer: string): string {
  return cleanupAnswer(
    answer
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/([a-z]),([A-Z])/g, "$1, $2")
      .replace(/\bi\b/g, "I")
      .replace(/\badakaro\b/gi, "Adakaro")
  );
}

export function improveAnswerReadability(answer: string): string {
  const lines = answer.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push("");
      continue;
    }
    if (trimmed.startsWith("**") || trimmed.startsWith("-") || trimmed.startsWith("•")) {
      result.push(line);
      continue;
    }
    if (trimmed.length > 160 && !trimmed.includes("- ")) {
      const sentences = trimmed.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (sentence.trim()) result.push(sentence.trim());
      }
    } else {
      result.push(line);
    }
  }

  return cleanupAnswer(result.join("\n"));
}

export function improveAnswer(
  answer: string,
  question: string,
  action: AnswerImproveAction
): { answer: string; confidence: number } {
  let result = answer;
  switch (action) {
    case "improve_professional_tone":
      result = autoFixProfessionalLanguage(answer);
      break;
    case "remove_marketing_language":
      result = autoFixProfessionalLanguage(answer);
      break;
    case "make_timeless":
      result = autoFixTimelessWording(autoFixProfessionalLanguage(answer));
      break;
    case "improve_structure":
      result = improveAnswerStructure(answer, question);
      break;
    case "make_more_concise":
      result = makeAnswerConcise(answer);
      break;
    case "expand_explanation":
      result = expandAnswerExplanation(answer, question);
      break;
    case "fix_grammar":
      result = fixAnswerGrammar(answer);
      break;
    case "improve_readability":
      result = improveAnswerReadability(answer);
      break;
    default:
      result = answer;
  }

  const analysis = analyzeAnswerLanguage(result);
  return { answer: cleanupAnswer(result), confidence: analysis.score };
}
