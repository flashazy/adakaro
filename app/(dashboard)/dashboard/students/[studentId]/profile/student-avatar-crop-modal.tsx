"use client";

import { RotateCw } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { STUDENT_AVATAR_OUTPUT_SIZE } from "@/lib/student-avatar-canvas";
import { renderStudentAvatarEasyCropToCanvas } from "@/lib/student-avatar-easy-crop-output";

interface StudentAvatarCropModalProps {
  imageUrl: string;
  onCancel: () => void;
  /** Called with a 200×200 canvas, or null if export failed. */
  onConfirm: (canvas: HTMLCanvasElement | null) => void;
  pending: boolean;
}

export function StudentAvatarCropModal({
  imageUrl,
  onCancel,
  onConfirm,
  pending,
}: StudentAvatarCropModalProps) {
  const titleId = useId();
  const zoomInputId = useId();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const croppedAreaPixelsRef = useRef<Area | null>(null);

  async function handleSave() {
    const pixels = croppedAreaPixelsRef.current;
    if (!pixels) {
      onConfirm(null);
      return;
    }
    const canvas = await renderStudentAvatarEasyCropToCanvas(
      imageUrl,
      pixels,
      rotation,
      STUDENT_AVATAR_OUTPUT_SIZE
    );
    onConfirm(canvas);
  }

  const [cropReady, setCropReady] = useState(false);
  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    croppedAreaPixelsRef.current = areaPixels;
    setCropReady(true);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700">
          <h3
            id={titleId}
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            Adjust crop
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Drag to reposition, pinch or scroll to zoom. Output is{" "}
            {STUDENT_AVATAR_OUTPUT_SIZE}×{STUDENT_AVATAR_OUTPUT_SIZE}px (square).
          </p>
        </div>
        <div className="space-y-4 px-4 py-4">
          <div className="relative mx-auto w-full overflow-hidden rounded-lg border border-slate-200 bg-black dark:border-zinc-700">
            <div className="relative aspect-square w-full">
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="rect"
                showGrid
                restrictPosition
                minZoom={1}
                maxZoom={2.5}
                zoomSpeed={1}
                zoomWithScroll
                keyboardStep={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
                style={{}}
                classes={{}}
                mediaProps={{ alt: "" }}
                cropperProps={{}}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={zoomInputId}
              className="text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Zoom
            </label>
            <input
              id={zoomInputId}
              type="range"
              min={1}
              max={2.5}
              step={0.05}
              value={zoom}
              disabled={pending}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="mt-2 block w-full accent-school-primary"
            />
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <RotateCw className="h-4 w-4" aria-hidden />
              Rotate 90°
            </button>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => !pending && onCancel()}
              disabled={pending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={pending || !cropReady}
              className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
            >
              {pending ? "Uploading…" : "Save photo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
