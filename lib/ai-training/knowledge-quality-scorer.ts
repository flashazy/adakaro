import { computeQuestionSimilarity } from "./knowledge-duplicates";
import { generateKeywordsFromQuestion } from "./keyword-generator";
import type { CurriculumAnalysis } from "./lesson-generator";
import type { GeneratedLessonDraft } from "./lesson-generator";
import {
  buildQualityReport,
  type CalibrationAdjustment,
  type CoverageMapEntry,
  type CriterionDeduction,
  type QualityCriterionScores,
} from "./knowledge-quality-report";
import {
  IDEAL_RETRIEVAL_COUNTS,
  isCalibrationModeEnabled,
  mapTopicToCoverageConcept,
  MIN_RETRIEVAL_COUNTS,
  QUALITY_CRITERION_WEIGHTS,
  ROBOTIC_PHRASES,
  USEFUL_QUESTION_PATTERNS,
  VAGUE_QUESTION_PATTERNS,
  WEAK_QUESTION_PATTERNS,
  type QualityCriterionKey,
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
  calibrationMode?: boolean;
}

interface ScoredCriterion {
  score: number;
  issues: string[];
  deductions: CriterionDeduction[];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function deduct(
  score: number,
  points: number,
  reason: string,
  deductions: CriterionDeduction[],
  issues: string[]
): number {
  if (points <= 0) return score;
  deductions.push({ reason, points });
  issues.push(reason);
  return score - points;
}

function reward(score: number, points: number): number {
  return Math.min(100, score + points);
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
    covered:
      covered.has(concept) ||
      [...covered].some((c) => c.toLowerCase().includes(concept.toLowerCase())),
  }));
}

export function scoreQuestionQuality(question: string): ScoredCriterion {
  const issues: string[] = [];
  const deductions: CriterionDeduction[] = [];
  let score = 88;

  const trimmed = question.trim();
  if (!trimmed.endsWith("?")) {
    score = deduct(score, 8, "Question should end with a question mark", deductions, issues);
  }

  if (trimmed.length < 8) {
    score = deduct(score, 18, "Question is too short to be clear", deductions, issues);
  } else if (trimmed.length < 12) {
    score = deduct(score, 4, "Question is brief — ensure intent is clear", deductions, issues);
  }

  if (trimmed.length > 140) {
    score = deduct(score, 6, "Question is long for a single intent", deductions, issues);
  }

  for (const pattern of VAGUE_QUESTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      score = deduct(score, 20, "Question is too vague", deductions, issues);
      break;
    }
  }

  for (const pattern of WEAK_QUESTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      score = deduct(score, 12, "Question lacks specificity", deductions, issues);
      break;
    }
  }

  let usefulSignals = 0;
  for (const pattern of USEFUL_QUESTION_PATTERNS) {
    if (pattern.test(trimmed)) usefulSignals++;
  }
  if (usefulSignals >= 2) {
    score = reward(score, 8);
  } else if (usefulSignals === 1) {
    score = reward(score, 4);
  }

  if (/^(why|what|how|can|does|is|are)\b/i.test(trimmed)) {
    score = reward(score, 4);
  }

  return { score: clamp(score), issues, deductions };
}

