"use client";

import { Camera, Info, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import {
  STUDENT_AVATAR_MAX_BYTES,
  STUDENT_AVATAR_OUTPUT_SIZE,
  canvasToWebpBlob,
  drawStudentAvatarPreview,
  validateStudentAvatarFile,
} from "@/lib/student-avatar-canvas";
import {
  uploadStudentAvatar,
  type StudentAvatarObjectName,
} from "./profile-actions";

interface StudentProfileAvatarProps {
  studentId: string;
  studentName: string;
  admissionNumber: string | null;
  classLabel: string | null;
  avatarUrl: string | null;
  /** When false, photo upload UI is hidden (e.g. teachers / dept viewers). */
  canChangePhoto?: boolean;
}

async function blobFromOutputCanvas(
  canvas: HTMLCanvasElement
): Promise<{ blob: Blob; objectName: StudentAvatarObjectName } | null> {
  const webp = await canvasToWebpBlob(canvas, 0.92);
  if (webp && webp.size > 0) {
    return { blob: webp, objectName: "avatar.webp" };
  }
  const jpeg = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
  });
  if (jpeg && jpeg.size > 0) {
    return { blob: jpeg, objectName: "avatar.jpg" };
  }
  const png = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
  if (png && png.size > 0) {
    return { blob: png, objectName: "avatar.png" };
  }
  return null;
}

