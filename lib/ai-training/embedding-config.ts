export const EMBEDDING_MODEL =
  process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small";

export const EMBEDDING_DIMENSIONS = 1536;

export const KEYWORD_WEIGHT = 0.55;
export const SEMANTIC_WEIGHT = 0.45;

/** Minimum keyword score before semantic-only selection is allowed. */
export const KEYWORD_WEAK_THRESHOLD = 0.35;

/** Semantic score required when keyword score is weak. */
export const SEMANTIC_MIN_FOR_WEAK_KEYWORD = 0.82;

/** Strong semantic score that can lift a moderate keyword match. */
export const SEMANTIC_HIGH_CONFIDENCE = 0.78;

export const KEYWORD_CANDIDATE_POOL_SIZE = 10;
export const KEYWORD_CANDIDATE_MIN_SCORE = 0.12;

/** Stricter threshold when keyword retrieval finds no candidates. */
export const SEMANTIC_FALLBACK_THRESHOLD = 0.72;

/** Minimum keyword score for semantic lift when keyword is weak but non-zero. */
export const KEYWORD_CANDIDATE_MIN_FOR_LIFT = 0.2;
