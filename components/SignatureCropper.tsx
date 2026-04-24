"use client";

import { useEffect, useRef, useState, startTransition } from "react";

export type SignatureCropperProps = {
  isOpen: boolean;
  /** Object URL for preview */
  imageUrl: string;
  originalFile: File;
  onCancel: () => void;
  /** Called with cropped image as a File (same name as original). */
  onConfirm: (croppedFile: File) => void;
  /** Optional: upload without cropping */
  onUseOriginal?: () => void;
};

type Rect = { x: number; y: number; w: number; h: number };

const MIN_W = 20;
const MIN_H = 20;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function SignatureCropper({
  isOpen,
  imageUrl,
  originalFile,
  onCancel,
  onConfirm,
  onUseOriginal,
}: SignatureCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  /** Crop in displayed-image pixels (same box as img offsetWidth × offsetHeight). */
  const [dispCrop, setDispCrop] = useState<Rect | null>(null);
  const [imgBox, setImgBox] = useState({ dw: 0, dh: 0, nw: 0, nh: 0 });
  const drag = useRef<{
    kind: "move" | "nw" | "ne" | "sw" | "se";
    startCrop: Rect;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const imgBoxRef = useRef(imgBox);

  useEffect(() => {
    imgBoxRef.current = imgBox;
  }, [imgBox]);

  useEffect(() => {
    if (!isOpen) {
      drag.current = null;
      startTransition(() => {
        setDispCrop(null);
      });
    }
  }, [isOpen]);

  function startDrag(
    e: React.PointerEvent,
    kind: "move" | "nw" | "ne" | "sw" | "se"
  ) {
    if (!dispCrop) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = {
      kind,
      startCrop: { ...dispCrop },
      startClientX: e.clientX,
      startClientY: e.clientY,
    };

    function onPointerMove(ev: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      const { dw, dh } = imgBoxRef.current;
      if (dw <= 0 || dh <= 0) return;
      const dx = ev.clientX - d.startClientX;
      const dy = ev.clientY - d.startClientY;
      const s = d.startCrop;
      const next: Rect = { ...s };

      if (d.kind === "move") {
        next.x = clamp(s.x + dx, 0, dw - s.w);
        next.y = clamp(s.y + dy, 0, dh - s.h);
      } else if (d.kind === "se") {
        next.w = clamp(s.w + dx, MIN_W, dw - s.x);
        next.h = clamp(s.h + dy, MIN_H, dh - s.y);
      } else if (d.kind === "sw") {
        const nx = clamp(s.x + dx, 0, s.x + s.w - MIN_W);
        next.x = nx;
        next.w = s.x + s.w - nx;
        next.h = clamp(s.h + dy, MIN_H, dh - s.y);
      } else if (d.kind === "ne") {
        const ny = clamp(s.y + dy, 0, s.y + s.h - MIN_H);
        next.y = ny;
        next.h = s.y + s.h - ny;
        next.w = clamp(s.w + dx, MIN_W, dw - s.x);
      } else if (d.kind === "nw") {
        const nx = clamp(s.x + dx, 0, s.x + s.w - MIN_W);
        const ny = clamp(s.y + dy, 0, s.y + s.h - MIN_H);
        next.x = nx;
        next.y = ny;
        next.w = s.x + s.w - nx;
        next.h = s.y + s.h - ny;
      }

      setDispCrop(next);
    }

    function endPointer() {
      drag.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endPointer);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endPointer);
  }

  function handleSave() {
    const img = imgRef.current;
    if (!img || !dispCrop || !imgBox.dw || !imgBox.nw) return;
    const { nw, nh, dw, dh } = imgBox;
    const sx = nw / dw;
    const sy = nh / dh;
    const nx = Math.round(dispCrop.x * sx);
    const ny = Math.round(dispCrop.y * sy);
    const nwCrop = Math.round(dispCrop.w * sx);
    const nhCrop = Math.round(dispCrop.h * sy);
    if (nwCrop < 1 || nhCrop < 1) return;

    const canvas = document.createElement("canvas");
    canvas.width = nwCrop;
    canvas.height = nhCrop;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, nx, ny, nwCrop, nhCrop, 0, 0, nwCrop, nhCrop);

    const ext =
      originalFile.name.split(".").pop()?.toLowerCase().replace("jpeg", "jpg") ||
      "png";
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], originalFile.name, { type: mime });
        onConfirm(file);
      },
      mime,
      mime === "image/jpeg" ? 0.92 : undefined
    );
  }

  if (!isOpen) return null;

  const corner = (
    cls: string,
    kind: "nw" | "ne" | "sw" | "se",
    cursor: string
  ) => (
    <button
      type="button"
      aria-hidden
      tabIndex={-1}
      onPointerDown={(e) => {
        e.stopPropagation();
        startDrag(e, kind);
      }}
      className={`pointer-events-auto absolute z-20 h-3 w-3 rounded-sm border-2 border-white bg-blue-600 shadow ${cursor} ${cls}`}
    />
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl dark:bg-zinc-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-cropper-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="signature-cropper-title"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Crop signature
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Crop closely around the signature for best results.
        </p>

        <div className="relative mt-4 flex min-h-[200px] w-full items-center justify-center overflow-auto rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
          <div className="relative inline-block max-h-[50vh] max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Signature to crop"
              className="block max-h-[50vh] max-w-full object-contain"
              draggable={false}
              onLoad={() => {
                const img = imgRef.current;
                if (!img) return;
                const nw0 = img.naturalWidth;
                const nh0 = img.naturalHeight;
                const dw0 = img.offsetWidth;
                const dh0 = img.offsetHeight;
                setImgBox({ nw: nw0, nh: nh0, dw: dw0, dh: dh0 });
                setDispCrop({ x: 0, y: 0, w: dw0, h: dh0 });
              }}
            />
            {dispCrop && imgBox.dw > 0 ? (
              <div
                className="absolute box-border border-2 border-blue-600 bg-blue-500/20"
                style={{
                  left: dispCrop.x,
                  top: dispCrop.y,
                  width: dispCrop.w,
                  height: dispCrop.h,
                }}
              >
                <button
                  type="button"
                  aria-label="Move crop area"
                  className="pointer-events-auto absolute inset-0 cursor-move"
                  onPointerDown={(e) => startDrag(e, "move")}
                />
                {corner("left-0 top-0 -translate-x-1/2 -translate-y-1/2", "nw", "cursor-nwse-resize")}
                {corner("right-0 top-0 translate-x-1/2 -translate-y-1/2", "ne", "cursor-nesw-resize")}
                {corner("left-0 bottom-0 -translate-x-1/2 translate-y-1/2", "sw", "cursor-nesw-resize")}
                {corner("right-0 bottom-0 translate-x-1/2 translate-y-1/2", "se", "cursor-nwse-resize")}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {onUseOriginal ? (
            <button
              type="button"
              onClick={onUseOriginal}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Use original
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dispCrop}
            className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Save cropped
          </button>
        </div>
      </div>
    </div>
  );
}
