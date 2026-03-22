import { redirect } from "next/navigation";

/** Alias URL for “Link Requests” quick action → same screen as parent-requests. */
export default function LinkRequestsPage() {
  redirect("/dashboard/parent-requests");
}
