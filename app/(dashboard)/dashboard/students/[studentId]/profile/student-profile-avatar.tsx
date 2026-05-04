"use client";

import { Camera, ChevronDown, Info, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  STUDENT_AVATAR_MAX_BYTES,
  STUDENT_AVATAR_OUTPUT_SIZE,
  canvasToWebpBlob,
  compressStudentAvatarSourceFile,
  validateStudentAvatarFile,
} from "@/lib/student-avatar-canvas";
import {
  uploadStudentAvatar,
  type StudentAvatarObjectName,
} from "./profile-actions";
import { StudentAvatarCropModal } from "./student-avatar-crop-modal";
import { cn } from "@/lib/utils";

function canUseLiveCamera(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  return typeof navigator.mediaDevices?.getUserMedia === "function";
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  return (
    navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1
  );
}

function isCameraPermissionDenied(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false;
  return (
    err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
  );
}

interface StudentProfileAvatarProps {
  studentId: string;
  studentName: string;
  admissionNumber: string | null;
  classLabel: string | null;
  avatarUrl: string | null;
  /** When false, photo upload UI is hidden (e.g. teachers / dept viewers). */
  canChangePhoto?: boolean;
  /** Hide the inline headline (shown in profile header column instead). */
  hideHeadline?: boolean;
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
  hideHeadline = false,
}: StudentProfileAvatarProps) {
  const router = useRouter();
  const inputId = useId();
  const cameraInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);

  const [cropOpen, setCropOpen] = useState(false);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [isCompressing, setIsCompressing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [liveCameraOpen, setLiveCameraOpen] = useState(false);
  const [liveCameraStarting, setLiveCameraStarting] = useState(false);
  /** Avoid hydration mismatch: browser APIs differ from SSR. */
  const [hasClientEnv, setHasClientEnv] = useState(false);

  useEffect(() => {
    setHasClientEnv(true);
  }, []);

  const stopLiveCameraStream = useCallback(() => {
    const s = liveStreamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      liveStreamRef.current = null;
    }
    const v = liveVideoRef.current;
    if (v) {
      v.srcObject = null;
    }
  }, []);

  const closeLiveCamera = useCallback(() => {
    stopLiveCameraStream();
    setLiveCameraOpen(false);
    setLiveCameraStarting(false);
  }, [stopLiveCameraStream]);

  const openLiveCamera = useCallback(async () => {
    if (!canUseLiveCamera()) return;
    setBanner(null);
    setLiveCameraStarting(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (first) {
        if (
          first instanceof DOMException &&
          (first.name === "OverconstrainedError" ||
            first.name === "ConstraintNotSatisfiedError")
        ) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } else {
          throw first;
        }
      }
      liveStreamRef.current = stream;
      setLiveCameraOpen(true);
      queueMicrotask(() => {
        const v = liveVideoRef.current;
        if (v) {
          v.srcObject = stream;
          void v.play().catch(() => {
            /* play may fail before visible; retry on mount */
          });
        }
      });
    } catch (e) {
      if (isCameraPermissionDenied(e)) {
        setBanner({
          type: "err",
          text: "Camera access denied. Please check browser permissions.",
        });
      } else {
        setBanner({
          type: "err",
          text: "Could not open the camera. Try Take photo to use the system camera or gallery.",
        });
      }
    } finally {
      setLiveCameraStarting(false);
    }
  }, []);

  useEffect(() => {
    if (!liveCameraOpen) return;
    const v = liveVideoRef.current;
    const s = liveStreamRef.current;
    if (v && s) {
      v.srcObject = s;
      void v.play().catch(() => {});
    }
  }, [liveCameraOpen]);

  useEffect(() => {
    if (!liveCameraOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLiveCamera();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [liveCameraOpen, closeLiveCamera]);

  useEffect(() => {
    return () => {
      const s = liveStreamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!previewObjectUrl) return;
    return () => {
      URL.revokeObjectURL(previewObjectUrl);
    };
  }, [previewObjectUrl]);

  function resetCropState() {
    setCropOpen(false);
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }
    setPreviewObjectUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    closeLiveCamera();
  }

  function openTakePhotoPicker() {
    setBanner(null);
    cameraInputRef.current?.click();
  }

  async function captureLiveFrameToFile(): Promise<File | null> {
    const video = liveVideoRef.current;
    if (!video || video.readyState < 2) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w < 1 || h < 1) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
    });
    if (!blob || blob.size < 1) return null;
    return new File([blob], "camera.jpg", { type: "image/jpeg" });
  }

  async function confirmLiveCapture() {
    const file = await captureLiveFrameToFile();
    closeLiveCamera();
    if (file) void prepareFileAndOpenCrop(file);
    else
      setBanner({
        type: "err",
        text: "Could not capture this frame. Try again.",
      });
  }

  async function prepareFileAndOpenCrop(file: File) {
    setBanner(null);
    setIsCompressing(true);
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
          setBanner({
            type: "err",
            text:
              legacyErr ||
              (!comp.ok ? comp.error : "Could not prepare this image."),
          });
          if (fileInputRef.current) fileInputRef.current.value = "";
          if (cameraInputRef.current) cameraInputRef.current.value = "";
          return;
        }
      }

      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      const url = URL.createObjectURL(fileToUse);
      setPreviewObjectUrl(url);
      setCropOpen(true);
    } catch {
      setBanner({
        type: "err",
        text: "Something went wrong while processing the image.",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    } finally {
      setIsCompressing(false);
    }
  }

  function onFileChosen(file: File | null) {
    if (!file) return;
    void prepareFileAndOpenCrop(file);
  }

  function confirmUploadFromCanvas(canvas: HTMLCanvasElement | null) {
    if (!canvas) {
      setBanner({
        type: "err",
        text: "Could not prepare this image. Try again.",
      });
      return;
    }

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

  /** Display-only sizes: 128px mobile, 160px tablet; md/lg slightly smaller for header balance (desktop only). */
  const photoShellClass =
    "relative mx-auto aspect-square h-32 w-32 shrink-0 sm:h-40 sm:w-40 md:mx-0 md:h-[150px] md:w-[150px] lg:h-[168px] lg:w-[168px]";

  const photoFrameClass = `group relative flex h-full w-full shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-300/90 bg-slate-50 shadow-sm ring-1 ring-slate-900/[0.04] dark:border-zinc-600/90 dark:bg-zinc-800/80 dark:ring-white/[0.06] ${
    canChangePhoto
      ? "transition hover:border-[rgb(var(--school-primary-rgb)/0.4)] hover:bg-slate-100 hover:shadow-md disabled:opacity-60 dark:hover:border-school-primary dark:hover:bg-zinc-800"
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
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-1 text-slate-400 dark:text-zinc-500">
          <UserRound
            className="h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11"
            strokeWidth={1.25}
            aria-hidden
          />
          <span className="flex items-center gap-1 text-[10px] font-medium leading-none">
            <Camera className="h-3 w-3" aria-hidden />
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
    <div
      className={`flex w-full min-w-0 flex-col items-center justify-center ${hideHeadline ? "md:items-start" : ""}`}
    >
      {canChangePhoto ? (
        <div className={photoShellClass}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending || isCompressing}
            className={`${photoFrameClass} absolute inset-0`}
            aria-label="Upload or change student photo"
            aria-busy={isCompressing}
          >
            {photoFrameInner}
          </button>
          {isCompressing ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-full bg-white/90 text-center text-xs font-medium text-slate-700 shadow-inner dark:bg-zinc-950/90 dark:text-zinc-200">
              Processing photo…
            </div>
          ) : null}
        </div>
      ) : (
        <div className={photoShellClass} aria-hidden>
          <div className={`${photoFrameClass} absolute inset-0`}>
            {photoFrameInner}
          </div>
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
          <label htmlFor={cameraInputId} className="sr-only">
            Take student photo with camera
          </label>
          <input
            ref={cameraInputRef}
            id={cameraInputId}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              onFileChosen(f);
            }}
          />
        </>
      ) : null}

      {!hideHeadline ? (
        <h2 className="mt-3 w-full text-pretty text-center text-base font-semibold leading-snug tracking-tight text-slate-900 sm:mt-3.5 sm:text-lg md:mt-4 md:text-xl dark:text-white">
          {headline}
        </h2>
      ) : null}

      {canChangePhoto ? (
        <>
          <div
            className={cn(
              "w-full max-w-xs md:max-w-none",
              hideHeadline
                ? "mt-3 space-y-2 md:mt-3"
                : "mt-4 space-y-3 md:mt-5"
            )}
          >
            <div className="grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={pending || isCompressing}
                className={cn(
                  "w-full font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50",
                  "bg-gradient-to-r from-school-primary to-indigo-600 dark:to-indigo-500",
                  hideHeadline
                    ? "min-h-11 rounded-lg px-4 py-2.5 text-sm md:min-h-0 md:px-4 md:py-2"
                    : "min-h-11 rounded-xl px-3 py-2.5 text-sm hover:shadow-md"
                )}
              >
                Change photo
              </button>
              <button
                type="button"
                onClick={openTakePhotoPicker}
                disabled={
                  pending || isCompressing || liveCameraStarting || liveCameraOpen
                }
                className={cn(
                  "w-full border border-slate-300 bg-white font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
                  hideHeadline
                    ? "min-h-11 rounded-lg px-4 py-2.5 text-sm md:min-h-0 md:px-4 md:py-2"
                    : "min-h-11 rounded-xl px-3 py-2.5 text-sm"
                )}
              >
                Take photo
              </button>
            </div>
            {hasClientEnv && canUseLiveCamera() ? (
              <div
                className={cn(
                  "rounded-lg border dark:border-zinc-700/80 dark:bg-zinc-800/30",
                  hideHeadline
                    ? "border-slate-100 bg-slate-50/50 p-2"
                    : "border-slate-200/90 bg-slate-50/70 p-3 dark:bg-zinc-800/40"
                )}
              >
                <p
                  className={cn(
                    "font-medium text-slate-500 dark:text-zinc-400",
                    hideHeadline
                      ? "mb-1.5 text-[10px] uppercase tracking-wide md:mb-1"
                      : "mb-2 text-center text-[10px] font-semibold uppercase tracking-wide md:text-left"
                  )}
                >
                  {hideHeadline ? "Browser preview" : "Live browser preview"}
                </p>
                <button
                  type="button"
                  onClick={() => void openLiveCamera()}
                  disabled={
                    pending ||
                    isCompressing ||
                    liveCameraStarting ||
                    liveCameraOpen
                  }
                  className={cn(
                    "w-full border border-slate-300 bg-white font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
                    hideHeadline
                      ? "min-h-11 rounded-lg px-4 py-2.5 text-sm md:min-h-0 md:px-4 md:py-2"
                      : "min-h-11 rounded-xl px-3 py-2.5 text-sm"
                  )}
                >
                  {liveCameraStarting ? "Opening camera…" : "Open camera"}
                </button>
              </div>
            ) : null}
          </div>
          {hideHeadline ? (
            <details className="group mt-2 w-full max-w-xs rounded-lg border border-slate-100 bg-white/70 text-left dark:border-zinc-800 dark:bg-zinc-900/40 md:max-w-none [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-medium text-slate-500 transition hover:bg-slate-50/80 dark:text-zinc-400 dark:hover:bg-zinc-800/50">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Info
                    className="h-3.5 w-3.5 shrink-0 opacity-70"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="truncate">Photo tips & file rules</span>
                </span>
                <ChevronDown
                  className="h-3.5 w-3.5 shrink-0 opacity-50 transition group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="space-y-1.5 border-t border-slate-100 px-2.5 pb-2.5 pt-2 text-[10px] leading-snug text-slate-500 dark:border-zinc-800 dark:text-zinc-500">
                {!hasClientEnv ? (
                  <p>
                    Take photo uses your system camera or gallery when available.
                    On desktop you can pick an image file instead.
                  </p>
                ) : canUseLiveCamera() ? (
                  <p>
                    Open camera uses your browser for a live preview (HTTPS
                    required). Take photo uses your system camera or gallery.
                  </p>
                ) : (
                  <p>
                    Take photo uses your system camera or gallery when available.
                    On desktop you can pick an image file instead.
                  </p>
                )}
                {hasClientEnv && isIOS() ? (
                  <p className="text-slate-600 dark:text-zinc-400">
                    On iPhone, select &apos;Take Photo&apos; from the menu.
                  </p>
                ) : null}
                <p className="text-[10px] text-slate-400 dark:text-zinc-600">
                  {photoRequirementsDescription}
                </p>
              </div>
            </details>
          ) : (
            <div className="mt-3 flex w-full max-w-xs items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5 text-left dark:border-zinc-800 dark:bg-zinc-900/50 md:max-w-none">
              <Info
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-zinc-500"
                strokeWidth={2}
                aria-hidden
              />
              <div className="min-w-0 space-y-1.5 text-[11px] leading-snug text-slate-500 dark:text-zinc-500">
                {!hasClientEnv ? (
                  <p>
                    Take photo uses your system camera or gallery when available.
                    On desktop you can pick an image file instead.
                  </p>
                ) : canUseLiveCamera() ? (
                  <p>
                    Open camera uses your browser for a live preview (HTTPS
                    required). Take photo uses your system camera or gallery.
                  </p>
                ) : (
                  <p>
                    Take photo uses your system camera or gallery when available.
                    On desktop you can pick an image file instead.
                  </p>
                )}
                {hasClientEnv && isIOS() ? (
                  <p className="text-slate-600 dark:text-zinc-400">
                    On iPhone, select &apos;Take Photo&apos; from the menu.
                  </p>
                ) : null}
                <p className="text-[10px] text-slate-400 dark:text-zinc-600">
                  {photoRequirementsDescription}
                </p>
              </div>
            </div>
          )}
        </>
      ) : null}
      {banner ? (
        <p
          className={
            banner.type === "err"
              ? "mt-2 w-full text-center text-sm text-red-600 dark:text-red-400"
              : "mt-2 w-full text-center text-sm text-emerald-600 dark:text-emerald-400"
          }
          role={banner.type === "err" ? "alert" : "status"}
        >
          {banner.text}
        </p>
      ) : null}

      {cropOpen && previewObjectUrl ? (
        <StudentAvatarCropModal
          key={previewObjectUrl}
          imageUrl={previewObjectUrl}
          onCancel={resetCropState}
          onConfirm={(canvas) => confirmUploadFromCanvas(canvas)}
          pending={pending}
        />
      ) : null}

      {liveCameraOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isCompressing) closeLiveCamera();
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Live camera"
          >
            <p className="mb-3 text-center text-sm font-medium text-slate-800 dark:text-zinc-100">
              Position the student in frame, then capture
            </p>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
              <video
                ref={liveVideoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
              />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => !isCompressing && closeLiveCamera()}
                disabled={isCompressing}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => !isCompressing && void confirmLiveCapture()}
                disabled={isCompressing}
                className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
              >
                Use this frame
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
