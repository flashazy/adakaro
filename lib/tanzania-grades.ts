/** Percentage (0–100) from raw score and max. */
export function tanzaniaPercentFromScore(
  score: number,
  max: number
): number | null {
  if (max <= 0 || !Number.isFinite(score)) return null;
  return Math.round((score / max) * 1000) / 10;
}

/** Tanzania letter grade from percentage (75–100 = A, etc.). */
export function tanzaniaLetterGrade(percent: number | null): string {
  if (percent == null || Number.isNaN(percent)) return "—";
  if (percent >= 75) return "A";
  if (percent >= 65) return "B";
  if (percent >= 45) return "C";
  if (percent >= 30) return "D";
  return "F";
}

export function tanzaniaGradeBadgeClass(letter: string): string {
  switch (letter) {
    case "A":
      return "text-emerald-700 dark:text-emerald-400 font-semibold";
    case "B":
      return "text-blue-700 dark:text-blue-400 font-semibold";
    case "C":
      return "text-amber-600 dark:text-amber-400 font-semibold";
    case "D":
      return "text-orange-600 dark:text-orange-400 font-semibold";
    case "F":
      return "text-red-600 dark:text-red-400 font-semibold";
    default:
      return "text-slate-500 dark:text-zinc-400";
  }
}
