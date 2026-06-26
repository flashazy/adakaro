import { inferIntentFromText } from "./intent-registry";
import { analyzeIntentSignals } from "./intent-reasoning";
import { meaningfulTokens } from "./knowledge-scoring";
import { normalizeQuestionForDedup } from "./keyword-generator";
import type { LearningEventRow, QuestionCluster } from "./learning-types";

const INTENT_PROBE_KEYS = [
  "student.bulk_import",
  "student.archive_inactive",
  "student.class_history",
  "student.excel_upload",
  "student.class_transfer",
  "pricing.free_plan",
  "pricing.starter_plan",
  "pricing.monthly_features",
];

function tokenJaccard(a: string, b: string): number {
  const setA = new Set(meaningfulTokens(a));
  const setB = new Set(meaningfulTokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function inferBestIntentFromQuestion(question: string): string | null {
  const fromRegistry = inferIntentFromText(question);
  if (fromRegistry) return fromRegistry.key;

  let best: { key: string; score: number } | null = null;
  for (const key of INTENT_PROBE_KEYS) {
    const analysis = analyzeIntentSignals(question, key);
    if (analysis.netSignalScore > 0 && (!best || analysis.netSignalScore > best.score)) {
      best = { key, score: analysis.netSignalScore };
    }
  }

  return best?.key ?? null;
}

function eventsSimilar(a: LearningEventRow, b: LearningEventRow): boolean {
  if (a.normalized_question === b.normalized_question) return true;

  const jaccard = tokenJaccard(a.original_question, b.original_question);
  if (jaccard >= 0.45) return true;

  const intentA = a.matched_intent_key ?? inferBestIntentFromQuestion(a.original_question);
  const intentB = b.matched_intent_key ?? inferBestIntentFromQuestion(b.original_question);
  if (intentA && intentB && intentA === intentB && jaccard >= 0.25) return true;

  return false;
}

function addEventToCluster(cluster: QuestionCluster, event: LearningEventRow): void {
  if (!cluster.questions.includes(event.original_question)) {
    cluster.questions.push(event.original_question);
  }
  if (!cluster.normalizedQuestions.includes(event.normalized_question)) {
    cluster.normalizedQuestions.push(event.normalized_question);
  }
  cluster.eventIds.push(event.id);
  cluster.occurrenceCount++;

  const scores =
    cluster.avgScore * (cluster.occurrenceCount - 1) + (event.final_score ?? 0);
  cluster.avgScore = scores / cluster.occurrenceCount;
  cluster.answerStatuses.push(event.answer_status);

  const intents = new Set(cluster.topCandidateIntents);
  if (event.matched_intent_key) intents.add(event.matched_intent_key);
  for (const intent of event.top_candidate_intents ?? []) {
    intents.add(intent);
  }
  cluster.topCandidateIntents = [...intents];

  if (!cluster.intentKey) {
    cluster.intentKey =
      event.matched_intent_key ?? inferBestIntentFromQuestion(event.original_question);
  }
}

export function clusterLearningEvents(events: LearningEventRow[]): QuestionCluster[] {
  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const clusters: QuestionCluster[] = [];

  for (const event of sorted) {
    let cluster = clusters.find((c) => {
      const rep = events.find((e) => e.id === c.eventIds[0]);
      return rep ? eventsSimilar(event, rep) : false;
    });

    if (!cluster) {
      cluster = {
        clusterKey: `cluster:${normalizeQuestionForDedup(event.original_question).slice(0, 60)}`,
        intentKey:
          event.matched_intent_key ??
          inferBestIntentFromQuestion(event.original_question),
        questions: [],
        normalizedQuestions: [],
        eventIds: [],
        occurrenceCount: 0,
        avgScore: 0,
        answerStatuses: [],
        topCandidateIntents: [],
      };
      clusters.push(cluster);
    }

    addEventToCluster(cluster, event);
  }

  return clusters;
}

export function isLearnableCluster(cluster: QuestionCluster): boolean {
  const hasGap = cluster.answerStatuses.some((status) =>
    ["unanswered", "fallback", "clarified", "llm"].includes(status)
  );
  const hasLowConfidence = cluster.avgScore < 0.58;
  return cluster.occurrenceCount >= 2 && (hasGap || hasLowConfidence);
}

export function extractDistinctPhrase(question: string): string {
  return question.trim().slice(0, 120);
}

export function isLowConfidenceStatus(status: string): boolean {
  return ["unanswered", "fallback", "clarified", "llm"].includes(status);
}
