import { computeQuestionSimilarity } from "./knowledge-duplicates";
import { generateKeywordsFromQuestion } from "./keyword-generator";
import type { CurriculumAnalysis } from "./lesson-generator";
import type { GeneratedLessonDraft } from "./lesson-generator";
import {
  buildQualityReport,
  type CoverageMapEntry,
  type QualityCriterionScores,
} from "./knowledge-quality-report";
import {
  mapTopicToCoverageConcept,
  MIN_RETRIEVAL_COUNTS,
  ROBOTIC_PHRASES,
  VAGUE_QUESTION_PATTERNS,
  WEAK_QUESTION_PATTERNS,
} from "./knowledge-quality-rules";
import {
  buildRecommendedAnswerTemplate,
  validateKnowledgeWritingStandard,
} from "./knowledge-writing-standard";
import type { AIKnowledgeEntry } from "./types";

export interface QualityScoringContext {
  existingEntries: AIKnowledgeEntry[];
  batchDrafts: Array<Pick<GeneratedLessonDraft, "question" | "intentLabel" | "topicTag">>;
  analysis: CurriculumAnalysis;
  coveredConcepts: Set<string>;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function countUniqueLines(text: string): number {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return new Set(lines).size;
}

export function buildModuleCoverageMap(
  analysis: CurriculumAnalysis,
  existingEntries: AIKnowledgeEntry[],
  batchDrafts: Array<Pick<GeneratedLessonDraft, "question" | "topicTag" | "intentLabel">>,
  currentTopicTag?: string
): CoverageMapEntry[] {
  const concepts = new Set<string>();
  for (const topic of analysis.coveredTopics) {
    concepts.add(mapTopicToCoverageConcept(topic, topic));
  }
  for (const concept of analysis.missingConcepts) {
    concepts.add(mapTopicToCoverageConcept(concept, concept));
  }
  for (const intent of analysis.coveredIntents) {
    concepts.add(intent);
  }
  for (const intent of analysis.missingIntents) {
    concepts.add(intent);
  }

  const covered = new Set<string>([...analysis.coveredIntents]);
  for (const entry of existingEntries) {
    covered.add(mapTopicToCoverageConcept(entry.question.slice(0, 20), entry.intent_name ?? ""));
  }
  for (const draft of batchDrafts) {
    covered.add(mapTopicToCoverageConcept(draft.topicTag, draft.intentLabel));
  }
  if (currentTopicTag) {
    covered.add(mapTopicToCoverageConcept(currentTopicTag, currentTopicTag));
  }

  return [...concepts].slice(0, 12).map((concept) => ({
    concept,
    covered: covered.has(concept) || [...covered].some((c) => c.toLowerCase().includes(concept.toLowerCase())),
  }));
}

export function scoreQuestionQuality(question: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 70;

  const trimmed = question.trim();
  if (!trimmed.endsWith("?")) {
    issues.push("Question should end with a question mark");
    score -= 15;
  }
  if (trimmed.length < 12) {
    issues.push("Question is too short");
    score -= 20;
  }
  if (trimmed.length > 120) {
    issues.push("Question is too long for a single intent");
    score -= 10;
  }

  for (const pattern of VAGUE_QUESTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      issues.push("Question is too vague");
      score -= 25;
      break;
    }
  }
  for (const pattern of WEAK_QUESTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      issues.push("Question lacks specificity");
      score -= 15;
      break;
    }
  }

  if (/\b(adakaro|school|teacher|parent|attendance|report|fee|student)\b/i.test(trimmed)) {
    score += 10;
  }
  if (/^(what|how|can|does|is|are|who|why|when|where)\b/i.test(trimmed)) {
    score += 10;
  }

  return { score: clamp(score), issues };
}

export function scoreDuplicateDetection(
  draft: Pick<GeneratedLessonDraft, "question" | "intentLabel">,
  existingEntries: AIKnowledgeEntry[],
  batchDrafts: Array<Pick<GeneratedLessonDraft, "question" | "intentLabel">>
): { score: number; duplicateRiskPercent: number; issues: string[]; blocked: boolean } {
  const issues: string[] = [];
  let maxSim = 0;

  for (const entry of existingEntries) {
    const { similarity, classification } = computeQuestionSimilarity(draft.question, entry);
    maxSim = Math.max(maxSim, similarity);
    if (similarity >= 0.95 || classification === "exact_duplicate") {
      issues.push(`Exact duplicate of existing lesson: "${entry.question}"`);
    } else if (similarity >= 0.72 && classification !== "different_intent") {
      issues.push(`Near duplicate of: "${entry.question}"`);
    }
  }

  for (const other of batchDrafts) {
    if (other.question === draft.question) continue;
    const pseudo: AIKnowledgeEntry = {
      id: "batch",
      category: "General",
      question: other.question,
      keywords: [],
      search_phrases: [],
      alternative_wording: [],
      synonyms: [],
      related_terms: [],
      answer: "",
      priority: "normal",
      usage_count: 0,
      last_used_at: null,
      status: "active",
      created_by: null,
      created_at: "",
      updated_at: "",
    };
    const { similarity, classification } = computeQuestionSimilarity(draft.question, pseudo);
    maxSim = Math.max(maxSim, similarity);
    if (similarity >= 0.72 && classification !== "different_intent") {
      issues.push(`Similar to another draft: "${other.question}"`);
    }
  }

  const duplicateRiskPercent = Math.round(maxSim * 100);
  const score = clamp(100 - duplicateRiskPercent * 0.85);
  const blocked = maxSim >= 0.95 || duplicateRiskPercent >= 95;

  return { score, duplicateRiskPercent, issues, blocked };
}

