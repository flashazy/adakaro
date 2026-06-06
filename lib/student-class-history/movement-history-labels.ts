import type { StudentClassHistorySource } from "./types";

const SOURCE_LABELS: Record<StudentClassHistorySource, string> = {
  streaming: "Streaming",
  promotion: "Promotion",
  admin_edit: "Admin edit",
};

export function movementHistorySourceLabel(
  source: StudentClassHistorySource
): string {
  return SOURCE_LABELS[source] ?? source;
}
