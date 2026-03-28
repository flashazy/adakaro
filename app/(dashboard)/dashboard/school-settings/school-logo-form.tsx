"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  uploadSchoolLogo,
  removeSchoolLogo,
  type SchoolSettingsState,
} from "./actions";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT =
  "image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp";

const CACHE_SS_KEY = "adakaro:schoolLogoImgV";

function stripUrlQuery(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

function schoolInitials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase().slice(0, 2);
  }
  return t.slice(0, 2).toUpperCase();
}

function UploadSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Uploading…" : "Save logo"}
    </button>
  );
}

function RemoveSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {pending ? "Removing…" : "Remove logo"}
    </button>
  );
}

const initialState: SchoolSettingsState = {};

export function SchoolLogoForm({
  schoolName,
  initialLogoUrl,
  initialLogoVersion,
}: {
  schoolName: string;
  initialLogoUrl: string | null;
  /** From `schools.updated_at` — must change when logo row updates so `?v=` busts cache. */
  initialLogoVersion: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasSelectedFile, setHasSelectedFile] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(0);
  /** Bytes loaded with fetch(no-store) so CDN/browser cache cannot show an old file at the same URL. */
  const [freshLogoObjectUrl, setFreshLogoObjectUrl] = useState<string | null>(
    null
  );

  const [uploadState, uploadAction] = useActionState(
    uploadSchoolLogo,
    initialState
  );
  const [removeState, removeAction] = useActionState(
    removeSchoolLogo,
    initialState
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem(CACHE_SS_KEY);
      if (v) setCacheBust(Number(v));
    } catch {
      /* ignore */
    }
  }, []);

  // After upload: reload image bypassing Supabase CDN + browser cache (same path = stale bytes otherwise).
  useEffect(() => {
    if (!uploadState.success || !uploadState.publicUrl?.trim()) return;
    const base = stripUrlQuery(uploadState.publicUrl.trim());
    const bust = uploadState.logoVersion ?? uploadState.completedAt ?? Date.now();
    const src = `${base}?v=${bust}`;
    const ac = new AbortController();
    fetch(src, { cache: "no-store", signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error("logo fetch failed");
        return r.blob();
      })
      .then((blob) => {
        const u = URL.createObjectURL(blob);
        setFreshLogoObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return u;
        });
      })
      .catch(() => {
        /* fall back to query-busted URL in displayUrl below */
      });
    return () => ac.abort();
  }, [
    uploadState.success,
    uploadState.publicUrl,
    uploadState.completedAt,
    uploadState.logoVersion,
  ]);

  useEffect(() => {
    if (!removeState.success) return;
    setFreshLogoObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [removeState.success, removeState.completedAt]);

  useEffect(() => {
    if (!uploadState.success && !removeState.success) return;
    const t =
      uploadState.logoVersion ??
      removeState.logoVersion ??
      Date.now();
    try {
      sessionStorage.setItem(CACHE_SS_KEY, String(t));
    } catch {
      /* ignore */
    }
    setCacheBust(t);
    setPickError(null);
    setHasSelectedFile(false);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }, [
    uploadState.success,
    uploadState.completedAt,
    uploadState.logoVersion,
    removeState.success,
    removeState.completedAt,
    removeState.logoVersion,
    router,
  ]);

  /** After remove, hide server URL until a new upload succeeds (avoid stale img while RSC catches up). */
  const serverLogoUrl =
    removeState.success && !uploadState.success
      ? null
      : (initialLogoUrl?.trim() ?? null);

  const versionForServerImg =
    uploadState.success && uploadState.logoVersion != null
      ? uploadState.logoVersion
      : removeState.success && !uploadState.success
        ? null
        : initialLogoVersion;

  /** Prefer the URL returned from the last upload (extension/path may differ from props until refresh). */
  const effectiveServerUrl =
    uploadState.success && uploadState.publicUrl?.trim()
      ? uploadState.publicUrl.trim()
      : serverLogoUrl;

  const displayUrl = previewUrl
    ? previewUrl
    : freshLogoObjectUrl
      ? freshLogoObjectUrl
      : effectiveServerUrl != null &&
          versionForServerImg != null &&
          Number.isFinite(versionForServerImg)
        ? `${stripUrlQuery(effectiveServerUrl)}?v=${versionForServerImg}`
        : effectiveServerUrl != null
          ? `${stripUrlQuery(effectiveServerUrl)}?v=${cacheBust}`
          : null;

  function onPickFile() {
    setPickError(null);
    fileRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setHasSelectedFile(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      return;
    }
    if (file.size > MAX_BYTES) {
      setPickError("Logo must be 2 MB or smaller.");
      setHasSelectedFile(false);
      e.target.value = "";
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const okExt = ["png", "jpg", "jpeg", "webp"].includes(ext);
    const okMime =
      !file.type ||
      ["image/png", "image/jpeg", "image/webp"].includes(file.type);
    if (!okExt || !okMime) {
      setPickError("Use a PNG, JPG, JPEG, or WebP image.");
      setHasSelectedFile(false);
      e.target.value = "";
      return;
    }
    setPickError(null);
    setHasSelectedFile(true);
    setFreshLogoObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearSelection() {
    setPickError(null);
    setHasSelectedFile(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setFreshLogoObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  const showUploadError = uploadState.error;
  const showRemoveError = removeState.error;
  const canRemove = Boolean(serverLogoUrl) && !previewUrl;

  return (
    <div className="space-y-4">
      {showUploadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
          {showUploadError}
        </div>
      ) : null}
      {showRemoveError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
          {showRemoveError}
        </div>
      ) : null}
      {uploadState.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          Logo updated.
        </div>
      ) : null}
      {removeState.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          Logo removed.
        </div>
      ) : null}
      {pickError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {pickError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex h-[100px] w-[100px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500">
          {displayUrl ? (
            <img
              key={`${displayUrl}-${uploadState.logoVersion ?? uploadState.completedAt ?? 0}-${removeState.logoVersion ?? removeState.completedAt ?? 0}-${cacheBust}`}
              src={displayUrl}
              alt=""
              width={100}
              height={100}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="px-2 text-center text-xs font-semibold leading-tight">
              {schoolName.trim() ? schoolInitials(schoolName) : "No logo"}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            PNG, JPG, JPEG, or WebP · max 2 MB
          </p>

          <form action={uploadAction} className="flex flex-col gap-3">
            <input
              ref={fileRef}
              type="file"
              name="logo"
              accept={ACCEPT}
              className="hidden"
              onChange={onFileChange}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onPickFile}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Upload new logo
              </button>
              <UploadSubmitButton disabled={!hasSelectedFile} />
              {previewUrl ? (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline dark:text-zinc-400"
                >
                  Clear selection
                </button>
              ) : null}
            </div>
          </form>

          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Choose an image to preview it, then save to apply.
          </p>
        </div>
      </div>

      <form action={removeAction} className="pt-1">
        <RemoveSubmitButton disabled={!canRemove} />
      </form>
    </div>
  );
}
