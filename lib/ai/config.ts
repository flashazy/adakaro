export const AI_CONFIG = {
  /** OpenAI-compatible chat model. Set OPENAI_API_KEY to enable live LLM. */
  model: process.env.AI_MODEL ?? "gpt-4o-mini",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  maxContextMessages: 24,
  maxTokens: 1200,
  temperature: 0.4,
  /** Cookie / localStorage key for anonymous public sessions */
  publicSessionKey: "adakaro_ai_session",
} as const;

export function isAIConfigured(): boolean {
  return Boolean(AI_CONFIG.openaiApiKey.trim());
}
