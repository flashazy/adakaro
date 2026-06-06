import "server-only";

import { userIsClassTeacherForClass } from "@/lib/class-teacher";

/**
 * Current class teacher of the student's class may view read-only prior
 * class_attendance (application gate; RLS unchanged).
 */
export async function canViewHistoricalAttendance(
  userId: string,
  currentClassId: string
): Promise<boolean> {
  const classId = currentClassId?.trim();
  if (!classId) return false;
  return userIsClassTeacherForClass(userId, classId);
}
