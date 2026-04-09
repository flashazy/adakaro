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
