import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { loadAITrainingAnalytics } from "@/lib/ai-training/load-analytics";
import { loadCopilotRollout, loadCopilotOpsStats } from "@/lib/ai/copilot-rollout";
import { CopilotRolloutPanel } from "@/components/super-admin/copilot-rollout-panel";
import { AITrainingClient } from "./ai-training-client";

export const dynamic = "force-dynamic";

export default async function AITrainingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await checkIsSuperAdmin(supabase, user.id))) {
    redirect("/dashboard");
  }

  const [analytics, rollout, opsStats] = await Promise.all([
    loadAITrainingAnalytics(supabase),
    loadCopilotRollout(),
    loadCopilotOpsStats(),
  ]);

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-slate-500 sm:px-6 lg:px-8">
          Loading AI Operations Dashboard…
        </div>
      }
    >
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {rollout ? (
          <CopilotRolloutPanel initial={rollout} opsStats={opsStats} />
        ) : null}
      </div>
      <AITrainingClient initialAnalytics={analytics} />
    </Suspense>
  );
}
