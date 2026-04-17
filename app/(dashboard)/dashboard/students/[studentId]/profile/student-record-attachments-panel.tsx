"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { Database } from "@/types/supabase";
import {
  deleteStudentRecordAttachment,
  signStudentRecordAttachmentUrl,
  uploadStudentRecordAttachment,
} from "./profile-actions";

type AttachmentRow =
  Database["public"]["Tables"]["student_record_attachments"]["Row"];

function formatBytes(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white";
const labelClass = "block text-sm font-medium text-slate-700 dark:text-zinc-300";

export function StudentRecordAttachmentsPanel({
  studentId,
  recordType,
  recordId,
  attachments,
  canUpload,
  canDelete,
}: {
  studentId: string;
  recordType: "discipline" | "health";
  recordId: string;
  attachments: AttachmentRow[];
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openSigned(
    attachmentId: string,
    disposition: "inline" | "attachment"
  ) {
    setError(null);
    startTransition(async () => {
      const res = await signStudentRecordAttachmentUrl(attachmentId, studentId);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (!res.url) return;
      if (disposition === "inline") {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        const a = document.createElement("a");
        a.href = res.url;
        a.rel = "noopener noreferrer";
        a.target = "_blank";
        const row = attachments.find((x) => x.id === attachmentId);
        if (row?.file_name) a.download = row.file_name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    });
  }

  function onDelete(attachmentId: string) {
    if (!canDelete) return;
    if (!window.confirm("Delete this attachment? This cannot be undone.")) {
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("student_id", studentId);
    fd.set("attachment_id", attachmentId);
    startTransition(async () => {
      const res = await deleteStudentRecordAttachment(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setUploadOpen(false);
      router.refresh();
    });
  }

  function onUploadSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("student_id", studentId);
    fd.set("record_id", recordId);
    fd.set("record_type", recordType);
    startTransition(async () => {
      const res = await uploadStudentRecordAttachment(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      form.reset();
      setUploadOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-zinc-800">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        Attachments
      </h4>
      {attachments.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          No files attached.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-800/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800 dark:text-zinc-200">
                  {a.file_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-500">
                  {formatBytes(a.file_size)}
                  {a.description ? ` · ${a.description}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void openSigned(a.id, "inline")}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50 dark:text-indigo-400"
                >
                  View
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void openSigned(a.id, "attachment")}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50 dark:text-indigo-400"
                >
                  Download
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onDelete(a.id)}
                    className="text-sm font-medium text-red-600 hover:text-red-500 disabled:opacity-50 dark:text-red-400"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canUpload ? (
        <div className="mt-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setUploadOpen(true);
            }}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            Add attachment
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {uploadOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setUploadOpen(false);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attachment-upload-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <h3
                id="attachment-upload-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                Upload attachment
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                PDF, JPG, PNG, DOC, or DOCX · max 5MB
              </p>
            </div>
            <form className="space-y-4 px-4 py-4 sm:px-5" onSubmit={onUploadSubmit}>
              <div>
                <label className={labelClass} htmlFor={`file-${recordId}`}>
                  File
                </label>
                <input
                  id={`file-${recordId}`}
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`desc-${recordId}`}>
                  Description (optional)
                </label>
                <textarea
                  id={`desc-${recordId}`}
                  name="description"
                  rows={3}
                  className={inputClass}
                />
              </div>
              {error ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => !pending && setUploadOpen(false)}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {pending ? "Uploading…" : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
