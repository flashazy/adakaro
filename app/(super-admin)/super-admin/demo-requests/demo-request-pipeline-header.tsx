"use client";

import {
  computePipelineStageCounts,
  PIPELINE_STAGE_STYLES,
  SALES_PIPELINE_STAGES,
  type DemoRequestRow,
  type SalesPipelineStage,
} from "@/lib/demo-requests/types";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

const stageTone = Object.fromEntries(
  SALES_PIPELINE_STAGES.map((stage) => [stage, PIPELINE_STAGE_STYLES[stage].header])
) as Record<SalesPipelineStage, string>;

const stageActiveTone = Object.fromEntries(
  SALES_PIPELINE_STAGES.map((stage) => [
    stage,
    PIPELINE_STAGE_STYLES[stage].headerActive,
  ])
) as Record<SalesPipelineStage, string>;

export function DemoRequestPipelineHeader({
  rows,
  activeStatus,
  onStageClick,
}: {
  rows: Pick<DemoRequestRow, "status">[];
  activeStatus: string;
  onStageClick: (status: SalesPipelineStage | "") => void;
}) {
  const counts = computePipelineStageCounts(rows);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => onStageClick("")}
          className={cn(
            "shrink-0 rounded-lg border px-3 py-2 text-left transition-colors",
            activeStatus === ""
              ? "border-slate-800 bg-slate-900 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
            All
          </p>
          <p className="text-lg font-bold tabular-nums">{rows.length}</p>
        </button>

        {SALES_PIPELINE_STAGES.map((stage, index) => {
          const isActive = activeStatus === stage;
          return (
            <div key={stage} className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {index > 0 ? (
                <ChevronRight
                  className="hidden h-4 w-4 text-slate-300 sm:block"
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                onClick={() => onStageClick(stage)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  isActive ? stageActiveTone[stage] : stageTone[stage],
                  !isActive && "hover:brightness-[0.98]"
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                  {stage}
                </p>
                <p className="text-lg font-bold tabular-nums">{counts[stage]}</p>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
