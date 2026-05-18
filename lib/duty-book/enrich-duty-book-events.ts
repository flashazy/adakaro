import type { DutyBookEvent } from "./duty-book-report-types";

/** Preserve original recorder on edits; assign current user for new events. */
export function enrichDutyBookEventsWithRecorders(
  incoming: DutyBookEvent[],
  existing: DutyBookEvent[],
  userId: string
): DutyBookEvent[] {
  const existingById = new Map(existing.map((e) => [e.id, e]));
  return incoming.map((event) => {
    const prev = existingById.get(event.id);
    const recordedById = prev?.recordedById ?? userId;
    return { ...event, recordedById };
  });
}
