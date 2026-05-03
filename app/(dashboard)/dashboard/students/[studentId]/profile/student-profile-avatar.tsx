"use client";

import { Camera, Info, UserRound } from "lucide-react";
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

  /** Display-only sizes (upload pipeline unchanged). */
  const photoShellClass =
    "relative mx-auto aspect-square w-36 shrink-0 sm:w-40 md:w-44 lg:h-[200px] lg:w-[200px]";

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
    <div className="flex w-full min-w-0 flex-col items-center justify-center">
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
        <div className={`${photoShellClass}`} aria-hidden>
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

      <h2 className="mt-3 w-full text-pretty text-center text-base font-semibold leading-snug tracking-tight text-slate-900 sm:mt-3.5 sm:text-lg md:mt-4 md:text-xl dark:text-white">
        {headline}
      </h2>

      {canChangePhoto ? (
        <>
          <div className="mx-auto grid w-full max-w-xs grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending || isCompressing}
              className="min-h-11 w-full rounded-lg bg-school-primary px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50"
            >
              Change photo
            </button>
            <button
              type="button"
              onClick={openTakePhotoPicker}
              disabled={
                pending || isCompressing || liveCameraStarting || liveCameraOpen
              }
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Take photo
            </button>
            {hasClientEnv && canUseLiveCamera() ? (
              <button
                type="button"
                onClick={() => void openLiveCamera()}
                disabled={
                  pending ||
                  isCompressing ||
                  liveCameraStarting ||
                  liveCameraOpen
                }
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 sm:col-span-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {liveCameraStarting ? "Opening camera…" : "Open camera"}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title={photoRequirementsDescription}
            aria-label={`Photo requirements: ${photoRequirementsDescription}`}
          >
            <Info className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <div className="mt-2 max-w-xs space-y-2 text-center text-xs leading-relaxed text-gray-500 dark:text-zinc-500">
            {!hasClientEnv ? (
              <p>
                Take photo uses your system camera or gallery when available. On
                desktop you can pick an image file instead.
              </p>
            ) : canUseLiveCamera() ? (
              <p>
                Open camera uses your browser for a live preview (HTTPS
                required). Take photo uses your system camera or gallery.
              </p>
            ) : (
              <p>
                Take photo uses your system camera or gallery when available. On
                desktop you can pick an image file instead.
              </p>
            )}
            {hasClientEnv && isIOS() ? (
              <p className="text-slate-600 dark:text-zinc-400">
                On iPhone, select &apos;Take Photo&apos; from the menu.
              </p>
            ) : null}
          </div>
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
