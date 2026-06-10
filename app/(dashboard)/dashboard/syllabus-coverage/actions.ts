"use server";

import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { createClient } from "@/lib/supabase/server";
import { assertSchoolAdminForUser } from "@/app/(dashboard)/dashboard/teachers/actions";
import { requireSignedInUser } from "@/lib/syllabus-coverage/access.server";
import { loadSchoolSyllabusCoverageOverview } from "@/lib/syllabus-coverage/load-coverage.server";
import {
  reportSyllabusHealthAlert,
  SYLLABUS_HEALTH_REASONS,
} from "@/lib/syllabus-coverage/syllabus-health-alerts";
import type { SyllabusCoverageOverviewRow } from "@/lib/syllabus-coverage/types";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";

export async function loadAdminSyllabusOverviewAction(
  academicYear?: string
): Promise<
  | { ok: true; rows: SyllabusCoverageOverviewRow[]; academicYear: string }
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
    const rows = await loadSchoolSyllabusCoverageOverview(schoolId, year);
    return { ok: true, rows, academicYear: year };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.coverageLoadFailed,
      schoolId,
      error: err,
    });
    return { ok: false, error: "Could not load syllabus coverage overview." };
  }
}
