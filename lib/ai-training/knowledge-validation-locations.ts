/**
 * Location-aware validation — maps issues to exact editor positions.
 */

import { detectSemanticSections } from "./knowledge-answer-structure";

export interface ValidationIssueLocation {
  section: "Answer" | "Question" | "Metadata";
  field: string;
  paragraphIndex: number;
  sentenceIndex: number;
  charStart: number;
  charEnd: number;
}

export interface ValidationIssue {
  id: string;
  ruleId: string;
  ruleLabel: string;
  location: ValidationIssueLocation;
  original: string;
  suggestion: string;
  reason: string;
  fixable: boolean;
}

export interface GroupedValidationIssue {
  id: string;
  ruleId: string;
  ruleLabel: string;
  field: string;
  count: number;
  summary: string;
  examples: string[];
  issues: ValidationIssue[];
  fixable: boolean;
}

interface ParsedSentence {
  text: string;
  charStart: number;
  charEnd: number;
  sectionTitle: string;
  paragraphIndex: number;
  sentenceIndex: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSectionHeading(line: string): string | null {
  const trimmed = line.trim();
  const bold = trimmed.match(/^\*\*([^*]+)\*\*$/);
  if (bold) return bold[1]!.trim();
  const heading = trimmed.match(/^#{1,3}\s+(.+?)\s*$/);
  if (heading) return heading[1]!.trim();
  const colon = trimmed.match(/^([A-Za-z][A-Za-z0-9 &/()-]{2,50}):\s*$/);
  if (colon) return colon[1]!.trim();
  return null;
}

function splitLineIntoSentences(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  if (/^[-•*]\s+/.test(trimmed)) return [trimmed];
  if (trimmed.startsWith("**") && trimmed.endsWith("**")) return [trimmed];

  const parts = trimmed.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [trimmed];
}

/** Parse answer text into sentences with section / paragraph / char offsets. */
export function parseAnswerSentences(answer: string): ParsedSentence[] {
  const lines = answer.split("\n");
  const sentences: ParsedSentence[] = [];
  let charOffset = 0;
  let currentSection = "Overview";
  let paragraphIndex = 0;
  let paragraphSentenceCount = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!;
    const lineStart = charOffset;
    const lineEnd = charOffset + line.length;

    const heading = isSectionHeading(line);
    if (heading) {
      currentSection = heading;
      paragraphIndex = 0;
      paragraphSentenceCount = 0;
      charOffset = lineEnd + (lineIndex < lines.length - 1 ? 1 : 0);
      continue;
    }

    if (!line.trim()) {
      if (paragraphSentenceCount > 0) {
        paragraphIndex += 1;
        paragraphSentenceCount = 0;
      }
      charOffset = lineEnd + (lineIndex < lines.length - 1 ? 1 : 0);
      continue;
    }

    const lineSentences = splitLineIntoSentences(line);
    let cursor = lineStart;

    for (let sentenceIndex = 0; sentenceIndex < lineSentences.length; sentenceIndex++) {
      const sentenceText = lineSentences[sentenceIndex]!;
      const indexInLine = line.indexOf(sentenceText, cursor - lineStart);
      const start = indexInLine >= 0 ? lineStart + indexInLine : cursor;
      const end = start + sentenceText.length;

      sentences.push({
        text: sentenceText,
        charStart: start,
        charEnd: end,
        sectionTitle: currentSection,
        paragraphIndex,
        sentenceIndex: paragraphSentenceCount,
      });

      paragraphSentenceCount += 1;
      cursor = end;
    }

    charOffset = lineEnd + (lineIndex < lines.length - 1 ? 1 : 0);
  }

  return sentences;
}

export function locateCharInAnswer(
  answer: string,
  charIndex: number
): Omit<ValidationIssueLocation, "section" | "field"> {
  const sentences = parseAnswerSentences(answer);
  const match =
    sentences.find((s) => charIndex >= s.charStart && charIndex < s.charEnd) ??
    sentences.find((s) => charIndex <= s.charEnd);

  if (match) {
    return {
      paragraphIndex: match.paragraphIndex,
      sentenceIndex: match.sentenceIndex,
      charStart: match.charStart,
      charEnd: match.charEnd,
    };
  }

  return {
    paragraphIndex: 0,
    sentenceIndex: 0,
    charStart: Math.max(0, Math.min(charIndex, answer.length)),
    charEnd: Math.min(answer.length, charIndex + 1),
  };
}

export function locatePhraseInAnswer(
  answer: string,
  phrase: string
): ValidationIssueLocation | null {
  const pattern = new RegExp(escapeRegex(phrase), "i");
  const match = pattern.exec(answer);
  if (!match || match.index === undefined) return null;

  const charIndex = match.index;
  const located = locateCharInAnswer(answer, charIndex);
  const sentences = parseAnswerSentences(answer);
  const sentence =
    sentences.find((s) => charIndex >= s.charStart && charIndex < s.charEnd) ??
    sentences.find((s) => s.text.toLowerCase().includes(phrase.toLowerCase()));

  return {
    section: "Answer",
    field: sentence?.sectionTitle ?? inferSectionForIndex(answer, charIndex),
    paragraphIndex: located.paragraphIndex,
    sentenceIndex: located.sentenceIndex,
    charStart: sentence?.charStart ?? located.charStart,
    charEnd: sentence?.charEnd ?? located.charEnd,
  };
}

function inferSectionForIndex(answer: string, charIndex: number): string {
  const sections = detectSemanticSections(answer);
  if (sections.length === 0) return "Answer";

  let last = sections[0]!.title;
  let offset = 0;
  for (const line of answer.split("\n")) {
    const heading = isSectionHeading(line);
    if (heading) last = heading;
    offset += line.length + 1;
    if (offset > charIndex) break;
  }
  return last;
}

export function locateSentenceInAnswer(
  answer: string,
  sentenceFragment: string
): ValidationIssueLocation | null {
  const normalized = sentenceFragment.trim().toLowerCase();
  if (!normalized) return null;

  const sentences = parseAnswerSentences(answer);
  const exact = sentences.find((s) => s.text.trim().toLowerCase() === normalized);
  if (exact) {
    return {
      section: "Answer",
      field: exact.sectionTitle,
      paragraphIndex: exact.paragraphIndex,
      sentenceIndex: exact.sentenceIndex,
      charStart: exact.charStart,
      charEnd: exact.charEnd,
    };
  }

  const partial = sentences.find((s) => {
    const t = s.text.trim().toLowerCase();
    return t.includes(normalized) || normalized.includes(t);
  });
  if (partial) {
    return {
      section: "Answer",
      field: partial.sectionTitle,
      paragraphIndex: partial.paragraphIndex,
      sentenceIndex: partial.sentenceIndex,
      charStart: partial.charStart,
      charEnd: partial.charEnd,
    };
  }

  return locatePhraseInAnswer(answer, sentenceFragment);
}

export function locateQuestionIssue(question: string): ValidationIssueLocation {
  return {
    section: "Question",
    field: "Question",
    paragraphIndex: 0,
    sentenceIndex: 0,
    charStart: 0,
    charEnd: question.length,
  };
}

export function locateMetadataLine(
  field: string,
  lineIndex: number,
  lineText: string,
  fullText: string
): ValidationIssueLocation {
  const lines = fullText.split("\n");
  let charStart = 0;
  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    charStart += lines[i]!.length + 1;
  }
  const line = lines[lineIndex] ?? lineText;
  return {
    section: "Metadata",
    field,
    paragraphIndex: lineIndex,
    sentenceIndex: 0,
    charStart,
    charEnd: charStart + line.length,
  };
}

