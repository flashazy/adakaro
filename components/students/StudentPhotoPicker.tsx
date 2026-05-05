"use client";

import { Camera, Upload, UserRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  STUDENT_AVATAR_MAX_BYTES,
  STUDENT_AVATAR_OUTPUT_SIZE,
  canvasToWebpBlob,
  compressStudentAvatarSourceFile,
  validateStudentAvatarFile,
} from "@/lib/student-avatar-canvas";
import { StudentAvatarCropModal } from "@/app/(dashboard)/dashboard/students/[studentId]/profile/student-avatar-crop-modal";
import { toast } from "sonner";

type PickerSize = "default" | "compact";

export interface StudentPhotoDraft {
  file: File;
  previewUrl: string;
}

interface StudentPhotoPickerProps {
  studentName: string;
  title?: string;
  subtitle?: string;
  size?: PickerSize;
  currentPhotoUrl?: string | null;
  draft?: StudentPhotoDraft | null;
  disabled?: boolean;
  pending?: boolean;
  allowRemove?: boolean;
  onDraftChange: (draft: StudentPhotoDraft | null) => void;
  onRemoveCurrent?: () => Promise<{ error?: string; ok?: true }>;
}

async function blobFromOutputCanvas(
  canvas: HTMLCanvasElement
): Promise<{ blob: Blob; objectName: "avatar.webp" | "avatar.jpg" | "avatar.png" } | null> {
  const webp = await canvasToWebpBlob(canvas, 0.92);
  if (webp && webp.size > 0) return { blob: webp, objectName: "avatar.webp" };
  const jpeg = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
  });
  if (jpeg && jpeg.size > 0) return { blob: jpeg, objectName: "avatar.jpg" };
  const png = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
  if (png && png.size > 0) return { blob: png, objectName: "avatar.png" };
  return null;
}

function initialsFromName(name: string): string {
  const bits = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (bits.length === 0) return "ST";
  return bits.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function StudentPhotoPicker({
  studentName,
  title = "Student Photo",
  subtitle = "Optional photo used on student profiles and records.",
  size = "default",
  currentPhotoUrl = null,
  draft,
  disabled = false,
  pending = false,
  allowRemove = true,
  onDraftChange,
  onRemoveCurrent,
}: StudentPhotoPickerProps) {
  const inputId = useId();
  const cameraInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRemoving, startRemove] = useTransition();

  useEffect(() => {
    if (!previewObjectUrl) return;
    return () => URL.revokeObjectURL(previewObjectUrl);
  }, [previewObjectUrl]);

  function resetCropState() {
    setCropOpen(false);
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    setPreviewObjectUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  async function prepareFileAndOpenCrop(file: File) {
    setIsProcessing(true);
    try {
      const comp = await compressStudentAvatarSourceFile(file);
      let fileToUse: File | null = null;
      if (comp.ok) {
        const err = validateStudentAvatarFile(comp.file);
        if (!err) fileToUse = comp.file;
      }
      if (!fileToUse) {
        const legacyErr = validateStudentAvatarFile(file);
        if (!legacyErr) fileToUse = file;
        else {
          toast.error(
            legacyErr ||
              (!comp.ok ? comp.error : "Could not prepare this image.")
          );
          return;
        }
      }
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(URL.createObjectURL(fileToUse));
      setCropOpen(true);
    } catch {
      toast.error("Something went wrong while processing the image.");
    } finally {
      setIsProcessing(false);
    }
  }

  function onFileChosen(file: File | null) {
    if (!file) return;
    void prepareFileAndOpenCrop(file);
  }

  function confirmFromCanvas(canvas: HTMLCanvasElement | null) {
    if (!canvas) {
      toast.error("Could not prepare this image. Try another photo.");
      return;
    }
    void (async () => {
      const packed = await blobFromOutputCanvas(canvas);
      if (!packed) {
        toast.error("Could not prepare this image. Try another photo.");
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
      const outFile = new File([packed.blob], packed.objectName, {
        type: mime,
      });
      const nextPreview = URL.createObjectURL(outFile);
      onDraftChange({ file: outFile, previewUrl: nextPreview });
      resetCropState();
    })();
  }

  const showPhotoUrl = draft?.previewUrl ?? currentPhotoUrl ?? null;
  const hasPhoto = Boolean(showPhotoUrl);
  const buttonBusy = disabled || pending || isProcessing || isRemoving;
  const shell = size === "compact" ? "rounded-xl border bg-white p-5 space-y-4" : "rounded-2xl border bg-white p-6 shadow-sm space-y-5";
  const avatarSize = size === "compact" ? "h-16 w-16" : "h-24 w-24";

  return (
    <section className={shell}>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className={`relative ${avatarSize} shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-50`}
        >
          {showPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={showPhotoUrl}
              alt={`${studentName} photo`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
              <UserRound className="h-7 w-7" aria-hidden />
              <span className="text-[10px] font-semibold tracking-wide">
                {initialsFromName(studentName)}
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={buttonBusy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" aria-hidden />
              {hasPhoto ? "Change photo" : "Upload photo"}
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={buttonBusy}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" aria-hidden />
              Take photo
            </button>
            {allowRemove && (hasPhoto || currentPhotoUrl) ? (
              <button
                type="button"
                disabled={buttonBusy}
                onClick={() => {
                  if (draft) {
                    URL.revokeObjectURL(draft.previewUrl);
                    onDraftChange(null);
                    return;
                  }
                  if (!onRemoveCurrent) return;
                  startRemove(() => {
                    void onRemoveCurrent().then((res) => {
                      if (res?.error) {
                        toast.error(res.error);
                        return;
                      }
                      onDraftChange(null);
                    });
                  });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden />
                Remove
              </button>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            JPG, PNG or WebP up to{" "}
            {Math.round(STUDENT_AVATAR_MAX_BYTES / (1024 * 1024))}MB. Cropped to{" "}
            {STUDENT_AVATAR_OUTPUT_SIZE}×{STUDENT_AVATAR_OUTPUT_SIZE}px.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
      />
      <input
        ref={cameraInputRef}
        id={cameraInputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
      />

      {cropOpen && previewObjectUrl ? (
        <StudentAvatarCropModal
          key={previewObjectUrl}
          imageUrl={previewObjectUrl}
          onCancel={resetCropState}
          onConfirm={(canvas) => confirmFromCanvas(canvas)}
          pending={pending || isProcessing}
        />
      ) : null}
    </section>
  );
}
