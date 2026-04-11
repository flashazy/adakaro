"use server";

/**
 * Next.js requires this file to export only async server actions (no constants,
 * types, or sync values). Shared values live in `./constants`.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

import {
  MAX_DOCUMENT_BYTES,
  TEACHER_DOCUMENT_CATEGORY_KEYS,
  type TeacherDocumentCategory,
} from "./constants";

type TeacherDocInsert = Database["public"]["Tables"]["teacher_documents"]["Insert"];

/** Supabase `from("teacher_documents")` infers `never` until CLI types are regenerated. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocDb = any;

const BUCKET = "teacher-docs";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
};

function extFromFileName(name: string): string | null {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name.trim());
  if (!m) return null;
  const e = m[1].toLowerCase();
  if (["pdf", "doc", "docx", "jpg", "jpeg", "png"].includes(e)) {
    return e === "jpeg" ? "jpg" : e;
  }
  return null;
}

function resolveMimeAndExt(file: File): { mime: string; ext: string } | null {
  let mime = file.type?.trim() || "";
  if (!mime || mime === "application/octet-stream") {
    const ext = extFromFileName(file.name);
    if (!ext) return null;
    const reverse: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      jpg: "image/jpeg",
      png: "image/png",
    };
    mime = reverse[ext];
    if (!mime) return null;
    return { mime, ext };
  }
  if (!ALLOWED_MIME.has(mime)) return null;
  const ext = MIME_TO_EXT[mime] ?? extFromFileName(file.name);
  if (!ext) return null;
  return { mime, ext };
}

function isValidCategory(c: string): c is TeacherDocumentCategory {
  return (TEACHER_DOCUMENT_CATEGORY_KEYS as readonly string[]).includes(c);
}

export async function uploadDocumentAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const rawFile = formData.get("file");
  if (!(rawFile instanceof File) || rawFile.size === 0) {
    return { ok: false, error: "Please choose a file to upload." };
  }
  if (rawFile.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: "File must be 10MB or smaller." };
  }

  const resolved = resolveMimeAndExt(rawFile);
  if (!resolved) {
    return {
      ok: false,
      error: "Allowed types: PDF, DOC, DOCX, JPG, PNG.",
    };
  }

  let documentName = String(formData.get("documentName") ?? "").trim();
  if (!documentName) {
    documentName = rawFile.name.replace(/[/\\]/g, "").slice(0, 200) || "Document";
  }
  if (documentName.length > 200) {
    documentName = documentName.slice(0, 200);
  }

  const categoryRaw = String(formData.get("category") ?? "Other").trim();
  const category: TeacherDocumentCategory = isValidCategory(categoryRaw)
    ? categoryRaw
    : "Other";

  const objectPath = `${user.id}/${crypto.randomUUID()}.${resolved.ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, rawFile, {
      contentType: resolved.mime,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: uploadError.message || "Upload failed." };
  }

  const insertPayload: TeacherDocInsert = {
    teacher_id: user.id,
    document_name: documentName,
    file_url: objectPath,
    file_type: resolved.mime,
    file_size: rawFile.size,
    category,
  };

  const { error: insertError } = await (supabase as DocDb)
    .from("teacher_documents")
    .insert(insertPayload);

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([objectPath]);
    return { ok: false, error: insertError.message || "Could not save document." };
  }

  revalidatePath("/teacher-dashboard");
  return { ok: true };
}

export async function deleteDocumentAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data: row, error: fetchError } = (await (supabase as DocDb)
    .from("teacher_documents")
    .select("id, teacher_id, file_url")
    .eq("id", id)
    .maybeSingle()) as {
    data: {
      id: string;
      teacher_id: string;
      file_url: string;
    } | null;
    error: Error | null;
  };

  if (fetchError || !row) {
    return { ok: false, error: "Document not found." };
  }
  if (row.teacher_id !== user.id) {
    return { ok: false, error: "Not allowed." };
  }

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([row.file_url]);
  if (storageError) {
    return { ok: false, error: storageError.message || "Could not remove file." };
  }

  const { error: delError } = await (supabase as DocDb)
    .from("teacher_documents")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (delError) {
    return { ok: false, error: delError.message || "Could not delete record." };
  }

  revalidatePath("/teacher-dashboard");
  return { ok: true };
}

export async function renameDocumentAction(
  id: string,
  documentName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const name = documentName.trim().slice(0, 200);
  if (!name) {
    return { ok: false, error: "Name cannot be empty." };
  }

  const { error } = await (supabase as DocDb)
    .from("teacher_documents")
    .update({ document_name: name })
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    return { ok: false, error: error.message || "Could not rename." };
  }

  revalidatePath("/teacher-dashboard");
  return { ok: true };
}

export async function getDocumentDownloadUrlAction(
  id: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: row, error: fetchError } = (await (supabase as DocDb)
    .from("teacher_documents")
    .select("file_url, teacher_id")
    .eq("id", id)
    .maybeSingle()) as {
    data: { file_url: string; teacher_id: string } | null;
    error: Error | null;
  };

  if (fetchError || !row) return { error: "Document not found." };
  if (row.teacher_id !== user.id) return { error: "Not allowed." };

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.file_url, 3600);

  if (signError || !signed?.signedUrl) {
    return { error: signError?.message || "Could not create download link." };
  }

  return { url: signed.signedUrl };
}
