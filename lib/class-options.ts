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
