"use server";

import { revalidatePath } from "next/cache";
import {
  removeTeacherAssignmentAction,
  updateTeacherAssignmentAction,
} from "../teachers/actions";
import type { TeacherActionState } from "../teachers/types";

export type AssignmentActionState = TeacherActionState;

export async function updateAssignmentAction(
  prev: AssignmentActionState | null,
  formData: FormData
): Promise<AssignmentActionState> {
  const result = await updateTeacherAssignmentAction(prev, formData);
  revalidatePath("/dashboard/assignments");
  return result;
}

export async function deleteAssignmentAction(
  prev: AssignmentActionState | null,
  formData: FormData
): Promise<AssignmentActionState> {
  const result = await removeTeacherAssignmentAction(prev, formData);
  revalidatePath("/dashboard/assignments");
  return result;
}

export async function bulkDeleteAssignmentsAction(
  _prev: AssignmentActionState | null,
  formData: FormData
): Promise<AssignmentActionState> {
  const ids = formData
    .getAll("assignment_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return { ok: false, error: "No assignments selected." };
  }

  let removed = 0;
  let lastError: string | null = null;

  for (const id of ids) {
    const singleForm = new FormData();
    singleForm.set("assignment_id", id);
    const result = await removeTeacherAssignmentAction(null, singleForm);
    if (result.ok) {
      removed += 1;
    } else {
      lastError = result.error ?? "Could not remove assignment.";
    }
  }

  revalidatePath("/dashboard/assignments");

  if (removed === 0) {
    return {
      ok: false,
      error: lastError ?? "Could not remove assignments.",
    };
  }

  if (removed < ids.length) {
    return {
      ok: false,
      error:
        lastError ??
        `Removed ${removed} of ${ids.length} assignments. Please try again for the rest.`,
    };
  }

  return {
    ok: true,
    message: `Removed ${removed} assignment${removed === 1 ? "" : "s"}.`,
  };
}
