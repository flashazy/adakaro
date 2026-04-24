"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { removeSchoolStamp, uploadSchoolStamp } from "./actions";
import type { SchoolSettingsState } from "./school-settings-shared";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT =
  "image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp";

function stripUrlQuery(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

function RemoveStampButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {pending ? "Removing…" : "Remove stamp"}
    </button>
  );
}

const initialState: SchoolSettingsState = {};

export function SchoolStampForm({
  initialStampUrl,
  initialStampVersion,
}: {
  initialStampUrl: string | null;
  initialStampVersion: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(0);
  const lastToastU = useRef(0);
  const lastToastR = useRef(0);
  const lastErrU = useRef<string | null>(null);
  const lastErrR = useRef<string | null>(null);

  const [uploadState, uploadAction, isUploadPending] = useActionState(
    uploadSchoolStamp,
    initialState
  );
  const [removeState, removeAction] = useActionState(
    removeSchoolStamp,
    initialState
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (uploadState.success) {
      const t = uploadState.stampVersion ?? uploadState.completedAt ?? 0;
      if (t !== lastToastU.current) {
        lastToastU.current = t;
        lastErrU.current = null;
        toast.success("School stamp saved.");
      }
    } else if (uploadState.error) {
      if (uploadState.error !== lastErrU.current) {
        lastErrU.current = uploadState.error;
        toast.error(uploadState.error);
      }
    }
  }, [uploadState.success, uploadState.error, uploadState.stampVersion, uploadState.completedAt]);

  useEffect(() => {
    if (removeState.success) {
      const t = removeState.stampVersion ?? removeState.completedAt ?? 0;
      if (t !== lastToastR.current) {
        lastToastR.current = t;
        lastErrR.current = null;
        toast.success("School stamp removed.");
      }
    } else if (removeState.error) {
      if (removeState.error !== lastErrR.current) {
        lastErrR.current = removeState.error;
        toast.error(removeState.error);
      }
    }
  }, [removeState.success, removeState.error, removeState.stampVersion, removeState.completedAt]);

  useEffect(() => {
    if (!uploadState.success && !removeState.success) return;
    const t =
      uploadState.stampVersion ??
      removeState.stampVersion ??
      uploadState.completedAt ??
      removeState.completedAt ??
      Date.now();
    setCacheBust(t);
    setPickError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }, [
    uploadState.success,
    removeState.success,
    uploadState.completedAt,
    removeState.completedAt,
    uploadState.stampVersion,
    removeState.stampVersion,
    router,
  ]);

  const serverStampUrl =
    removeState.success && !uploadState.success
      ? null
      : (initialStampUrl?.trim() ?? null);

  const versionForServer =
    uploadState.success && uploadState.stampVersion != null
      ? uploadState.stampVersion
      : removeState.success && !uploadState.success
        ? null
        : initialStampVersion;

  const effectiveUrl =
    uploadState.success && uploadState.publicUrl?.trim()
      ? uploadState.publicUrl.trim()
      : serverStampUrl;

  const displayUrl = previewUrl
    ? previewUrl
    : effectiveUrl != null &&
        versionForServer != null &&
        Number.isFinite(versionForServer)
      ? `${stripUrlQuery(effectiveUrl)}?v=${versionForServer}`
      : effectiveUrl != null
        ? `${stripUrlQuery(effectiveUrl)}?v=${cacheBust}`
        : null;

  function onPick() {
    if (isUploadPending) return;
    setPickError(null);
    fileRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      return;
    }
    if (file.size > MAX_BYTES) {
      setPickError(
        "File is too large. School stamps can be at most 2 MB. Choose a smaller file or export at lower resolution."
      );
      e.target.value = "";
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const okExt = ["png", "jpg", "jpeg", "webp"].includes(ext);
    const okMime =
      !file.type ||
      ["image/png", "image/jpeg", "image/webp"].includes(file.type);
    if (!okExt || !okMime) {
      setPickError(
        "Unsupported file type. Use a PNG, JPG, JPEG, or WebP image only."
      );
      e.target.value = "";
      return;
    }
    setPickError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    const formData = new FormData();
    formData.set("stamp", file);
    startTransition(() => {
      uploadAction(formData);
    });
  }

  const hasServerStamp = Boolean(serverStampUrl) && !previewUrl;
  const canRemove = hasServerStamp;
  const pickLabel = isUploadPending
    ? "Uploading…"
    : hasServerStamp
      ? "Replace"
      : "Upload stamp";
  const busy = isUploadPending;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-zinc-400">
        Upload your official school stamp. Appears on report cards and
        receipts. PNG, JPG, or WebP, max 2MB. The image uploads as soon as you
        select it.
      </p>
      {pickError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {pickError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex h-[100px] w-[100px] max-h-[100px] max-w-[100px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500">
          {displayUrl ? (
            <img
              key={`${displayUrl}-${uploadState.stampVersion ?? uploadState.completedAt ?? 0}-${removeState.stampVersion ?? removeState.completedAt ?? 0}-${cacheBust}`}
              src={displayUrl}
              alt=""
              width={100}
              height={100}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="px-2 text-center text-xs text-slate-500 dark:text-zinc-500">
              No stamp
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            PNG, JPG, JPEG, or WebP · max 2 MB
          </p>

          <div className="flex flex-col gap-3">
            <input
              ref={fileRef}
              type="file"
              name="stamp"
              accept={ACCEPT}
              className="hidden"
              onChange={onFileChange}
              disabled={busy}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onPick}
                disabled={busy}
                className="inline-flex min-h-10 min-w-[10rem] items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {isUploadPending ? (
                  <Loader2
                    className="h-4 w-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                ) : null}
                {pickLabel}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {isUploadPending
              ? "Uploading to storage and saving the link to your school…"
              : "Pick a new image to replace the current stamp, or to upload one for the first time (upload starts immediately)."}
          </p>
        </div>
      </div>

      <form action={removeAction} className="pt-1">
        <RemoveStampButton disabled={!canRemove} />
      </form>
    </div>
  );
}
