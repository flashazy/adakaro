import "server-only";

export interface ClassProgressionRow {
  id: string;
  name: string;
  track_id: string | null;
  progression_order: number | null;
}

/**
 * Next class in the same track (progression_order + 1).
 */
export function resolveNextClassId(
  fromClassId: string,
  allClasses: ClassProgressionRow[]
): { nextClassId: string | null; nextClassName: string | null } {
  const from = allClasses.find((c) => c.id === fromClassId);
  if (!from?.track_id || from.progression_order == null) {
    return { nextClassId: null, nextClassName: null };
  }

  const nextOrder = from.progression_order + 1;
  const next = allClasses.find(
    (c) => c.track_id === from.track_id && c.progression_order === nextOrder
  );

  return {
    nextClassId: next?.id ?? null,
    nextClassName: next?.name ?? null,
  };
}

export function enrichClassesWithNext(
  classes: ClassProgressionRow[]
): Array<
  ClassProgressionRow & { next_class_id: string | null; next_class_name: string | null }
> {
  return classes.map((c) => {
    const { nextClassId, nextClassName } = resolveNextClassId(c.id, classes);
    return {
      ...c,
      next_class_id: nextClassId,
      next_class_name: nextClassName,
    };
  });
}
