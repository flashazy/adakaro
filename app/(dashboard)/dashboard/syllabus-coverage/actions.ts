"use server";

import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { createClient } from "@/lib/supabase/server";
import { assertSchoolAdminForUser } from "@/app/(dashboard)/dashboard/teachers/actions";
import { requireSignedInUser } from "@/lib/syllabus-coverage/access.server";
import { loadAdminSyllabusDashboard } from "@/lib/syllabus-coverage/load-admin-syllabus-dashboard.server";
import type { AdminSyllabusDashboardPayload } from "@/lib/syllabus-coverage/admin-dashboard-types";
import {
  reportSyllabusHealthAlert,
  SYLLABUS_HEALTH_REASONS,
} from "@/lib/syllabus-coverage/syllabus-health-alerts";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";

export async function loadAdminSyllabusDashboardAction(
  academicYear?: string
): Promise<
  | { ok: true; payload: AdminSyllabusDashboardPayload }
  | { ok: false; error: string }
> {
  const auth = await requireSignedInUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };

  const supabase = await createClient();
  const schoolId = await getSchoolIdForUser(supabase, auth.user.id);
  if (!schoolId) return { ok: false, error: "School not found." };

  if (!(await assertSchoolAdminForUser(auth.user.id, schoolId))) {
    return { ok: false, error: "School admin access required." };
  }

  const year = academicYear?.trim() || String(currentAcademicYear());
  try {
    const payload = await loadAdminSyllabusDashboard(schoolId, year);
    return { ok: true, payload };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.coverageLoadFailed,
      schoolId,
      error: err,
    });
    return { ok: false, error: "Could not load syllabus coverage overview." };
  }
}

/** @deprecated Use loadAdminSyllabusDashboardAction */
export async function loadAdminSyllabusOverviewAction(
  academicYear?: string
) {
  const res = await loadAdminSyllabusDashboardAction(academicYear);
  if (!res.ok) return res;
  return {
    ok: true as const,
    rows: res.payload.rows,
    academicYear: res.payload.academicYear,
  };
}
