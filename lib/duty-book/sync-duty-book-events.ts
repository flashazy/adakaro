import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { enrichDutyBookEventsWithRecorders } from "./enrich-duty-book-events";
import type { DutyBookEvent } from "./duty-book-report-types";

type AdminClient = SupabaseClient<Database>;

export async function syncDutyBookEvents(
  admin: AdminClient,
  input: {
    reportId: string;
    schoolId: string;
    userId: string;
    events: DutyBookEvent[];
    existingEvents: DutyBookEvent[];
  }
): Promise<void> {
  const enriched = enrichDutyBookEventsWithRecorders(
    input.events,
    input.existingEvents,
    input.userId
  );

  for (const event of enriched) {
    if (!event.recordedById) {
      throw new Error("Each event must have a recorder.");
    }
  }

  const incomingIds = new Set(enriched.map((e) => e.id));
  const removedIds = input.existingEvents
    .filter((e) => !incomingIds.has(e.id))
    .map((e) => e.id);

  if (removedIds.length > 0) {
    const { error: delErr } = await admin
      .from("duty_book_events")
      .delete()
      .eq("report_id", input.reportId)
      .in("id", removedIds);
    if (delErr) throw new Error(delErr.message);
  }

  if (enriched.length === 0) return;

  const rows = enriched.map((event) => ({
    id: event.id,
    report_id: input.reportId,
    school_id: input.schoolId,
    event_time: event.time,
    event_type: event.type,
    description: event.description.trim(),
    recorded_by_id: event.recordedById!,
  }));

  const { error: upsertErr } = await admin
    .from("duty_book_events")
    .upsert(rows as never, { onConflict: "id" });
  if (upsertErr) throw new Error(upsertErr.message);
}
