"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  removeCoordinatorSignature,
  uploadCoordinatorSignature,
  type CoordinatorSignatureState,
} from "./coordinator-signature-actions";
import { SignatureCropper } from "@/components/SignatureCropper";
import { getImageSoftUploadWarningsFromFile } from "@/lib/image-upload-warnings";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT =
  "image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp";

const COORDINATOR_MY_SIGNATURE_EXPANDED_STORAGE_KEY =
  "coordinator-my-signature-section-expanded";

function stripUrlQuery(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

function RemoveCoordinatorSigButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800/80 dark:text-red-300 dark:hover:bg-red-950/40"
    >
      {pending ? "Removing…" : "Remove signature"}
    </button>
  );
}

const initialState: CoordinatorSignatureState = {};

export function CoordinatorMySignatureCard({
  initialUrl,
  initialVersion,
}: {
  initialUrl: string | null;
  initialVersion: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(0);
  const lastToastU = useRef(0);
  const lastToastR = useRef(0);
  const lastErrU = useRef<string | null>(null);
  const lastErrR = useRef<string | null>(null);

  const [uploadState, uploadAction, isUploadPending] = useActionState(
    uploadCoordinatorSignature,
    initialState
  );
  const [removeState, removeAction] = useActionState(
    removeCoordinatorSignature,
    initialState
  );
  const [cropSession, setCropSession] = useState<{
    url: string;
    file: File;
  } | null>(null);
  const [signatureSectionExpanded, setSignatureSectionExpanded] =
    useState(false);

  useEffect(() => {
    try {
      if (
        localStorage.getItem(COORDINATOR_MY_SIGNATURE_EXPANDED_STORAGE_KEY) ===
        "true"
      ) {
        setSignatureSectionExpanded(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function toggleSignatureSection() {
    setSignatureSectionExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          COORDINATOR_MY_SIGNATURE_EXPANDED_STORAGE_KEY,
          next ? "true" : "false"
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function closeCropper() {
    setCropSession((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }

  async function uploadCroppedOrOriginal(file: File) {
    const warnings = await getImageSoftUploadWarningsFromFile(file);
    for (const msg of warnings) {
      toast.warning(msg);
    }
    const formData = new FormData();
    formData.set("coordinator_signature", file);
    startTransition(() => {
      uploadAction(formData);
    });
  }

  useEffect(() => {
    if (uploadState.success) {
      const t =
        uploadState.coordinatorSignatureVersion ??
        uploadState.completedAt ??
        0;
      if (t !== lastToastU.current) {
        lastToastU.current = t;
        lastErrU.current = null;
        toast.success("Coordinator signature saved.");
      }
    } else if (uploadState.error) {
      if (uploadState.error !== lastErrU.current) {
        lastErrU.current = uploadState.error;
        toast.error(uploadState.error);
      }
    }
  }, [
    uploadState.success,
    uploadState.error,
    uploadState.coordinatorSignatureVersion,
    uploadState.completedAt,
  ]);

  useEffect(() => {
    if (removeState.success) {
      const t =
        removeState.coordinatorSignatureVersion ??
        removeState.completedAt ??
        0;
      if (t !== lastToastR.current) {
        lastToastR.current = t;
        lastErrR.current = null;
        toast.success("Coordinator signature removed.");
      }
    } else if (removeState.error) {
      if (removeState.error !== lastErrR.current) {
        lastErrR.current = removeState.error;
        toast.error(removeState.error);
      }
    }
  }, [
    removeState.success,
    removeState.error,
    removeState.coordinatorSignatureVersion,
    removeState.completedAt,
  ]);

  useEffect(() => {
    if (!uploadState.success && !removeState.success) return;
    const t =
      uploadState.coordinatorSignatureVersion ??
      removeState.coordinatorSignatureVersion ??
      uploadState.completedAt ??
      removeState.completedAt ??
      Date.now();
    startTransition(() => {
      setCacheBust(t);
      setPickError(null);
    });
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }, [
    uploadState.success,
    removeState.success,
    uploadState.completedAt,
    removeState.completedAt,
    uploadState.coordinatorSignatureVersion,
    removeState.coordinatorSignatureVersion,
    router,
  ]);

  const serverUrl =
    removeState.success && !uploadState.success
      ? null
      : (initialUrl?.trim() ?? null);

  const versionForServer =
    uploadState.success && uploadState.coordinatorSignatureVersion != null
      ? uploadState.coordinatorSignatureVersion
      : removeState.success && !uploadState.success
        ? null
        : initialVersion;

  const effectiveUrl =
    uploadState.success && uploadState.publicUrl?.trim()
      ? uploadState.publicUrl.trim()
      : serverUrl;

  const displayUrl =
    effectiveUrl != null &&
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
      return;
    }
    if (file.size > MAX_BYTES) {
      setPickError(
        "File is too large. Signatures can be at most 2 MB. Choose a smaller file."
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
    setCropSession({ url: URL.createObjectURL(file), file });
    e.target.value = "";
  }

  const hasServer = Boolean(serverUrl);
  const canRemove = hasServer;
  const pickLabel = isUploadPending
    ? "Uploading…"
    : hasServer
      ? "Replace"
      : "Upload signature";
  const busy = isUploadPending;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:shadow-zinc-950/30">
      {cropSession ? (
        <SignatureCropper
          isOpen
          imageUrl={cropSession.url}
          originalFile={cropSession.file}
          onCancel={closeCropper}
          onConfirm={(croppedFile) => {
            closeCropper();
            uploadCroppedOrOriginal(croppedFile);
          }}
          onUseOriginal={() => {
            const f = cropSession.file;
            closeCropper();
            uploadCroppedOrOriginal(f);
          }}
        />
      ) : null}
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        <button
          type="button"
          id="coordinator-my-signature-heading"
          onClick={toggleSignatureSection}
          aria-expanded={signatureSectionExpanded}
          aria-controls="coordinator-my-signature-panel"
          className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800/80"
        >
          <span
            aria-hidden
            className="inline-flex w-6 shrink-0 justify-center"
          >
            {signatureSectionExpanded ? (
              <ChevronDown className="h-5 w-5" strokeWidth={2.25} />
            ) : (
              <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
            )}
          </span>
          <span>
            <span aria-hidden>📝 </span>
            My Signature
          </span>
        </button>
      </h2>
      <div
        id="coordinator-my-signature-panel"
        role="region"
        aria-labelledby="coordinator-my-signature-heading"
        hidden={!signatureSectionExpanded}
        className="space-y-4 pt-2"
      >
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Upload your official signature to appear on report cards for classes
          you coordinate.
        </p>

        {pickError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            {pickError}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex h-12 min-h-12 w-full max-w-[180px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800/80">
            {displayUrl ? (
              <img
                key={`${displayUrl}-${cacheBust}`}
                src={displayUrl}
                alt=""
                className="max-h-12 max-w-[180px] object-contain [print-color-adjust:exact]"
              />
            ) : (
              <span className="px-3 text-center text-sm text-slate-500 dark:text-zinc-500">
                No signature uploaded
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:justify-end">
            <input
              ref={fileRef}
              type="file"
              name="coordinator_signature"
              accept={ACCEPT}
              className="hidden"
              onChange={onFileChange}
              disabled={busy}
            />
            <button
              type="button"
              onClick={onPick}
              disabled={busy}
              className="inline-flex min-h-10 min-w-[8.5rem] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {isUploadPending ? (
                <Loader2
                  className="h-4 w-4 shrink-0 animate-spin"
                  aria-hidden
                />
              ) : null}
              {pickLabel}
            </button>
            <form action={removeAction} className="inline">
              <RemoveCoordinatorSigButton disabled={!canRemove} />
            </form>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-zinc-500">
          PNG, JPG, JPEG, or WebP · max 2 MB · crop after you choose a file
        </p>
      </div>
    </section>
  );
}
