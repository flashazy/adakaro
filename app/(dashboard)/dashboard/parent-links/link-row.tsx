"use client";

import type { ParentLinkData } from "./link-row-types";

export type { ParentLinkData } from "./link-row-types";

export default function LinkRow({
  link,
  onRemoveRequest,
}: {
  link: ParentLinkData;
  onRemoveRequest: () => void;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-0 dark:border-zinc-800/50">
      <td className="px-6 py-3">
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {link.parentName}
        </p>
        {link.parentEmail && (
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {link.parentEmail}
          </p>
        )}
      </td>

      <td className="px-6 py-3">
        <p className="text-sm text-slate-900 dark:text-white">
          {link.studentName}
        </p>
      </td>

      <td className="hidden px-6 py-3 sm:table-cell">
        <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
          {link.className}
        </span>
      </td>

      <td className="px-6 py-3 text-right">
        <button
          type="button"
          onClick={onRemoveRequest}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800/40 dark:text-red-400 dark:hover:bg-red-950/20"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
            />
          </svg>
          Remove
        </button>
      </td>
    </tr>
  );
}
