import type { DutyBookClassRow, DutyBookGenderFilter } from "./types";

export type { DutyBookGenderFilter };
export const DUTY_BOOK_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type DutyBookPageSize = (typeof DUTY_BOOK_PAGE_SIZE_OPTIONS)[number];
export type DutyBookAttendanceFilter =
  | "all"
  | "has-present"
  | "has-absent"
  | "has-ill"
  | "has-permitted";

export type DutyBookSortKey =
  | "className"
  | "boys"
  | "girls"
  | "total"
  | "present"
  | "absent"
  | "ill"
  | "permitted";

export type DutyBookSortDir = "asc" | "desc";

export type DutyBookClassFilterState = {
  search: string;
  attendance: DutyBookAttendanceFilter;
};

function matchesSearch(row: DutyBookClassRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return row.className.toLowerCase().includes(q);
}

function matchesAttendance(
  row: DutyBookClassRow,
  attendance: DutyBookAttendanceFilter
): boolean {
  if (attendance === "all") return true;
  const hasCount = (n: number | null) => n !== null && n > 0;
  switch (attendance) {
    case "has-present":
      return hasCount(row.present);
    case "has-absent":
      return hasCount(row.absent);
    case "has-ill":
      return hasCount(row.ill);
    case "has-permitted":
      return hasCount(row.permitted);
    default:
      return true;
  }
}

export function filterDutyBookClasses(
  classes: DutyBookClassRow[],
  filters: DutyBookClassFilterState
): DutyBookClassRow[] {
  return classes.filter(
    (row) =>
      matchesSearch(row, filters.search) &&
      matchesAttendance(row, filters.attendance)
  );
}

function numForSort(n: number | null): number {
  if (n === null) return Number.POSITIVE_INFINITY;
  return n;
}

export function sortDutyBookClasses(
  classes: DutyBookClassRow[],
  sortKey: DutyBookSortKey,
  sortDir: DutyBookSortDir
): DutyBookClassRow[] {
  const copy = [...classes];
  const dir = sortDir === "asc" ? 1 : -1;

  copy.sort((a, b) => {
    let cmp = 0;
    if (sortKey === "className") {
      cmp = a.className.localeCompare(b.className, undefined, {
        sensitivity: "base",
      });
    } else {
      const av = numForSort(a[sortKey]);
      const bv = numForSort(b[sortKey]);
      cmp = av === bv ? 0 : av < bv ? -1 : 1;
    }
    if (cmp !== 0) return cmp * dir;
    return a.className.localeCompare(b.className, undefined, {
      sensitivity: "base",
    });
  });

  return copy;
}

export function hasActiveDutyBookClassFilters(
  filters: DutyBookClassFilterState
): boolean {
  return filters.search.trim().length > 0 || filters.attendance !== "all";
}
