"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  FileText,
  FolderOpen,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import {
  deleteDocumentAction,
  getDocumentDownloadUrlAction,
  renameDocumentAction,
  uploadDocumentAction,
} from "../documents/actions";
import {
  MAX_DOCUMENT_BYTES,
  TEACHER_DOCUMENT_CATEGORY_KEYS,
  type TeacherDocumentCategory,
} from "../documents/constants";

export interface TeacherDocumentRow {
  id: string;
  document_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  category: string;
  uploaded_at: string;
}

const QUOTA_BYTES = 100 * 1024 * 1024;

const CATEGORY_TABS: {
  filter: "all" | TeacherDocumentCategory;
  label: string;
  emoji: string;
}[] = [
  { filter: "all", label: "All", emoji: "📂" },
  { filter: "Certificates", label: "Certificates", emoji: "📜" },
  { filter: "CV/Resume", label: "CV/Resume", emoji: "📄" },
  { filter: "Lesson Plans", label: "Lesson Plans", emoji: "📋" },
  { filter: "Training", label: "Training", emoji: "🎓" },
  { filter: "Administrative", label: "Administrative", emoji: "📁" },
  { filter: "Personal", label: "Personal", emoji: "👤" },
  { filter: "Other", label: "Other", emoji: "📦" },
];

