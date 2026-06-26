import type { AIKnowledgeEntry } from "./types";
import { inferIntentFromText, getIntentDefinition } from "./intent-registry";
import { analyzeIntentSignals } from "./intent-reasoning";
import { meaningfulTokens, normalizeText } from "./knowledge-scoring";
import {
  clusterLearningEvents,
  extractDistinctPhrase,
  inferBestIntentFromQuestion,
  isLearnableCluster,
} from "./learning-cluster";
import {
  buildSuggestionClusterKey,
  isValidSuggestionText,
  meetsOccurrenceThreshold,
  phraseAlreadyExists,
} from "./learning-quality";
import type {
  DraftLearningSuggestion,
  LearningEventRow,
  QuestionCluster,
} from "./learning-types";

function inferBestIntent(question: string): string | null {
  return inferBestIntentFromQuestion(question);
}

function findEntryForIntent(
  intentKey: string,
  entries: AIKnowledgeEntry[]
): AIKnowledgeEntry | undefined {
  return entries.find((e) => e.intent_key === intentKey);
}

function suggestPhrasesFromCluster(
  cluster: QuestionCluster,
  entry: AIKnowledgeEntry | undefined,
  intentKey: string | null
): DraftLearningSuggestion[] {
  const suggestions: DraftLearningSuggestion[] = [];

  for (const question of cluster.questions) {
    const phrase = extractDistinctPhrase(question);
    if (!isValidSuggestionText(phrase, "search_phrase")) continue;
    if (entry && phraseAlreadyExists(phrase, entry.search_phrases)) continue;

    suggestions.push({
      suggestion_type: "search_phrase",
      suggested_text: phrase,
      target_entry_id: entry?.id ?? null,
      target_intent_key: intentKey,
      source_questions: cluster.questions,
      source_event_ids: cluster.eventIds,
      occurrence_count: cluster.occurrenceCount,
      confidence: Math.min(0.95, 0.5 + cluster.occurrenceCount * 0.1),
      reason: `Users asked similar questions ${cluster.occurrenceCount} times. Adding this phrase should improve matching.`,
      cluster_key: buildSuggestionClusterKey(
        "search_phrase",
        phrase,
        intentKey,
        entry?.id ?? null
      ),
    });

    if (entry && !phraseAlreadyExists(question, entry.alternative_wording)) {
      if (isValidSuggestionText(question, "alternative_wording")) {
        suggestions.push({
          suggestion_type: "alternative_wording",
          suggested_text: question.trim(),
          target_entry_id: entry.id,
          target_intent_key: intentKey,
          source_questions: cluster.questions,
          source_event_ids: cluster.eventIds,
          occurrence_count: cluster.occurrenceCount,
          confidence: Math.min(0.9, 0.45 + cluster.occurrenceCount * 0.1),
          reason: "Alternative wording from repeated real user phrasing.",
          cluster_key: buildSuggestionClusterKey(
            "alternative_wording",
            question,
            intentKey,
            entry.id
          ),
        });
      }
    }
  }

  return suggestions;
}

function suggestWrongMatchFixes(
  events: LearningEventRow[],
  entries: AIKnowledgeEntry[]
): DraftLearningSuggestion[] {
  const suggestions: DraftLearningSuggestion[] = [];

  for (const event of events) {
    if ((event.final_score ?? 0) >= 0.58) continue;
    if (!event.top_candidate_entries?.length) continue;

    const top = event.top_candidate_entries[0];
    const second = event.top_candidate_entries[1];
    if (!top || !second) continue;

    const topIntent = top.intentKey;
    const secondIntent = second.intentKey;
    if (!topIntent || !secondIntent || topIntent === secondIntent) continue;

    const correctIntent =
      analyzeIntentSignals(event.original_question, secondIntent).netSignalScore >
      analyzeIntentSignals(event.original_question, topIntent).netSignalScore
        ? secondIntent
        : inferBestIntent(event.original_question) ?? secondIntent;

    const wrongIntent = topIntent;
    const correctEntry = findEntryForIntent(correctIntent, entries);

    const phrase = extractDistinctPhrase(event.original_question);
    if (isValidSuggestionText(phrase, "search_phrase") && correctEntry) {
      if (!phraseAlreadyExists(phrase, correctEntry.search_phrases)) {
        suggestions.push({
          suggestion_type: "search_phrase",
          suggested_text: phrase,
          target_entry_id: correctEntry.id,
          target_intent_key: correctIntent,
          source_questions: [event.original_question],
          source_event_ids: [event.id],
          occurrence_count: 1,
          confidence: 0.72,
          reason: `Low-confidence match favored ${wrongIntent}. This phrase belongs on ${correctIntent}.`,
          cluster_key: buildSuggestionClusterKey(
            "search_phrase",
            phrase,
            correctIntent,
            correctEntry.id
          ),
        });
      }
    }

    const archiveHistoryPair =
      (wrongIntent === "student.class_history" &&
        correctIntent === "student.archive_inactive") ||
      (wrongIntent === "student.archive_inactive" &&
        correctIntent === "student.class_history");

    if (archiveHistoryPair) {
      const negatives = ["active list", "remove from active list", "hide student"];
      for (const negative of negatives) {
        if (normalizeText(event.original_question).includes(normalizeText(negative))) {
          suggestions.push({
            suggestion_type: "intent_negative",
            suggested_text: negative,
            target_entry_id: null,
            target_intent_key: "student.class_history",
            source_questions: [event.original_question],
            source_event_ids: [event.id],
            occurrence_count: 1,
            confidence: 0.8,
            reason: `Wrong match to class history. Add negative phrase "${negative}" to archive/inactive disambiguation.`,
            cluster_key: buildSuggestionClusterKey(
              "intent_negative",
              negative,
              "student.class_history",
              null
            ),
          });

          suggestions.push({
            suggestion_type: "intent_trigger",
            suggested_text: "remove from active list",
            target_entry_id: correctEntry?.id ?? null,
            target_intent_key: "student.archive_inactive",
            source_questions: [event.original_question],
            source_event_ids: [event.id],
            occurrence_count: 1,
            confidence: 0.82,
            reason: "Strengthen archive/inactive intent trigger from wrong-match learning.",
            cluster_key: buildSuggestionClusterKey(
              "intent_trigger",
              "remove from active list",
              "student.archive_inactive",
              correctEntry?.id ?? null
            ),
          });
        }
      }
    }
  }

  return suggestions;
}

