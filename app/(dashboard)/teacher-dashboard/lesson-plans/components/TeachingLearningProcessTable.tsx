"use client";

import { useCallback, useMemo, useState } from "react";
import {
  TEACHING_LEARNING_PROCESS_STAGES,
  parseTeachingLearningProcess,
  type TeachingLearningProcess,
  type TeachingLearningProcessStageKey,
} from "@/lib/teaching-learning-process";

interface TeachingLearningProcessTableProps {
  initialJson: unknown;
}

function updateStage(
  prev: TeachingLearningProcess,
  key: TeachingLearningProcessStageKey,
  patch: Partial<TeachingLearningProcess["introduction"]>
): TeachingLearningProcess {
  return {
    ...prev,
    [key]: { ...prev[key], ...patch },
  };
}

export function TeachingLearningProcessTable({
  initialJson,
}: TeachingLearningProcessTableProps) {
  const [data, setData] = useState<TeachingLearningProcess>(() =>
    parseTeachingLearningProcess(initialJson)
  );

  const jsonPayload = useMemo(() => JSON.stringify(data), [data]);

  const onTimeChange = useCallback(
    (key: TeachingLearningProcessStageKey, value: string) => {
      const trimmed = value.trim();
      const num =
        trimmed === "" ? null : Number.parseFloat(trimmed);
      setData((prev) =>
        updateStage(prev, key, {
          time:
            num != null && Number.isFinite(num) ? num : null,
        })
      );
    },
    []
  );

  const onTextChange = useCallback(
    (
      key: TeachingLearningProcessStageKey,
      field:
        | "teaching_activities"
        | "learning_activities"
        | "assessment_criteria",
      value: string
    ) => {
      setData((prev) => updateStage(prev, key, { [field]: value }));
    },
    []
  );

  return (
    <div className="max-w-full min-w-0 space-y-3">
      <input
        type="hidden"
        name="teaching_learning_process"
        value={jsonPayload}
        aria-hidden
      />
      <div className="max-w-full min-w-0 rounded-lg border border-slate-200 dark:border-zinc-700 md:overflow-x-auto">
        <table className="block w-full min-w-0 max-w-full border-collapse text-left text-sm print:table md:table md:w-full md:min-w-[720px] [&_td]:min-w-0 [&_th]:min-w-0">
          <thead className="hidden print:table-header-group md:table-header-group">
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800/80">
              <th
                scope="col"
                className="min-w-0 border-r border-slate-200 px-2 py-2 font-semibold text-slate-800 dark:border-zinc-600 dark:text-zinc-100 md:w-[140px]"
              >
                Stage
              </th>
              <th
                scope="col"
                className="min-w-0 border-r border-slate-200 px-2 py-2 font-semibold text-slate-800 dark:border-zinc-600 dark:text-zinc-100 md:w-[88px]"
              >
                Time (minutes)
              </th>
              <th
                scope="col"
                className="min-w-0 border-r border-slate-200 px-2 py-2 font-semibold text-slate-800 dark:border-zinc-600 dark:text-zinc-100 md:min-w-[140px]"
              >
                Teaching Activities
              </th>
              <th
                scope="col"
                className="min-w-0 border-r border-slate-200 px-2 py-2 font-semibold text-slate-800 dark:border-zinc-600 dark:text-zinc-100 md:min-w-[140px]"
              >
                Learning Activities
              </th>
              <th
                scope="col"
                className="min-w-0 px-2 py-2 font-semibold text-slate-800 dark:text-zinc-100 md:min-w-[140px]"
              >
                Assessment Criteria
              </th>
            </tr>
          </thead>
          <tbody className="block space-y-4 p-4 print:table-row-group print:space-y-0 print:p-0 md:table-row-group md:space-y-0 md:p-0">
            {TEACHING_LEARNING_PROCESS_STAGES.map(({ key, label }) => {
              const row = data[key];
              return (
                <tr
                  key={key}
                  className="block rounded-lg border border-slate-200 bg-slate-50/60 p-4 last:mb-0 dark:border-zinc-700 dark:bg-zinc-800/30 print:table-row print:border-0 print:border-b print:border-slate-100 print:bg-transparent print:p-0 md:table-row md:rounded-none md:border-0 md:border-b md:border-slate-100 md:bg-transparent md:p-0 md:last:border-b-0 dark:md:border-zinc-700"
                >
                  <th
                    scope="row"
                    className="block w-full min-w-0 bg-transparent px-0 pb-3 text-left text-base font-semibold text-slate-800 print:table-cell print:border-r print:border-slate-100 print:bg-slate-50/80 print:px-2 print:py-2 print:pb-2 print:text-sm print:font-medium md:table-cell md:w-auto md:border-r md:border-slate-100 md:bg-slate-50/80 md:px-2 md:py-2 md:text-sm md:font-medium md:align-top dark:border-zinc-700 dark:text-zinc-200 dark:md:bg-zinc-800/40"
                  >
                    {label}
                  </th>
                  <td className="block w-full min-w-0 max-w-full border-0 py-2 print:table-cell print:border-r print:border-slate-100 print:px-2 print:py-2 md:table-cell md:border-r md:border-slate-100 md:px-1 md:py-1 dark:md:border-zinc-700">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                      Time (minutes)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      className="w-full min-w-0 max-w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                      value={
                        row.time === null || row.time === undefined
                          ? ""
                          : row.time
                      }
                      onChange={(e) => onTimeChange(key, e.target.value)}
                      placeholder="—"
                      aria-label={`${label} — time in minutes`}
                    />
                  </td>
                  <td className="block w-full min-w-0 max-w-full border-0 py-2 print:table-cell print:border-r print:border-slate-100 print:px-2 print:py-2 md:table-cell md:border-r md:border-slate-100 md:px-1 md:py-1 dark:md:border-zinc-700">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                      Teaching activities
                    </span>
                    <textarea
                      rows={3}
                      className="max-w-full min-w-0 w-full resize-y rounded border border-gray-200 bg-white px-2 py-1.5 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                      value={row.teaching_activities}
                      onChange={(e) =>
                        onTextChange(key, "teaching_activities", e.target.value)
                      }
                      aria-label={`${label} — teaching activities`}
                    />
                  </td>
                  <td className="block w-full min-w-0 max-w-full border-0 py-2 print:table-cell print:border-r print:border-slate-100 print:px-2 print:py-2 md:table-cell md:border-r md:border-slate-100 md:px-1 md:py-1 dark:md:border-zinc-700">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                      Learning activities
                    </span>
                    <textarea
                      rows={3}
                      className="max-w-full min-w-0 w-full resize-y rounded border border-gray-200 bg-white px-2 py-1.5 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                      value={row.learning_activities}
                      onChange={(e) =>
                        onTextChange(key, "learning_activities", e.target.value)
                      }
                      aria-label={`${label} — learning activities`}
                    />
                  </td>
                  <td className="block w-full min-w-0 max-w-full border-0 py-2 print:table-cell print:px-2 print:py-2 md:table-cell md:px-1 md:py-1">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                      Assessment criteria
                    </span>
                    <textarea
                      rows={3}
                      className="max-w-full min-w-0 w-full resize-y rounded border border-gray-200 bg-white px-2 py-1.5 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                      value={row.assessment_criteria}
                      onChange={(e) =>
                        onTextChange(key, "assessment_criteria", e.target.value)
                      }
                      aria-label={`${label} — assessment criteria`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 dark:text-zinc-500">
        Fill each cell to match the official lesson plan format. Time can be
        entered in minutes for each stage.
      </p>
    </div>
  );
}
