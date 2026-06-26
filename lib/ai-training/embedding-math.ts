/** Cosine similarity for equal-length vectors (OpenAI embeddings are normalized). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Clamp raw cosine similarity into a 0–1 retrieval score. */
export function normalizeSemanticScore(cosine: number): number {
  return Math.max(0, Math.min(1, cosine));
}

export function formatVectorForPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export function parseVectorFromPg(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    return value.map((n) => Number(n));
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((n) => Number(n));
  } catch {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((part) => Number(part.trim()));
  }
}
