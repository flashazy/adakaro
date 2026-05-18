import { resolveUserDisplayNames } from "@/lib/users/resolve-user-display-name";
import type { DutyBookEvent, DutyBookReportRow } from "./duty-book-report-types";

export async function attachDutyBookDisplayNames(
  report: DutyBookReportRow
): Promise<DutyBookReportRow> {
  const userIds: string[] = [];
  if (report.remarksLastModifiedById) {
    userIds.push(report.remarksLastModifiedById);
  }
  for (const event of report.events) {
    if (event.recordedById) userIds.push(event.recordedById);
  }

  const names = await resolveUserDisplayNames(userIds);

  return {
    ...report,
    remarksLastModifiedByName: report.remarksLastModifiedById
      ? (names.get(report.remarksLastModifiedById) ?? null)
      : null,
    events: report.events.map((event) => ({
      ...event,
      recordedByName: event.recordedById
        ? (names.get(event.recordedById) ?? null)
        : null,
    })),
  };
}