export function scoreCurriculumCoverage(
  topicTag: string,
  intentLabel: string,
  analysis: CurriculumAnalysis,
  coveredConcepts: Set<string>
): { score: number; issues: string[] } {
  const concept = mapTopicToCoverageConcept(topicTag, intentLabel);
  const issues: string[] = [];

  if (analysis.missingConcepts.includes(topicTag) || analysis.missingIntents.includes(intentLabel)) {
    return { score: 100, issues: [] };
  }

  if (coveredConcepts.has(concept) || coveredConcepts.has(topicTag)) {
    issues.push(`Concept "${concept}" may already be covered in this module`);
    return { score: 45, issues };
  }

  return { score: 85, issues };
}

export function scoreAnswerQuality(answer: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 75;

  if (answer.length < 120) {
    issues.push("Answer is too short");
    score -= 20;
  }
  if (answer.length > 4000) {
    issues.push("Answer is too long");
    score -= 10;
  }

  const hasOverview = /\*\*overview\*\*|^overview$/im.test(answer);
  const hasBullets = /^-\s/m.test(answer) || /^\*\s/m.test(answer);
  if (hasOverview) score += 8;
  if (hasBullets) score += 8;

  const validation = validateKnowledgeWritingStandard({
    category: "General",
    question: "Q",
    answer,
    keywords: ["adakaro"],
    search_phrases: ["adakaro"],
    alternative_wording: [],
    synonyms: [],
    related_terms: [],
    priority: "normal",
  });

  if (validation.requiredPassed) score += 10;
  score -= validation.issues.length * 8;
  score -= validation.warnings.length * 3;

  const uniqueRatio = countUniqueLines(answer) / Math.max(1, answer.split("\n").length);
  if (uniqueRatio < 0.6) {
    issues.push("Answer contains repetitive content");
    score -= 12;
  }

  return { score: clamp(score), issues };
}

export function scoreRetrievalQuality(draft: Pick<GeneratedLessonDraft, "keywords" | "synonyms" | "search_phrases" | "alternative_wording" | "related_terms">): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  if (draft.keywords.length < MIN_RETRIEVAL_COUNTS.keywords) {
    issues.push("Insufficient keywords");
    score -= 20;
  }
  if (draft.synonyms.length < MIN_RETRIEVAL_COUNTS.synonyms) {
    issues.push("Insufficient synonyms");
    score -= 15;
  }
  if (draft.search_phrases.length < MIN_RETRIEVAL_COUNTS.search_phrases) {
    issues.push("Insufficient search phrases");
    score -= 15;
  }
  if (draft.alternative_wording.length < MIN_RETRIEVAL_COUNTS.alternative_wording) {
    issues.push("Missing alternative wording");
    score -= 10;
  }
  if (draft.related_terms.length < MIN_RETRIEVAL_COUNTS.related_terms) {
    issues.push("Insufficient related terms");
    score -= 10;
  }

  return { score: clamp(score), issues };
}

export function scoreWritingStandard(
  draft: Pick<
    GeneratedLessonDraft,
    "category" | "question" | "answer" | "keywords" | "search_phrases" | "alternative_wording" | "synonyms" | "related_terms" | "priority" | "intentKey"
  >
): { score: number; issues: string[] } {
  const validation = validateKnowledgeWritingStandard({
    category: draft.category,
    question: draft.question,
    answer: draft.answer,
    keywords: draft.keywords,
    search_phrases: draft.search_phrases,
    alternative_wording: draft.alternative_wording,
    synonyms: draft.synonyms,
    related_terms: draft.related_terms,
    priority: draft.priority,
    intent_key: draft.intentKey,
  });

  let score = validation.requiredPassed ? 92 : 58;
  score -= validation.issues.length * 10;
  score -= validation.warnings.length * 4;

  return { score: clamp(score), issues: validation.issues };
}

