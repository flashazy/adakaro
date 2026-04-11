"use server";

import { revalidatePath } from "next/cache";
import {
  removeTeacherAssignmentAction,
  updateTeacherAssignmentAction,
  type TeacherActionState,
} from "../teachers/actions";

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