export function scoreDuplicateDetection(
  draft: Pick<GeneratedLessonDraft, "question" | "intentLabel">,
  existingEntries: AIKnowledgeEntry[],
  batchDrafts: Array<Pick<GeneratedLessonDraft, "question" | "intentLabel">>
): ScoredCriterion & {
  duplicateRiskPercent: number;
  blocked: boolean;
  duplicateFalsePositive: boolean;
} {
  const issues: string[] = [];
  const deductions: CriterionDeduction[] = [];
  let maxSim = 0;
  let duplicateFalsePositive = false;
  let score = 100;

  const assessPair = (
    otherQuestion: string,
    otherEntry: AIKnowledgeEntry | null,
    source: string
  ) => {
    const target =
      otherEntry ??
      ({
        id: "batch",
        category: "General",
        question: otherQuestion,
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
      } satisfies AIKnowledgeEntry);

    const { similarity, classification } = computeQuestionSimilarity(draft.question, target);
    maxSim = Math.max(maxSim, classification === "different_intent" ? 0 : similarity);

    if (classification === "different_intent") {
      if (similarity >= 0.65) duplicateFalsePositive = true;
      return;
    }

    if (similarity >= 0.95 || classification === "exact_duplicate") {
      score = deduct(
        score,
        55,
        `Exact duplicate of ${source}: "${otherQuestion.slice(0, 60)}"`,
        deductions,
        issues
      );
    } else if (similarity >= 0.88 && classification === "near_duplicate") {
      score = deduct(
        score,
        25,
        `Very similar same-intent ${source}: "${otherQuestion.slice(0, 60)}"`,
        deductions,
        issues
      );
    } else if (similarity >= 0.82) {
      score = deduct(
        score,
        12,
        `Similar phrasing to ${source}: "${otherQuestion.slice(0, 60)}"`,
        deductions,
        issues
      );
    }
  };

  for (const entry of existingEntries) {
    assessPair(entry.question, entry, "existing lesson");
  }

  for (const other of batchDrafts) {
    if (other.question === draft.question) continue;
    assessPair(other.question, null, "another draft");
  }

  const duplicateRiskPercent = Math.round(maxSim * 100);
  const blocked =
    duplicateRiskPercent >= 95 ||
    issues.some((i) => i.startsWith("Exact duplicate"));

  return { score: clamp(score), duplicateRiskPercent, issues, deductions, blocked, duplicateFalsePositive };
}

export function scoreCurriculumCoverage(
  topicTag: string,
  intentLabel: string,
  analysis: CurriculumAnalysis,
  coveredConcepts: Set<string>
): ScoredCriterion {
  const concept = mapTopicToCoverageConcept(topicTag, intentLabel);
  const issues: string[] = [];
  const deductions: CriterionDeduction[] = [];
  let score = 92;

  if (
    analysis.missingConcepts.includes(topicTag) ||
    analysis.missingIntents.includes(intentLabel)
  ) {
    return { score: 100, issues: [], deductions: [] };
  }

  if (coveredConcepts.has(concept) || coveredConcepts.has(topicTag)) {
    score = deduct(
      score,
      6,
      `Related concept "${concept}" appears elsewhere — focused angle still valuable`,
      deductions,
      issues
    );
  }

  if (analysis.coveredTopics.includes(topicTag) || analysis.coveredIntents.includes(intentLabel)) {
    score = deduct(
      score,
      4,
      "Topic already represented in curriculum — ensure this adds a distinct angle",
      deductions,
      issues
    );
  }

  return { score: clamp(score), issues, deductions };
}

export function scoreAnswerQuality(answer: string): ScoredCriterion {
  const issues: string[] = [];
  const deductions: CriterionDeduction[] = [];
  let score = 88;

  if (answer.length < 60) {
    score = deduct(score, 18, "Answer is too brief to be useful", deductions, issues);
  } else if (answer.length < 100) {
    score = deduct(score, 6, "Answer is concise — verify completeness", deductions, issues);
  }

  if (answer.length > 4500) {
    score = deduct(score, 8, "Answer is very long", deductions, issues);
  }

  const hasOverview = /\*\*overview\*\*|^overview$/im.test(answer);
  const hasBullets = /^-\s/m.test(answer) || /^\*\s/m.test(answer);
  if (hasOverview) score = reward(score, 5);
  if (hasBullets) score = reward(score, 5);

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

  if (validation.requiredPassed) score = reward(score, 6);
  score -= validation.issues.length * 4;
  for (const issue of validation.issues) {
    deductions.push({ reason: issue, points: 4 });
    issues.push(issue);
  }
  score -= validation.warnings.length * 2;

  const uniqueRatio = countUniqueLines(answer) / Math.max(1, answer.split("\n").length);
  if (uniqueRatio < 0.5) {
    score = deduct(score, 8, "Answer contains repetitive content", deductions, issues);
  }

  return { score: clamp(score), issues, deductions };
}

