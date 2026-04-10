/**
 * Standard student list ordering for Supabase queries: males first, then females;
 * full_name A–Z within each group. Uses `gender DESC` so `male` sorts before `female`.
 */
export function orderStudentsByGenderThenName<
  T extends {
    order: (column: string, options?: { ascending?: boolean }) => T;
  }
>(query: T): T {
  return query
    .order("gender", { ascending: false })
    .order("full_name", { ascending: true });
}

/**
 * In-memory sort matching {@link orderStudentsByGenderThenName}: males first,
 * then females, then other/null; A–Z by full_name within each group.
 */
export function sortStudentsByGenderThenName<
  T extends { gender?: string | null; full_name: string }
>(students: readonly T[]): T[] {
  return [...students].sort((a, b) => {
    const rank = (g: string | null | undefined) => {
      const x = (g ?? "").toLowerCase();
      if (x === "male") return 0;
      if (x === "female") return 1;
      return 2;
    };
    const ra = rank(a.gender);
    const rb = rank(b.gender);
    if (ra !== rb) return ra - rb;
    return (a.full_name || "").localeCompare(b.full_name || "", undefined, {
      sensitivity: "base",
    });
  });
}
