"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createDefaultProgressionTracksAction,
  createProgressionTrackAction,
  updateClassProgressionAction,
} from "./actions";

interface SetupClass {
  id: string;
  name: string;
  track_id: string | null;
  progression_order: number | null;
  parent_class_id: string | null;
}

interface ProgressionSetupPanelProps {
  tracks: { id: string; track_name: string }[];
  classes: SetupClass[];
}

export function ProgressionSetupPanel({
  tracks,
  classes,
}: ProgressionSetupPanelProps) {
  const [open, setOpen] = useState(tracks.length === 0);
  const [newTrack, setNewTrack] = useState("");
  const [pending, startTransition] = useTransition();

  const topLevel = classes.filter((c) => !c.parent_class_id);

  function saveClass(
    classId: string,
    trackId: string,
    orderRaw: string
  ) {
    const track_id = trackId.trim() || null;
    const progression_order =
      orderRaw.trim() === "" ? null : parseInt(orderRaw, 10);

    startTransition(async () => {
      const result = await updateClassProgressionAction(
        classId,
        track_id,
        Number.isFinite(progression_order as number)
          ? (progression_order as number)
          : null
      );
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "Saved.");
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left sm:px-5"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Class sequence setup
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Assign each class to a track and order (1 = first year, 2 = next, …)
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-zinc-800 sm:px-5">
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await createDefaultProgressionTracksAction();
                  if (r.error) toast.error(r.error);
                  else toast.success(r.success);
                })
              }
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Add Primary / Secondary / A-Level tracks
            </button>
            <input
              type="text"
              value={newTrack}
              onChange={(e) => setNewTrack(e.target.value)}
              placeholder="New track name"
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
            <button
              type="button"
              disabled={pending || !newTrack.trim()}
              onClick={() =>
                startTransition(async () => {
                  const r = await createProgressionTrackAction(newTrack);
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success(r.success);
                    setNewTrack("");
                  }
                })
              }
              className="rounded-lg bg-school-primary px-3 py-1.5 text-xs font-semibold text-white"
            >
              Add track
            </button>
          </div>

          {pending ? (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Saving…
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:border-zinc-800">
                  <th className="py-2 pr-3 font-medium">Class</th>
                  <th className="py-2 pr-3 font-medium">Track</th>
                  <th className="py-2 pr-3 font-medium">Order</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {topLevel.map((c) => (
                  <ClassProgressionRow
                    key={c.id}
                    cls={c}
                    tracks={tracks}
                    disabled={pending}
                    onSave={saveClass}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ClassProgressionRow({
  cls,
  tracks,
  disabled,
  onSave,
}: {
  cls: SetupClass;
  tracks: { id: string; track_name: string }[];
  disabled: boolean;
  onSave: (classId: string, trackId: string, order: string) => void;
}) {
  const [trackId, setTrackId] = useState(cls.track_id ?? "");
  const [order, setOrder] = useState(
    cls.progression_order != null ? String(cls.progression_order) : ""
  );

  return (
    <tr className="border-b border-slate-50 dark:border-zinc-800/80">
      <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">
        {cls.name}
      </td>
      <td className="py-2 pr-3">
        <select
          value={trackId}
          onChange={(e) => setTrackId(e.target.value)}
          className="w-full max-w-[140px] rounded border border-slate-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          disabled={disabled}
        >
          <option value="">—</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.track_name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        <input
          type="number"
          min={1}
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          className="w-20 rounded border border-slate-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          disabled={disabled}
        />
      </td>
      <td className="py-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSave(cls.id, trackId, order)}
          className="text-xs font-semibold text-school-primary hover:underline"
        >
          Save
        </button>
      </td>
    </tr>
  );
}
