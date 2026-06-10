import {
  collapseSyllabusWhitespace,
  formatSyllabusSubtopicTitle,
  formatSyllabusTopicTitle,
  syllabusTextKey,
} from "@/lib/syllabus-coverage/syllabus-text-format";

export interface ParsedBulkTopic {
  title: string;
  subtopics: string[];
}

export interface ParseBulkSyllabusResult {
  topics: ParsedBulkTopic[];
  warnings: string[];
}

function isSubtopicLine(line: string): boolean {
  return /^[-•*–]\s*.+/.test(line);
}

function extractSubtopicTitle(line: string): string {
  const raw = collapseSyllabusWhitespace(line.replace(/^[-•*–]\s*/, ""));
  return formatSyllabusSubtopicTitle(raw);
}

/**
 * Parses coordinator bulk-paste syllabus text.
 * Supports `Topic: TITLE` headers or plain topic lines, with `-` subtopic bullets.
 */
export function parseBulkSyllabusText(text: string): ParseBulkSyllabusResult {
  const warnings: string[] = [];
  const topics: ParsedBulkTopic[] = [];
  const topicIndexByKey = new Map<string, number>();
  let current: ParsedBulkTopic | null = null;

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const topicPrefixMatch = line.match(/^Topic:\s*(.+)$/i);
    if (topicPrefixMatch) {
      const title = formatSyllabusTopicTitle(topicPrefixMatch[1] ?? "");
      if (!title) continue;
      current = appendTopic(title, topics, topicIndexByKey, warnings);
      continue;
    }

    if (isSubtopicLine(line)) {
      const subTitle = extractSubtopicTitle(line);
      if (!subTitle) continue;
      if (!current) {
        warnings.push(`Ignored subtopic without a topic: "${subTitle}"`);
        continue;
      }
      appendSubtopic(current, subTitle, warnings);
      continue;
    }

    const title = formatSyllabusTopicTitle(line);
    if (!title) continue;
    current = appendTopic(title, topics, topicIndexByKey, warnings);
  }

  return { topics, warnings };
}

function appendTopic(
  title: string,
  topics: ParsedBulkTopic[],
  topicIndexByKey: Map<string, number>,
  warnings: string[]
): ParsedBulkTopic {
  const key = syllabusTextKey(title);
  const existingIdx = topicIndexByKey.get(key);
  if (existingIdx != null) {
    warnings.push(`Merged duplicate topic in paste: "${title}"`);
    return topics[existingIdx]!;
  }
  const topic: ParsedBulkTopic = { title, subtopics: [] };
  topicIndexByKey.set(key, topics.length);
  topics.push(topic);
  return topic;
}

function appendSubtopic(
  topic: ParsedBulkTopic,
  title: string,
  warnings: string[]
): void {
  const key = syllabusTextKey(title);
  if (topic.subtopics.some((s) => syllabusTextKey(s) === key)) {
    warnings.push(`Skipped duplicate subtopic under "${topic.title}": "${title}"`);
    return;
  }
  topic.subtopics.push(title);
}

export function countBulkImportPreview(topics: ParsedBulkTopic[]): {
  topicCount: number;
  subtopicCount: number;
} {
  return {
    topicCount: topics.length,
    subtopicCount: topics.reduce((sum, t) => sum + t.subtopics.length, 0),
  };
}