function formatBytes(n: number | null): string {
  if (n == null || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Fixed locale so SSR and browser match (undefined uses different defaults and hydrates badly). */
function formatUploadedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function categoryLabelWithEmoji(category: string): string {
  const row = CATEGORY_TABS.find((t) => t.filter === category);
  if (!row || row.filter === "all") return category;
  return `${row.emoji} ${row.label}`;
}

/** What we can preview in-app vs new tab vs toast-only. */
function getPreviewKind(fileType: string): "image" | "pdf" | "other" {
  const t = fileType.trim().toLowerCase();
  if (t === "image/jpeg" || t === "image/png") return "image";
  if (t === "application/pdf") return "pdf";
  return "other";
}

export function TeacherDocuments({
  initialDocuments,
}: {
  initialDocuments: TeacherDocumentRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [documents, setDocuments] = useState(initialDocuments);
  const [tab, setTab] = useState<"all" | TeacherDocumentCategory>("all");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] =
    useState<TeacherDocumentCategory>("Other");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<TeacherDocumentRow | null>(
    null
  );
  const [renameValue, setRenameValue] = useState("");
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{
    url: string;
    title: string;
  } | null>(null);
  /** Avoid emoji/category hydration mismatch (server vs client locale/unicode). */
  const [categoryLabelsMounted, setCategoryLabelsMounted] = useState(false);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  useEffect(() => {
    setCategoryLabelsMounted(true);
  }, []);

  useEffect(() => {
    if (!imagePreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImagePreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imagePreview]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (tab !== "all" && d.category !== tab) return false;
      if (!q) return true;
      return d.document_name.toLowerCase().includes(q);
    });
  }, [documents, tab, search]);

  const totalBytes = useMemo(
    () => documents.reduce((s, d) => s + (d.file_size ?? 0), 0),
    [documents]
  );
  const usagePct = Math.min(100, (totalBytes / QUOTA_BYTES) * 100);

  const handleDownload = (id: string) => {
    startTransition(async () => {
      const res = await getDocumentDownloadUrlAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  const handlePreview = (d: TeacherDocumentRow) => {
    const kind = getPreviewKind(d.file_type);
    if (kind === "other") {
      toast.message(
        "Preview not available for this file type. Please download to view."
      );
      return;
    }
    setPreviewLoadingId(d.id);
    startTransition(async () => {
      try {
        const res = await getDocumentDownloadUrlAction(d.id);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        if (kind === "pdf") {
          window.open(res.url, "_blank", "noopener,noreferrer");
          return;
        }
        setImagePreview({ url: res.url, title: d.document_name });
      } finally {
        setPreviewLoadingId(null);
      }
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const id = deleteId;
    startTransition(async () => {
      const res = await deleteDocumentAction(id);
      if (!res.ok) {
        toast.error(res.error);
        setDeleteId(null);
        return;
      }
      toast.success("Document removed");
      setDeleteId(null);
      router.refresh();
    });
  };

  const handleRenameSubmit = () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error("Enter a name");
      return;
    }
    startTransition(async () => {
      const res = await renameDocumentAction(renameTarget.id, name);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Renamed");
      setRenameTarget(null);
      setRenameValue("");
      router.refresh();
    });
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error("Choose a file");
      return;
    }
    const fd = new FormData();
    fd.set("file", uploadFile);
    fd.set("documentName", uploadName.trim());
    fd.set("category", uploadCategory);
    startTransition(async () => {
      const res = await uploadDocumentAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Uploaded");
      setUploadOpen(false);
      setUploadName("");
      setUploadCategory("Other");
      setUploadFile(null);
      router.refresh();
    });
  };

  return (
    <>
      <Toaster richColors position="top-center" />
      <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              📁 My Documents
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Store certificates, CVs, lesson plans, and other files securely.
              PDF, Word, JPG, or PNG up to 10MB each.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            Upload
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-zinc-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-zinc-300">
              <FolderOpen className="h-4 w-4" aria-hidden />
              Storage used
            </span>
            <span className="tabular-nums">
              {formatBytes(totalBytes)} / {formatBytes(QUOTA_BYTES)}
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800"
            role="progressbar"
            aria-valuenow={Math.round(usagePct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-300 dark:bg-indigo-400"
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORY_TABS.map((t) => (
            <button
              key={t.filter}
              type="button"
              onClick={() => setTab(t.filter)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.filter
                  ? "bg-indigo-600 text-white dark:bg-indigo-500"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <span aria-hidden>{t.emoji}</span>{" "}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                <th className="px-3 py-3 font-semibold text-slate-800 dark:text-zinc-100">
                  Name
                </th>
                <th className="px-3 py-3 font-semibold text-slate-800 dark:text-zinc-100">
                  Category
                </th>
                <th className="px-3 py-3 font-semibold text-slate-800 dark:text-zinc-100">
                  Uploaded
                </th>
                <th className="px-3 py-3 font-semibold text-slate-800 dark:text-zinc-100">
                  Size
                </th>
                <th className="px-3 py-3 text-right font-semibold text-slate-800 dark:text-zinc-100">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-10 text-center text-slate-500 dark:text-zinc-500"
                  >
                    {documents.length === 0
                      ? "No documents yet. Upload your first file."
                      : "No documents match this filter."}
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-slate-100 last:border-0 dark:border-zinc-800"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                        <span className="font-medium text-slate-900 dark:text-zinc-100">
                          {d.document_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-zinc-300">
                      {categoryLabelsMounted
                        ? categoryLabelWithEmoji(d.category)
                        : d.category}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-600 dark:text-zinc-400">
                      {formatUploadedDate(d.uploaded_at)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-600 dark:text-zinc-400">
                      {formatBytes(d.file_size)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handlePreview(d)}
                          disabled={pending || previewLoadingId === d.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                          title="Preview"
                        >
                          {previewLoadingId === d.id ? (
                            <Loader2
                              className="h-3.5 w-3.5 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                          )}
                          <span className="hidden sm:inline">Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(d.id)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Download</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenameTarget(d);
                            setRenameValue(d.document_name);
                          }}
                          disabled={pending}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                          title="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Rename</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(d.id)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/40"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {imagePreview && (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setImagePreview(null)}
        >
          <button
            type="button"
            onClick={() => setImagePreview(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="flex max-h-[90vh] max-w-[min(100%,56rem)] flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Signed Supabase URL — use native img for dynamic remote src */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview.url}
              alt={imagePreview.title}
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
            <p className="mt-3 max-w-full truncate px-2 text-center text-sm font-medium text-white/95">
              {imagePreview.title}
            </p>
          </div>
        </div>
      )}

      {uploadOpen && (
        <div
          className="fixed inset-0 z-[180] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-doc-title"
          onClick={() => !pending && setUploadOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="upload-doc-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Upload document
            </h3>
            <form className="mt-4 space-y-4" onSubmit={handleUpload}>
              <div>
                <label
                  htmlFor="doc-file"
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  File
                </label>
                <input
                  id="doc-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                  className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 dark:text-zinc-400 dark:file:bg-indigo-950/50 dark:file:text-indigo-200"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setUploadFile(f);
                    if (f && !uploadName.trim()) {
                      setUploadName(f.name.replace(/\.[^/.]+$/, ""));
                    }
                  }}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Max {MAX_DOCUMENT_BYTES / (1024 * 1024)} MB · PDF, DOC, DOCX,
                  JPG, PNG
                </p>
              </div>
              <div>
                <label
                  htmlFor="doc-name"
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Display name
                </label>
                <input
                  id="doc-name"
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  placeholder="e.g. Teaching certificate 2024"
                />
              </div>
              <div>
                <label
                  htmlFor="doc-category"
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Category
                </label>
                <select
                  id="doc-category"
                  value={uploadCategory}
                  onChange={(e) =>
                    setUploadCategory(
                      e.target.value as TeacherDocumentCategory
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                >
                  {TEACHER_DOCUMENT_CATEGORY_KEYS.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_TABS.find((t) => t.filter === c)?.emoji} {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  onClick={() => setUploadOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  {pending && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  )}
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/50 p-4"
          role="alertdialog"
          aria-labelledby="delete-doc-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h3
              id="delete-doc-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Delete document?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
              This cannot be undone. The file will be removed from storage.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-zinc-600"
                onClick={() => setDeleteId(null)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
                onClick={handleDelete}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-doc-title"
          onClick={() => !pending && setRenameTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="rename-doc-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Rename document
            </h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              autoFocus
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => setRenameTarget(null)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                onClick={handleRenameSubmit}
                disabled={pending}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
