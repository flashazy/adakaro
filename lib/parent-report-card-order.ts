/**
 * Report card ordering for the parent dashboard: newest first.
 * Year descending, then term descending (Term 3 → Term 2 → Term 1).
 */
export function sortParentReportCardsByRecency<
  T extends { term: string; academic_year: string },
>(rows: T[]): T[] {
  const termRank = (t: string) => {
    const x = t.trim().toLowerCase();
    if (x.startsWith("term 3")) return 3;
    if (x.startsWith("term 2")) return 2;
    if (x.startsWith("term 1")) return 1;
    return 0;
  };
  return [...rows].sort((a, b) => {
    const ya = parseInt(a.academic_year, 10);
    const yb = parseInt(b.academic_year, 10);
    if (Number.isFinite(yb) && Number.isFinite(ya) && yb !== ya) {
      return yb - ya;
    }
    return termRank(b.term) - termRank(a.term);
  });
}
