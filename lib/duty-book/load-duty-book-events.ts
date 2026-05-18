import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { parseDutyBookEvents } from "./duty-book-report-events";
import type { DutyBookEvent, DutyBookEventType } from "./duty-book-report-types";

type Supabase = SupabaseClient<Database>;

const EVENT_TYPES: readonly DutyBookEventType[] = [
  "incident",
  "guest",
  "announcement",
  "other",
];

function isEventType(v: string): v is DutyBookEventType {
  return (EVENT_TYPES as readonly string[]).includes(v);
}

type EventDbRow = {
  id: string;
  event_time: string;
  event_type: string;
  description: string;
  recorded_by_id: string | null;
};

function mapEventRow(row: EventDbRow): DutyBookEvent {
  return {
    id: row.id,
    time: row.event_time,
    type: isEventType(row.event_type) ? row.event_type : "other",
    description: row.description,
    recordedById: row.recorded_by_id,
  };
}

export async function loadDutyBookEvents(
  supabase: Supabase,
  reportId: string,
  legacyJsonEvents: unknown
): Promise<DutyBookEvent[]> {
  const { data, error } = await supabase
    .from("duty_book_events")
    .select("id, event_time, event_type, description, recorded_by_id")
    .eq("report_id", reportId)
    .order("event_time", { ascending: true });

  if (error) {
    const msg = error.message ?? "";
    if (/duty_book_events|does not exist|schema cache/i.test(msg)) {
      return parseDutyBookEvents(legacyJsonEvents);
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as EventDbRow[];
  if (rows.length > 0) {
    return rows.map(mapEventRow);
  }

  return parseDutyBookEvents(legacyJsonEvents);
}