export function scoreHumanReadability(answer: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 88;

  for (const phrase of ROBOTIC_PHRASES) {
    if (phrase.test(answer)) {
      issues.push("Answer contains robotic phrasing");
      score -= 12;
    }
  }

  const words = answer.toLowerCase().split(/\s+/);
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 5) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const stuffed = [...freq.values()].filter((c) => c > 8).length;
  if (stuffed > 0) {
    issues.push("Possible keyword stuffing");
    score -= 15;
  }

  return { score: clamp(score), issues };
}

export function scoreKnowledgeHealth(
  draft: Pick<
    GeneratedLessonDraft,
    "category" | "priority" | "keywords" | "synonyms" | "search_phrases" | "related_terms"
  >
): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  if (!draft.category?.trim()) {
    issues.push("Missing category");
    score -= 25;
  }
  if (!draft.priority) {
    issues.push("Missing priority");
    score -= 15;
  }
  if (draft.keywords.length < 3) score -= 15;
  if (draft.synonyms.length < 1) score -= 10;
  if (draft.search_phrases.length < 1) score -= 10;
  if (draft.related_terms.length < 1) score -= 10;

  return { score: clamp(score), issues };
}

export function scoreLessonDraft(
  draft: GeneratedLessonDraft,
  context: QualityScoringContext
): ReturnType<typeof buildQualityReport> {
  const allIssues: string[] = [];

  const q = scoreQuestionQuality(draft.question);
  allIssues.push(...q.issues);

  const dup = scoreDuplicateDetection(draft, context.existingEntries, context.batchDrafts);
  allIssues.push(...dup.issues);

  const cov = scoreCurriculumCoverage(
    draft.topicTag,
    draft.intentLabel,
    context.analysis,
    context.coveredConcepts
  );
  allIssues.push(...cov.issues);

  const ans = scoreAnswerQuality(draft.answer);
  allIssues.push(...ans.issues);

  const ret = scoreRetrievalQuality(draft);
  allIssues.push(...ret.issues);

  const wr = scoreWritingStandard(draft);
  allIssues.push(...wr.issues);

  const read = scoreHumanReadability(draft.answer);
  allIssues.push(...read.issues);

  const health = scoreKnowledgeHealth(draft);
  allIssues.push(...health.issues);

  const criteria: QualityCriterionScores = {
    questionQuality: q.score,
    duplicateDetection: dup.score,
    curriculumCoverage: cov.score,
    answerQuality: ans.score,
    retrievalQuality: ret.score,
    writingStandard: wr.score,
    humanReadability: read.score,
    knowledgeHealth: health.score,
  };

  const coverageMap = buildModuleCoverageMap(
    context.analysis,
    context.existingEntries,
    context.batchDrafts,
    draft.topicTag
  );

  return buildQualityReport({
    criteria,
    duplicateRiskPercent: dup.duplicateRiskPercent,
    issues: [...new Set(allIssues)],
    improvementsApplied: [],
    attempts: 0,
    coverageMap,
    forceRejected: dup.blocked,
  });
}

export function improveLessonDraft(
  draft: GeneratedLessonDraft,
  report: ReturnType<typeof buildQualityReport>,
  category: string
): { draft: GeneratedLessonDraft; improvements: string[] } {
  const improvements: string[] = [];
  let next = { ...draft };

  if (report.criteria.retrievalQuality < 90) {
    const kw = generateKeywordsFromQuestion(next.question, category);
    next = {
      ...next,
      keywords: [...new Set([...next.keywords, ...kw.keywords])].slice(0, 12),
      synonyms: [...new Set([...next.synonyms, ...kw.synonyms])].slice(0, 8),
      search_phrases: [...new Set([...next.search_phrases, ...kw.search_phrases])].slice(0, 8),
      alternative_wording: [...new Set([...next.alternative_wording, ...kw.alternative_wording])].slice(0, 6),
      related_terms: [...new Set([...next.related_terms, ...kw.related_terms])].slice(0, 8),
    };
    improvements.push("Expanded retrieval metadata");
  }

  if (report.criteria.answerQuality < 90 || report.criteria.writingStandard < 90) {
    if (!next.answer.includes("**Overview**")) {
      const template = buildRecommendedAnswerTemplate(next.question);
      next = {
        ...next,
        answer: next.answer.length > 150 ? next.answer : template,
      };
      improvements.push("Applied Knowledge Writing Standard structure");
    }
  }

  if (report.criteria.humanReadability < 90) {
    let answer = next.answer;
    for (const phrase of ROBOTIC_PHRASES) {
      answer = answer.replace(phrase, "");
    }
    next = { ...next, answer: answer.replace(/\n{3,}/g, "\n\n").trim() };
    improvements.push("Removed robotic phrasing");
  }

  if (report.criteria.questionQuality < 90 && !next.question.endsWith("?")) {
    next = { ...next, question: `${next.question.trim()}?` };
    improvements.push("Normalized question format");
  }

  return { draft: next, improvements };
}
