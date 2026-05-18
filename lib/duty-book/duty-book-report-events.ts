import {
  DUTY_BOOK_EVENT_TYPES,
  type DutyBookEvent,
  type DutyBookEventType,
} from "./duty-book-report-types";

function newEventId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Normalize `<input type="time">` values (may include seconds) to HH:mm. */
export function normalizeEventTime(raw: string): string {
  const t = raw.trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(t);
  if (!match) return t;
  return `${match[1]}:${match[2]}`;
}

function isEventType(v: unknown): v is DutyBookEventType {
  return (
    typeof v === "string" &&
    (DUTY_BOOK_EVENT_TYPES as readonly string[]).includes(v)
  );
}

export function parseDutyBookEvents(raw: unknown): DutyBookEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: DutyBookEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const time =
      typeof row.time === "string" ? normalizeEventTime(row.time) : "";
    const description =
      typeof row.description === "string" ? row.description.trim() : "";
    if (!TIME_RE.test(time) || !description || !isEventType(row.type)) {
      continue;
    }
    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : newEventId();
    const recordedByRaw =
      typeof row.recorded_by_id === "string"
        ? row.recorded_by_id.trim()
        : typeof row.recordedById === "string"
          ? row.recordedById.trim()
          : "";
    const recordedById = recordedByRaw || null;
    out.push({ id, time, type: row.type, description, recordedById });
  }
  return out;
}

export function validateDutyBookEvents(events: DutyBookEvent[]): string | null {
  for (const e of events) {
    const time = normalizeEventTime(e.time);
    if (!TIME_RE.test(time)) {
      return "Each event needs a valid time (HH:MM).";
    }
    if (!isEventType(e.type)) {
      return "Invalid event type.";
    }
    if (!e.description.trim()) {
      return "Each event needs a description.";
    }
    if (e.description.length > 2000) {
      return "Event descriptions must be 2000 characters or fewer.";
    }
  }
  if (events.length > 100) {
    return "Too many events for one day (max 100).";
  }
  return null;
}

export function newDutyBookEvent(): DutyBookEvent {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return {
    id: newEventId(),
    time: `${hh}:${mm}`,
    type: "other",
    description: "",
  };
}
