/**
 * Shared helpers for building admin-facing class `<select>` option lists.
 *
 * Parent classes (those with at least one child stream) are umbrella rows —
 * you cannot enrol a student into them directly, subjects are taught in the
 * individual streams, and teacher subject assignments bind to a concrete
 * stream. Coordinators (form masters) are the one exception: they CAN be
 * assigned at the parent level, so use the unfiltered class list there.
 */

export interface ClassOptionRow {
  id: string;
  parent_class_id: string | null;
}

/**
 * Return the set of class ids that currently act as a parent, i.e. appear in
 * some other row's `parent_class_id` column. A top-level class with no
 * children is NOT a parent and stays eligible for direct assignment.
 */
export function collectParentClassIds(rows: ClassOptionRow[]): Set<string> {
  const parents = new Set<string>();
  for (const r of rows) {
    if (r.parent_class_id) parents.add(r.parent_class_id);
  }
  return parents;
}

/**
 * Filter a list of class options down to "leaf" classes only — every class
 * that isn't currently acting as a parent. Useful for student enrolment,
 * subject-class mapping, and teacher subject assignments.
 */
export function filterLeafClassOptions<T extends ClassOptionRow>(rows: T[]): T[] {
  const parentIds = collectParentClassIds(rows);
  return rows.filter((c) => !parentIds.has(c.id));
}

/** Class row with a display name (admin pickers, coordinator modal, etc.). */
export type ClassOptionWithName = ClassOptionRow & { name: string };

/**
 * Sort classes so each parent appears before its child streams (DFS pre-order),
 * with alphabetical order among roots and among siblings.
 */
export function sortClassRowsByHierarchy<T extends ClassOptionWithName>(
  rows: T[]
): T[] {
  if (rows.length === 0) return [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const childrenByParent = new Map<string, T[]>();
  for (const r of rows) {
    const pid = r.parent_class_id;
    if (pid && byId.has(pid)) {
      const list = childrenByParent.get(pid) ?? [];
      list.push(r);
      childrenByParent.set(pid, list);
    }
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }
  const roots = rows.filter((r) => {
    if (!r.parent_class_id) return true;
    return !byId.has(r.parent_class_id);
  });
  roots.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  const out: T[] = [];
  function visit(node: T) {
    out.push(node);
    const kids = childrenByParent.get(node.id);
    if (kids) for (const k of kids) visit(k);
  }
  for (const r of roots) visit(r);
  return out;
}

/** Leading spaces for child streams in native `<option>` text (indent is not styleable per option). */
export function formatNativeSelectClassOptionLabel(
  name: string,
  parentClassId: string | null
): string {
  if (!parentClassId) return name;
  return `\u00A0\u00A0\u00A0\u00A0${name}`;
}
