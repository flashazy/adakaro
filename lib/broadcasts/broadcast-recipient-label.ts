import type { BroadcastTargetType } from "@/lib/broadcasts/broadcast-target-types";

/** Display label for the Recipients column in Sent Broadcasts. */
export function broadcastRecipientLabel(broadcast: {
  target_user_ids: string[] | null;
  target_type?: string | null;
  target_school_id?: string | null;
  target_school_ids?: string[] | null;
}): string {
  const count = broadcast.target_user_ids?.length ?? 0;
  const targetType = (broadcast.target_type as BroadcastTargetType | null) ?? null;

  if (targetType === "single_school" || broadcast.target_school_id) {
    if (count > 0) {
      return `${count} Admin${count === 1 ? "" : "s"}`;
    }
    return "School admins";
  }

  if (targetType === "selected_schools" || broadcast.target_school_ids?.length) {
    const schools = broadcast.target_school_ids?.length ?? 0;
    if (count > 0) {
      return `${count} Admin${count === 1 ? "" : "s"}`;
    }
    return schools > 0
      ? `${schools} School${schools === 1 ? "" : "s"}`
      : "Selected schools";
  }

  if (count > 0) {
    return `${count} Admin${count === 1 ? "" : "s"}`;
  }

  return "All Admins";
}