export function applyWordSuggestionToSentence(
  sentence: string,
  word: string,
  suggestion: string
): string {
  const pattern = new RegExp(escapeRegex(word), "i");
  if (!suggestion || suggestion === "(remove)") {
    return sentence
      .replace(pattern, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.!?])/g, "$1")
      .trim();
  }
  return sentence.replace(pattern, (match) => {
    if (match[0] === match[0].toUpperCase() && suggestion[0]) {
      return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
    }
    return suggestion;
  });
}

export function replaceTextRange(text: string, start: number, end: number, replacement: string): string {
  return text.slice(0, start) + replacement + text.slice(end);
}

export function replaceSentenceAtLocation(
  text: string,
  location: ValidationIssueLocation,
  newSentence: string
): string {
  return replaceTextRange(text, location.charStart, location.charEnd, newSentence);
}

export function buildIssueId(ruleId: string, location: ValidationIssueLocation, original: string): string {
  return `${ruleId}:${location.section}:${location.field}:${location.paragraphIndex}:${location.sentenceIndex}:${original.slice(0, 40)}`;
}

export function getEditorStepId(issue: ValidationIssue): string {
  if (issue.location.section === "Metadata") return "generate-metadata";
  if (issue.location.section === "Question") return "question";
  return "author-review";
}
