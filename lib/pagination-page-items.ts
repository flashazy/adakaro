/**
 * Compact page index list for long tables (e.g. 600+ pages).
 *
 * Rules (max ~7 page numbers, ellipsis for larger gaps):
 * - Always include page 1 and the last page.
 * - Near the start (current ≤ 3): show pages 1–5.
 * - Near the end (current ≥ total − 2): show the last five pages.
 * - Otherwise: current page ± 2.
 * - A gap of exactly one missing integer is filled with that page; larger gaps
 *   use a single `"ellipsis"` token.
 *
 * Examples (total 600): page 1 → 1,2,3,4,5,…,600 — page 46 → 1,…,44–48,…,600.
 */
export type PaginationPageItem = number | "ellipsis";

export function getCompactPaginationItems(
  currentPage: number,
  totalPages: number
): PaginationPageItem[] {
  if (totalPages <= 0) return [];
  const current = Math.min(Math.max(1, currentPage), totalPages);
  const total = totalPages;

  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  let winStart: number;
  let winEnd: number;
  if (current <= 3) {
    winStart = 1;
    winEnd = Math.min(5, total);
  } else if (current >= total - 2) {
    winEnd = total;
    winStart = Math.max(1, total - 4);
  } else {
    winStart = current - 2;
    winEnd = current + 2;
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let p = winStart; p <= winEnd; p++) pages.add(p);

  const sorted = [...pages].sort((a, b) => a - b);
  const out: PaginationPageItem[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    if (i > 0) {
      const prev = sorted[i - 1]!;
      const gap = p - prev;
      if (gap === 2) {
        out.push(prev + 1);
      } else if (gap > 2) {
        if (out[out.length - 1] !== "ellipsis") out.push("ellipsis");
      }
    }
    out.push(p);
  }

  return out;
}
