/** Zero-cost retrieval is the default — no paid APIs required for Public AI. */
export function isZeroCostRetrievalEnabled(): boolean {
  return process.env.ZERO_COST_RETRIEVAL !== "false";
}

/** Paid OpenAI chat completions for Public AI (off by default). */
export function isPublicPaidLlmEnabled(): boolean {
  return process.env.PUBLIC_AI_PAID_LLM_ENABLED === "true";
}

/** Optional paid pgvector embeddings (off by default). */
export function isPaidEmbeddingsEnabled(): boolean {
  return (
    !isZeroCostRetrievalEnabled() &&
    process.env.PAID_EMBEDDINGS_ENABLED === "true"
  );
}

export const CONVERSATION_CONTEXT_BOOST = 0.08;
export const CONVERSATION_GROUP_BOOST = 0.05;

/** Scores below this are treated as no match. */
export const CLARIFICATION_MIN_SCORE = 0.42;

/** Ambiguity gap — top candidates within this range trigger clarification. */
export const CLARIFICATION_AMBIGUITY_GAP = 0.1;

export const MAX_CLARIFICATION_OPTIONS = 3;
