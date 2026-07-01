/**
 * Safe automatic metadata normalization for fix-all and save pipelines.
 */

export function normalizeMetadataFieldList(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of items) {
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function normalizeSearchPhrases(items: string[]): string[] {
  return normalizeMetadataFieldList(items.map((item) => item.toLowerCase()));
}

export function normalizeMetadataBundle(metadata: {
  keywords: string[];
  synonyms: string[];
  search_phrases: string[];
  alternative_wording: string[];
  related_terms: string[];
}) {
  return {
    keywords: normalizeMetadataFieldList(metadata.keywords.map((k) => k.toLowerCase())),
    synonyms: normalizeMetadataFieldList(metadata.synonyms),
    search_phrases: normalizeSearchPhrases(metadata.search_phrases),
    alternative_wording: normalizeMetadataFieldList(metadata.alternative_wording),
    related_terms: normalizeMetadataFieldList(metadata.related_terms),
  };
}
