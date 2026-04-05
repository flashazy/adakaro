import { redirect } from "next/navigation";

/** Alias URL for legacy “Link Requests” / Pending Approvals quick links → parent-requests. */
export default function LinkRequestsPage() {
  redirect("/dashboard/parent-requests");
}
