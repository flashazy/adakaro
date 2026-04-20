import { redirect } from "next/navigation";

/** Alias URL for legacy “Link Requests” quick links → pending approvals. */
export default function LinkRequestsPage() {
  redirect("/dashboard/parent-links/pending");
}
