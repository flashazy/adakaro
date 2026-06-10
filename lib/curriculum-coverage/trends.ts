export type CurriculumTrendDirection = "up" | "down" | "flat";

export function deriveTrendDirection(
  trendPercent: number | null
): CurriculumTrendDirection | null {
  if (trendPercent === null) return null;
  if (trendPercent > 1) return "up";
  if (trendPercent < -1) return "down";
  return "flat";
}

export function averageTrend(
  values: (number | null)[]
): { trendPercent: number | null; trendDirection: CurriculumTrendDirection | null } {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) {
    return { trendPercent: null, trendDirection: null };
  }
  const avg = Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
  return {
    trendPercent: avg,
    trendDirection: deriveTrendDirection(avg),
  };
}