export function StudentProfileAvatar({
  studentId,
  studentName,
  admissionNumber,
  classLabel,
  avatarUrl,
  canChangePhoto = true,
}: StudentProfileAvatarProps) {
  const router = useRouter();
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceImgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [cropOpen, setCropOpen] = useState(false);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  const redrawPreview = useCallback(() => {
    const img = sourceImgRef.current;
    const canvas = previewCanvasRef.current;
    if (!img?.complete || !canvas || img.naturalWidth < 1) return;
    drawStudentAvatarPreview(
      img,
      canvas,
      STUDENT_AVATAR_OUTPUT_SIZE,
      zoom
    );
  }, [zoom]);

  useEffect(() => {
    redrawPreview();
  }, [redrawPreview, sourceReady]);

  useEffect(() => {
    if (!previewObjectUrl) return;
    return () => {
      URL.revokeObjectURL(previewObjectUrl);
    };
  }, [previewObjectUrl]);

  function resetCropState() {
    setCropOpen(false);
    setSourceReady(false);
    setZoom(1);
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }
    setPreviewObjectUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onFileChosen(file: File | null) {
    setBanner(null);
    if (!file) return;
    const err = validateStudentAvatarFile(file);
    if (err) {
      setBanner({ type: "err", text: err });
      return;
    }
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    const url = URL.createObjectURL(file);
    setPreviewObjectUrl(url);
    setSourceReady(false);
    setZoom(1);
    setCropOpen(true);
  }

  function confirmUpload() {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    startTransition(async () => {
      setBanner(null);
      const packed = await blobFromOutputCanvas(canvas);
      if (!packed) {
        setBanner({
          type: "err",
          text: "Could not prepare this image. Try another file.",
        });
        return;
      }

      const mime =
        packed.blob.type && packed.blob.type.startsWith("image/")
          ? packed.blob.type
          : packed.objectName === "avatar.webp"
            ? "image/webp"
            : packed.objectName === "avatar.jpg"
              ? "image/jpeg"
              : "image/png";
      const filePayload =
        packed.blob.type === mime
          ? packed.blob
          : new File([packed.blob], packed.objectName, { type: mime });

      const fd = new FormData();
      fd.append("avatar", filePayload, packed.objectName);
      const res = await uploadStudentAvatar(studentId, fd);
      if (res.error) {
        setBanner({ type: "err", text: res.error });
        return;
      }

      resetCropState();
      setBanner({ type: "ok", text: "Photo updated." });
      router.refresh();
    });
  }

  const adm = admissionNumber?.trim() ?? "";
  const nameWithAdmission = adm
    ? `${studentName} (ADM: ${adm})`
    : studentName;
  const headline = classLabel
    ? `${nameWithAdmission} · ${classLabel}`
    : nameWithAdmission;

  const photoRequirementsDescription = `JPG, PNG or WebP · max ${Math.round(
    STUDENT_AVATAR_MAX_BYTES / (1024 * 1024)
  )}MB · saved as ${STUDENT_AVATAR_OUTPUT_SIZE}×${STUDENT_AVATAR_OUTPUT_SIZE}px (square)`;

  const showAvatar =
    typeof avatarUrl === "string" &&
    (avatarUrl.startsWith("https://") ||
      avatarUrl.startsWith("http://localhost") ||
      avatarUrl.startsWith("http://127.0.0.1"));

  const photoFrameClass = `group relative flex h-[200px] w-[200px] shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800/80 ${
    canChangePhoto
      ? "transition hover:border-[rgb(var(--school-primary-rgb)/0.45)] hover:bg-slate-100 disabled:opacity-60 dark:hover:border-school-primary dark:hover:bg-zinc-800"
      : ""
  }`;

  const photoFrameInner = (
    <>
      {showAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage host varies by project env
        <img
          src={avatarUrl}
          alt=""
          width={STUDENT_AVATAR_OUTPUT_SIZE}
          height={STUDENT_AVATAR_OUTPUT_SIZE}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-zinc-500">
          <UserRound className="h-16 w-16" strokeWidth={1.25} aria-hidden />
          <span className="flex items-center gap-1 text-xs font-medium">
            <Camera className="h-3.5 w-3.5" aria-hidden />
            Photo
          </span>
        </div>
      )}
      {canChangePhoto ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent py-2 text-center text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
          Click to upload
        </span>
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <div className="flex shrink-0 flex-col items-center gap-2 sm:items-start">
        {canChangePhoto ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
            className={photoFrameClass}
            aria-label="Upload or change student photo"
          >
            {photoFrameInner}
          </button>
        ) : (
          <div className={photoFrameClass} aria-hidden>
            {photoFrameInner}
          </div>
        )}
        {canChangePhoto ? (
          <>
            <label htmlFor={inputId} className="sr-only">
              Upload student photo
            </label>
            <input
              ref={fileInputRef}
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                onFileChosen(f);
              }}
            />
          </>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {headline}
          </h2>
        </div>
        {canChangePhoto ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending}
              className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50"
            >
              Change photo
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              title={photoRequirementsDescription}
              aria-label={`Photo requirements: ${photoRequirementsDescription}`}
            >
              <Info className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : null}
        {banner ? (
          <p
            className={
              banner.type === "err"
                ? "text-sm text-red-600 dark:text-red-400"
                : "text-sm text-emerald-600 dark:text-emerald-400"
            }
            role={banner.type === "err" ? "alert" : "status"}
          >
            {banner.text}
          </p>
        ) : null}
      </div>

      {cropOpen && previewObjectUrl ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) resetCropState();
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="crop-dialog-title"
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700">
              <h3
                id="crop-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                Adjust crop
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Preview is {STUDENT_AVATAR_OUTPUT_SIZE}×{STUDENT_AVATAR_OUTPUT_SIZE}px. Use
                zoom to frame the face, then save.
              </p>
            </div>
            <div className="space-y-4 px-4 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={sourceImgRef}
                src={previewObjectUrl}
                alt=""
                className="hidden"
                onLoad={() => setSourceReady(true)}
              />
              <div className="flex justify-center">
                <canvas
                  ref={previewCanvasRef}
                  width={STUDENT_AVATAR_OUTPUT_SIZE}
                  height={STUDENT_AVATAR_OUTPUT_SIZE}
                  className="rounded-lg border border-slate-200 shadow-sm dark:border-zinc-700"
                />
              </div>
              <div>
                <label
                  htmlFor="avatar-zoom"
                  className="text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Zoom (crop)
                </label>
                <input
                  id="avatar-zoom"
                  type="range"
                  min={1}
                  max={2.5}
                  step={0.05}
                  value={zoom}
                  disabled={!sourceReady || pending}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="mt-2 block w-full accent-school-primary"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => !pending && resetCropState()}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmUpload}
                  disabled={pending || !sourceReady}
                  className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
                >
                  {pending ? "Uploading…" : "Save photo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