export function scoreRetrievalQuality(
  draft: Pick<
    GeneratedLessonDraft,
    "keywords" | "synonyms" | "search_phrases" | "alternative_wording" | "related_terms"
  >
): ScoredCriterion {
  const issues: string[] = [];
  const deductions: CriterionDeduction[] = [];
  let score = 96;

  const fields: Array<{
    key: keyof typeof MIN_RETRIEVAL_COUNTS;
    count: number;
    min: number;
    ideal: number;
    label: string;
  }> = [
    { key: "keywords", count: draft.keywords.length, min: MIN_RETRIEVAL_COUNTS.keywords, ideal: IDEAL_RETRIEVAL_COUNTS.keywords, label: "keywords" },
    { key: "synonyms", count: draft.synonyms.length, min: MIN_RETRIEVAL_COUNTS.synonyms, ideal: IDEAL_RETRIEVAL_COUNTS.synonyms, label: "synonyms" },
    { key: "search_phrases", count: draft.search_phrases.length, min: MIN_RETRIEVAL_COUNTS.search_phrases, ideal: IDEAL_RETRIEVAL_COUNTS.search_phrases, label: "search phrases" },
    { key: "alternative_wording", count: draft.alternative_wording.length, min: MIN_RETRIEVAL_COUNTS.alternative_wording, ideal: IDEAL_RETRIEVAL_COUNTS.alternative_wording, label: "alternative wording" },
    { key: "related_terms", count: draft.related_terms.length, min: MIN_RETRIEVAL_COUNTS.related_terms, ideal: IDEAL_RETRIEVAL_COUNTS.related_terms, label: "related terms" },
  ];

  for (const field of fields) {
    if (field.count >= field.ideal) continue;
    if (field.count >= field.min) {
      score = deduct(score, 3, `Could add more ${field.label}`, deductions, issues);
    } else {
      score = deduct(score, 8, `Insufficient ${field.label}`, deductions, issues);
    }
  }

  return { score: clamp(score), issues, deductions };
}

export function scoreWritingStandard(
  draft: Pick<
    GeneratedLessonDraft,
    | "category"
    | "question"
    | "answer"
    | "keywords"
    | "search_phrases"
    | "alternative_wording"
    | "synonyms"
    | "related_terms"
    | "priority"
    | "intentKey"
  >
): ScoredCriterion {
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

  const deductions: CriterionDeduction[] = [];
  let score = validation.requiredPassed ? 94 : 78;

  for (const issue of validation.issues) {
    score = deduct(score, 6, issue, deductions, []);
  }
  for (const warning of validation.warnings) {
    score = deduct(score, 2, warning, deductions, []);
  }

  return { score: clamp(score), issues: validation.issues, deductions };
}

export function scoreHumanReadability(answer: string): ScoredCriterion {
  const issues: string[] = [];
  const deductions: CriterionDeduction[] = [];
  let score = 90;

  for (const phrase of ROBOTIC_PHRASES) {
    if (phrase.test(answer)) {
      score = deduct(score, 8, "Answer contains robotic phrasing", deductions, issues);
    }
  }

  const words = answer.toLowerCase().split(/\s+/);
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 5) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const stuffed = [...freq.values()].filter((c) => c > 10).length;
  if (stuffed > 0) {
    score = deduct(score, 10, "Possible keyword stuffing", deductions, issues);
  }

  if (/\b(you can|schools can|administrators can|we help|designed for)\b/i.test(answer)) {
    score = reward(score, 4);
  }

  return { score: clamp(score), issues, deductions };
}

export function scoreKnowledgeHealth(
  draft: Pick<
    GeneratedLessonDraft,
    "category" | "priority" | "keywords" | "synonyms" | "search_phrases" | "related_terms"
  >
): ScoredCriterion {
  const issues: string[] = [];
  const deductions: CriterionDeduction[] = [];
  let score = 100;

  if (!draft.category?.trim()) {
    score = deduct(score, 20, "Missing category", deductions, issues);
  }
  if (!draft.priority) {
    score = deduct(score, 10, "Missing priority", deductions, issues);
  }
  if (draft.keywords.length < 3) {
    score = deduct(score, 8, "Few keywords for retrieval health", deductions, issues);
  }

  return { score: clamp(score), issues, deductions };
}

const IMPROVEMENT_CATEGORY_ORDER: QualityCriterionKey[] = [
  "retrievalQuality",
  "answerQuality",
  "writingStandard",
  "humanReadability",
  "questionQuality",
  "curriculumCoverage",
  "duplicateDetection",
  "knowledgeHealth",
];

export function pickWeakestCategory(
  criteria: QualityCriterionScores,
  threshold = 88
): QualityCriterionKey | null {
  let weakest: QualityCriterionKey | null = null;
  let lowest = threshold;

  for (const key of IMPROVEMENT_CATEGORY_ORDER) {
    if (criteria[key] < lowest) {
      lowest = criteria[key];
      weakest = key;
    }
  }
  return weakest;
}

