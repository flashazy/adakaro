/**
 * Resolves prerequisite, dependency, related, and graph content for draft assembly.
 */

import {
  buildCurriculumPlannerContext,
  getLessonPrerequisites,
} from "@/lib/ai-training/knowledge-curriculum-planner";
import { getGraphNeighborsForEntry } from "@/lib/ai-training/knowledge-graph-builder";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";
import type { DraftGenerationRequest } from "./types";
import {
  filterPublishedEntries,
  findPublishedByCategory,
  findPublishedByQuestion,
  findPublishedByQuestions,
  findPublishedRelatedToQuestion,
} from "./knowledge-reader";

export interface RelatedContentBundle {
  prerequisiteEntries: AIKnowledgeEntry[];
  dependencyEntries: AIKnowledgeEntry[];
  relatedEntries: AIKnowledgeEntry[];
  categoryEntries: AIKnowledgeEntry[];
  graphNeighborEntries: AIKnowledgeEntry[];
}

export function collectRelatedContent(
  request: DraftGenerationRequest,
  allEntries: AIKnowledgeEntry[]
): RelatedContentBundle {
  const published = filterPublishedEntries(allEntries);
  const excludeId = request.excludeEntryId;

  const plannerContext = buildCurriculumPlannerContext({ entries: published });
  const graphPrerequisites = getLessonPrerequisites(
    request.question,
    plannerContext,
    excludeId
  );

  const prerequisiteQuestions = [
    ...new Set([
      ...(request.prerequisiteQuestions ?? []),
      ...graphPrerequisites.map((p) => p.question),
    ]),
  ];

  const dependencyQuestions = [
    ...new Set([
      ...(request.dependencyQuestions ?? []),
      ...prerequisiteQuestions,
    ]),
  ];

  const relatedQuestions = request.relatedQuestions ?? [];

  const prerequisiteEntries: AIKnowledgeEntry[] = [];
  const prereqSeen = new Set<string>();

  for (const prereq of graphPrerequisites) {
    if (!prereq.entryId || prereqSeen.has(prereq.entryId)) continue;
    const entry = published.find((e) => e.id === prereq.entryId);
    if (entry) {
      prereqSeen.add(prereq.entryId);
      prerequisiteEntries.push(entry);
    }
  }

  for (const entry of findPublishedByQuestions(
    prerequisiteQuestions,
    published,
    excludeId
  )) {
    if (prereqSeen.has(entry.id)) continue;
    prereqSeen.add(entry.id);
    prerequisiteEntries.push(entry);
  }

  const dependencyEntries = findPublishedByQuestions(
    dependencyQuestions,
    published,
    excludeId
  );

  const explicitRelated = findPublishedByQuestions(relatedQuestions, published, excludeId);
  const semanticRelated = findPublishedRelatedToQuestion(
    request.question,
    published,
    excludeId,
    6
  );

  const relatedSeen = new Set<string>();
  const relatedEntries: AIKnowledgeEntry[] = [];
  for (const entry of [...explicitRelated, ...semanticRelated]) {
    if (relatedSeen.has(entry.id)) continue;
    relatedSeen.add(entry.id);
    relatedEntries.push(entry);
  }

  const categoryEntries = findPublishedByCategory(
    request.category,
    published,
    excludeId,
    8
  ).filter((e) => normalizeQuestion(e.question) !== normalizeQuestion(request.question));

  const current = findPublishedByQuestion(request.question, published, excludeId);
  const graphNeighborEntries: AIKnowledgeEntry[] = [];
  if (current) {
    const neighbors = getGraphNeighborsForEntry(current, published);
    for (const neighbor of neighbors) {
      if (neighbor.id === excludeId) continue;
      graphNeighborEntries.push(neighbor);
    }
  }

  return {
    prerequisiteEntries,
    dependencyEntries,
    relatedEntries,
    categoryEntries,
    graphNeighborEntries,
  };
}

function normalizeQuestion(question: string): string {
  return question.trim().toLowerCase().replace(/\?+$/, "");
}

export function buildDraftGenerationContext(
  request: DraftGenerationRequest,
  allEntries: AIKnowledgeEntry[]
): import("./types").DraftGenerationContext {
  const published = filterPublishedEntries(allEntries);
  const related = collectRelatedContent(request, allEntries);

  return {
    request,
    publishedEntries: published,
    prerequisiteEntries: related.prerequisiteEntries,
    dependencyEntries: related.dependencyEntries,
    relatedEntries: related.relatedEntries,
    categoryEntries: related.categoryEntries,
    graphNeighborEntries: related.graphNeighborEntries,
  };
}