function suggestIntentTriggers(
  cluster: QuestionCluster
): DraftLearningSuggestion[] {
  if (!cluster.intentKey || !meetsOccurrenceThreshold(cluster.occurrenceCount)) {
    return [];
  }

  const def = getIntentDefinition(cluster.intentKey);
  if (!def) return [];

  const suggestions: DraftLearningSuggestion[] = [];
  const representative = cluster.questions[0]!;

  for (const question of cluster.questions) {
    const analysis = analyzeIntentSignals(question, cluster.intentKey!);
    for (const trigger of analysis.triggerMatches) {
      if (def.triggerPhrases?.includes(trigger)) continue;
      if (!isValidSuggestionText(trigger, "intent_trigger")) continue;

      suggestions.push({
        suggestion_type: "intent_trigger",
        suggested_text: trigger,
        target_entry_id: null,
        target_intent_key: cluster.intentKey,
        source_questions: cluster.questions,
        source_event_ids: cluster.eventIds,
        occurrence_count: cluster.occurrenceCount,
        confidence: 0.7,
        reason: `Repeated ${cluster.intentKey} questions use phrase "${trigger}".`,
        cluster_key: buildSuggestionClusterKey(
          "intent_trigger",
          trigger,
          cluster.intentKey,
          null
        ),
      });
    }
  }

  void representative;
  return suggestions;
}

function suggestKeywordsFromCluster(
  cluster: QuestionCluster,
  entry: AIKnowledgeEntry | undefined,
  intentKey: string | null
): DraftLearningSuggestion[] {
  if (!entry) return [];

  const tokenCounts = new Map<string, number>();
  for (const question of cluster.questions) {
    for (const token of meaningfulTokens(question)) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
  }

  const suggestions: DraftLearningSuggestion[] = [];
  for (const [token, count] of tokenCounts) {
    if (count < 2) continue;
    if (!isValidSuggestionText(token, "keyword")) continue;
    if (phraseAlreadyExists(token, entry.keywords)) continue;

    suggestions.push({
      suggestion_type: "keyword",
      suggested_text: token,
      target_entry_id: entry.id,
      target_intent_key: intentKey,
      source_questions: cluster.questions,
      source_event_ids: cluster.eventIds,
      occurrence_count: cluster.occurrenceCount,
      confidence: 0.55 + count * 0.05,
      reason: `Token "${token}" appears often in similar user questions.`,
      cluster_key: buildSuggestionClusterKey("keyword", token, intentKey, entry.id),
    });
  }

  return suggestions;
}

export function generateLearningSuggestions(
  events: LearningEventRow[],
  entries: AIKnowledgeEntry[],
  existingClusterKeys: Set<string> = new Set()
): DraftLearningSuggestion[] {
  const clusters = clusterLearningEvents(events).filter(isLearnableCluster);
  const all: DraftLearningSuggestion[] = [];

  for (const cluster of clusters) {
    const intentKey = cluster.intentKey ?? inferBestIntent(cluster.questions[0] ?? "");
    const entry = intentKey ? findEntryForIntent(intentKey, entries) : undefined;

    all.push(
      ...suggestPhrasesFromCluster(cluster, entry, intentKey),
      ...suggestKeywordsFromCluster(cluster, entry, intentKey),
      ...suggestIntentTriggers(cluster)
    );

    if (!entry && intentKey && meetsOccurrenceThreshold(cluster.occurrenceCount)) {
      const question = cluster.questions[0]!;
      all.push({
        suggestion_type: "new_entry",
        suggested_text: question,
        target_entry_id: null,
        target_intent_key: intentKey,
        source_questions: cluster.questions,
        source_event_ids: cluster.eventIds,
        occurrence_count: cluster.occurrenceCount,
        confidence: 0.65,
        reason: `Repeated questions cluster around ${intentKey} but no knowledge entry exists.`,
        cluster_key: buildSuggestionClusterKey("new_entry", question, intentKey, null),
      });
    }
  }

  all.push(...suggestWrongMatchFixes(events, entries));

  const deduped = new Map<string, DraftLearningSuggestion>();
  for (const suggestion of all) {
    if (existingClusterKeys.has(suggestion.cluster_key)) continue;
    if (!meetsOccurrenceThreshold(suggestion.occurrence_count) && suggestion.confidence < 0.7) {
      continue;
    }
    if (!deduped.has(suggestion.cluster_key)) {
      deduped.set(suggestion.cluster_key, suggestion);
    }
  }

  return [...deduped.values()];
}
