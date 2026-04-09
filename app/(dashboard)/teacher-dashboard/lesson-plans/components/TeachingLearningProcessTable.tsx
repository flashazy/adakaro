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
    <div className="space-y-3">
      <input
        type="hidden"
        name="teaching_learning_process"
        value={jsonPayload}
        aria-hidden
      />
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
        <table className="min-w-[720px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800/80">
              <th
                scope="col"
                className="border-r border-slate-200 px-2 py-2 font-semibold text-slate-800 dark:border-zinc-600 dark:text-zinc-100 w-[140px]"
              >
                Stage
              </th>
              <th
                scope="col"
                className="border-r border-slate-200 px-2 py-2 font-semibold text-slate-800 dark:border-zinc-600 dark:text-zinc-100 w-[88px]"
              >
                Time (minutes)
              </th>
              <th
                scope="col"
                className="border-r border-slate-200 px-2 py-2 font-semibold text-slate-800 dark:border-zinc-600 dark:text-zinc-100 min-w-[140px]"
              >
                Teaching Activities
              </th>
              <th
                scope="col"
                className="border-r border-slate-200 px-2 py-2 font-semibold text-slate-800 dark:border-zinc-600 dark:text-zinc-100 min-w-[140px]"
              >
                Learning Activities
              </th>
              <th
                scope="col"
                className="px-2 py-2 font-semibold text-slate-800 dark:text-zinc-100 min-w-[140px]"
              >
                Assessment Criteria
              </th>
            </tr>
          </thead>
          <tbody>
            {TEACHING_LEARNING_PROCESS_STAGES.map(({ key, label }) => {
              const row = data[key];
              return (
                <tr
                  key={key}
                  className="border-b border-slate-100 last:border-b-0 dark:border-zinc-700"
                >
                  <th
                    scope="row"
                    className="border-r border-slate-100 bg-slate-50/80 px-2 py-2 align-top font-medium text-slate-800 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-200"
                  >
                    {label}
                  </th>
                  <td className="border-r border-slate-100 px-1 py-1 align-top dark:border-zinc-700">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      className="w-full min-w-0 rounded border border-gray-200 bg-white px-2 py-1.5 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
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
                  <td className="border-r border-slate-100 px-1 py-1 align-top dark:border-zinc-700">
                    <textarea
                      rows={3}
                      className="w-full min-w-0 resize-y rounded border border-gray-200 bg-white px-2 py-1.5 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                      value={row.teaching_activities}
                      onChange={(e) =>
                        onTextChange(key, "teaching_activities", e.target.value)
                      }
                      aria-label={`${label} — teaching activities`}
                    />
                  </td>
                  <td className="border-r border-slate-100 px-1 py-1 align-top dark:border-zinc-700">
                    <textarea
                      rows={3}
                      className="w-full min-w-0 resize-y rounded border border-gray-200 bg-white px-2 py-1.5 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                      value={row.learning_activities}
                      onChange={(e) =>
                        onTextChange(key, "learning_activities", e.target.value)
                      }
                      aria-label={`${label} — learning activities`}
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <textarea
                      rows={3}
                      className="w-full min-w-0 resize-y rounded border border-gray-200 bg-white px-2 py-1.5 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
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
