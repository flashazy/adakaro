export function termDateRange(
  term: string,
  academicYear: string
): { start: string; end: string } {
  const parts = academicYear.trim().split(/[-\/]/);
  const startYear = parseInt(parts[0] ?? "", 10) || new Date().getFullYear();
  const y1 = startYear;
  const y2 = startYear + 1;
  switch (term) {
    case "Term 1":
      return { start: `${y2}-04-01`, end: `${y2}-06-30` };
    case "Term 2":
      return { start: `${y2}-09-01`, end: `${y2}-12-31` };
    default:
      return { start: `${y2}-04-01`, end: `${y2}-06-30` };
  }
}
