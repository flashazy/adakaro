"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminActionFromServerAction } from "@/lib/admin-activity-log";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { toUppercase } from "@/lib/utils";

async function getSchoolId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) throw new Error("No school found");

  return { supabase, schoolId, userId: user.id };
}

export interface ClassActionState {
  error?: string;
  success?: string;
}

export async function addClass(
  _prevState: ClassActionState,
  formData: FormData
): Promise<ClassActionState> {
  const name = toUppercase(String(formData.get("name") ?? ""));
  const description = (formData.get("description") as string)?.trim() || null;
  const parentClassIdRaw = String(formData.get("parent_class_id") ?? "").trim();
  const parentClassId = parentClassIdRaw.length > 0 ? parentClassIdRaw : null;

  if (!name) {
    return { error: "Class name is required." };
  }

  try {
    const { supabase, schoolId, userId } = await getSchoolId();

    const { error } = await supabase.from("classes").insert({
      school_id: schoolId,
      name,
      description,
      parent_class_id: parentClassId,
    } as never);

    if (error) {
      if (error.code === "23505") {
        return { error: `A class named "${name}" already exists.` };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/classes");

    void logAdminActionFromServerAction(
      userId,
      "create_class",
      { class_name: name, parent_class_id: parentClassId },
      schoolId
    );

    return {
      success: parentClassId
        ? `Stream "${name}" created.`
        : `Class "${name}" created.`,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export interface BulkAddClassesResult {
  ok: boolean;
  /** Total non-empty lines parsed from the textarea (after trim/uppercase). */
  submitted: number;
  /** Names actually inserted in this call. */
  inserted: string[];
  /**
   * Names skipped because they already exist for this school OR were
   * duplicated within the same submission.
   */
  skippedExisting: string[];
  error?: string;
}

/**
 * Bulk-create classes from a list of names. The optional `description` is
 * applied to every newly-created class. Duplicates within the submission are
 * collapsed and any name that already exists for the school is reported back
 * as `skippedExisting` instead of failing the whole batch.
 */
export async function bulkAddClasses(input: {
  names: string[];
  description?: string | null;
  /** When set, every newly-created class is inserted as a child stream of this class. */
  parentClassId?: string | null;
}): Promise<BulkAddClassesResult> {
  // Normalize the description once so every row gets the same value (or null).
  const description = (input.description ?? "").trim() || null;
  const parentClassId = (input.parentClassId ?? "").trim() || null;

  // Trim, uppercase, drop empties, and collapse duplicates while preserving
  // the order the admin typed them in (nicer for the success message).
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of input.names) {
    const cleaned = toUppercase(String(raw ?? ""));
    if (!cleaned) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    names.push(cleaned);
  }

  if (names.length === 0) {
    return {
      ok: false,
      submitted: 0,
      inserted: [],
      skippedExisting: [],
      error: "Add at least one class name (one per line).",
    };
  }

  try {
    const { supabase, schoolId, userId } = await getSchoolId();

    // Look up existing names so we can pre-filter and report them back to the
    // admin instead of relying on per-row 23505 errors (which would also
    // abort the insert batch).
    const { data: existingRows, error: existingError } = await supabase
      .from("classes")
      .select("name")
      .eq("school_id", schoolId)
      .in("name", names);

    if (existingError) {
      return {
        ok: false,
        submitted: names.length,
        inserted: [],
        skippedExisting: [],
        error: existingError.message,
      };
    }

    const existingSet = new Set(
      ((existingRows ?? []) as { name: string }[]).map((r) => r.name)
    );
    const skippedExisting = names.filter((n) => existingSet.has(n));
    const toInsert = names.filter((n) => !existingSet.has(n));

    if (toInsert.length === 0) {
      return {
        ok: true,
        submitted: names.length,
        inserted: [],
        skippedExisting,
      };
    }

    const { error } = await supabase.from("classes").insert(
      toInsert.map((name) => ({
        school_id: schoolId,
        name,
        description,
        parent_class_id: parentClassId,
      })) as never
    );

    if (error) {
      return {
        ok: false,
        submitted: names.length,
        inserted: [],
        skippedExisting,
        error: error.message,
      };
    }

    revalidatePath("/dashboard/classes");

    void logAdminActionFromServerAction(
      userId,
      "bulk_create_classes",
      {
        inserted: toInsert,
        skipped_existing: skippedExisting,
        parent_class_id: parentClassId,
      },
      schoolId
    );

    return {
      ok: true,
      submitted: names.length,
      inserted: toInsert,
      skippedExisting,
    };
  } catch (e) {
    return {
      ok: false,
      submitted: names.length,
      inserted: [],
      skippedExisting: [],
      error: (e as Error).message,
    };
  }
}

export async function updateClass(
  classId: string,
  formData: FormData
): Promise<ClassActionState> {
  const name = toUppercase(String(formData.get("name") ?? ""));
  const description = (formData.get("description") as string)?.trim() || null;
  const parentClassIdRaw = String(formData.get("parent_class_id") ?? "").trim();
  const parentClassId = parentClassIdRaw.length > 0 ? parentClassIdRaw : null;

  if (!name) {
    return { error: "Class name is required." };
  }

  if (parentClassId === classId) {
    return { error: "A class cannot be its own parent." };
  }

  try {
    const { supabase, schoolId, userId } = await getSchoolId();

    const { error } = await supabase
      .from("classes")
      .update({
        name,
        description,
        parent_class_id: parentClassId,
      } as never)
      .eq("id", classId);

    if (error) {
      if (error.code === "23505") {
        return { error: `A class named "${name}" already exists.` };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/classes");

    void logAdminActionFromServerAction(
      userId,
      "update_class",
      { class_id: classId, class_name: name },
      schoolId
    );

    return { success: `Class updated.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteClass(classId: string): Promise<ClassActionState> {
  try {
    const { supabase, schoolId, userId } = await getSchoolId();

    const { error } = await supabase
      .from("classes")
      .delete()
      .eq("id", classId);

    if (error) {
      if (error.code === "23503") {
        return { error: "Cannot delete a class that has students." };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/classes");

    void logAdminActionFromServerAction(
      userId,
      "delete_class",
      { class_id: classId },
      schoolId
    );

    return { success: "Class deleted." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
