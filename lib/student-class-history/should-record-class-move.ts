/**
 * Pure guard for class movement history writes (used by recordStudentClassMoveIfChanged).
 */
export function shouldRecordClassMove(
  fromClassId: string | null | undefined,
  toClassId: string | null | undefined
): boolean {
  const from = fromClassId?.trim() || null;
  const to = toClassId?.trim() || null;
  if (!to) return false;
  return from !== to;
}