export function scoreLessonDraft(
  draft: GeneratedLessonDraft,
  context: QualityScoringContext
): ReturnType<typeof buildQualityReport> {
  const allIssues: string[] = [];
  const allDeductions: Partial<Record<QualityCriterionKey, CriterionDeduction[]>> = {};
  const calibrationAdjustments: CalibrationAdjustment[] = [];
  const calibrationMode = isCalibrationModeEnabled(context.calibrationMode);

  const q = scoreQuestionQuality(draft.question);
  allIssues.push(...q.issues);
  allDeductions.questionQuality = q.deductions;

  const dup = scoreDuplicateDetection(draft, context.existingEntries, context.batchDrafts);
  allIssues.push(...dup.issues);
  allDeductions.duplicateDetection = dup.deductions;

  const cov = scoreCurriculumCoverage(
    draft.topicTag,
    draft.intentLabel,
    context.analysis,
    context.coveredConcepts
  );
  allIssues.push(...cov.issues);
  allDeductions.curriculumCoverage = cov.deductions;

  const ans = scoreAnswerQuality(draft.answer);
  allIssues.push(...ans.issues);
  allDeductions.answerQuality = ans.deductions;

  const ret = scoreRetrievalQuality(draft);
  allIssues.push(...ret.issues);
  allDeductions.retrievalQuality = ret.deductions;

  const wr = scoreWritingStandard(draft);
  allIssues.push(...wr.issues);
  allDeductions.writingStandard = wr.deductions;

  const read = scoreHumanReadability(draft.answer);
  allIssues.push(...read.issues);
  allDeductions.humanReadability = read.deductions;

  const health = scoreKnowledgeHealth(draft);
  allIssues.push(...health.issues);
  allDeductions.knowledgeHealth = health.deductions;

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

  const rawOverall = Object.entries(criteria).reduce((sum, [key, percent]) => {
    const weight = QUALITY_CRITERION_WEIGHTS[key as QualityCriterionKey];
    return sum + percent * weight;
  }, 0);

  if (calibrationMode) {
    calibrationAdjustments.push({
      rule: "weighted_criteria",
      weight: 1,
      originalScore: Math.round(rawOverall),
      adjustedScore: Math.round(rawOverall),
      reason: "Overall derived from weighted criterion percentages",
    });
  }

  return buildQualityReport({
    criteria,
    duplicateRiskPercent: dup.duplicateRiskPercent,
    duplicateFalsePositive: dup.duplicateFalsePositive,
    issues: [...new Set(allIssues)],
    deductions: allDeductions,
    improvementsApplied: [],
    attempts: 0,
    coverageMap,
    forceRejected: dup.blocked,
    calibrationAdjustments: calibrationMode ? calibrationAdjustments : undefined,
  });
}

export function improveLessonDraft(
  draft: GeneratedLessonDraft,
  report: ReturnType<typeof buildQualityReport>,
  category: string
): { draft: GeneratedLessonDraft; improvements: string[] } {
  const improvements: string[] = [];
  let next = { ...draft };
  const target = pickWeakestCategory(report.criteria);

  if (!target) {
    return { draft: next, improvements };
  }

  switch (target) {
    case "retrievalQuality": {
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
      break;
    }
    case "answerQuality":
    case "writingStandard": {
      if (!next.answer.includes("**Overview**") && next.answer.length < 180) {
        const template = buildRecommendedAnswerTemplate(next.question);
        next = { ...next, answer: template };
        improvements.push("Applied Knowledge Writing Standard structure");
      } else if (target === "writingStandard" && !next.answer.includes("**Core Facts**")) {
        next = {
          ...next,
          answer: `${next.answer.trim()}\n\n**Core Facts**\n\n- Key point about Adakaro`,
        };
        improvements.push("Added structured section headings");
      }
      break;
    }
    case "humanReadability": {
      let answer = next.answer;
      for (const phrase of ROBOTIC_PHRASES) {
        answer = answer.replace(phrase, "");
      }
      next = { ...next, answer: answer.replace(/\n{3,}/g, "\n\n").trim() };
      improvements.push("Removed robotic phrasing");
      break;
    }
    case "questionQuality": {
      if (!next.question.endsWith("?")) {
        next = { ...next, question: `${next.question.trim()}?` };
        improvements.push("Normalized question format");
      }
      break;
    }
    default:
      break;
  }

  return { draft: next, improvements };
}
