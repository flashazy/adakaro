import { Suspense } from "react";
import { BroadcastsDashboardClient } from "./broadcasts-dashboard-client";

function BroadcastsLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
      Loading broadcasts…
    </div>
  );
}

export default function SuperAdminBroadcastsPage() {
  return (
    <Suspense fallback={<BroadcastsLoading />}>
      <BroadcastsDashboardClient />
    </Suspense>
  );
}
