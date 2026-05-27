import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import {
  buildPromotionGradeDebugReport,
  logPromotionGradeDebugReport,
} from "@/lib/promotions/promotion-grade-debug";

/**
 * GET /api/debug/promotion-grades?classId=...&academicYear=2026&student=Feisal
 * Development / DEBUG_PROMOTION_GRADES only — full promotion grade diagnostic.
 */
export async function GET(request: Request) {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.DEBUG_PROMOTION_GRADES !== "1"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId")?.trim();
  const academicYearRaw = searchParams.get("academicYear")?.trim();
  const student = searchParams.get("student")?.trim() ?? "Feisal";

  if (!classId || !academicYearRaw) {
    return NextResponse.json(
      {
        error: "Required query params: classId, academicYear",
        example:
          "/api/debug/promotion-grades?classId=UUID&academicYear=2026&student=Feisal",
      },
      { status: 400 }
    );
  }

  const academicYear = Number(academicYearRaw);
  if (!Number.isFinite(academicYear)) {
    return NextResponse.json(
      { error: "academicYear must be a number" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) {
    return NextResponse.json({ error: "No school" }, { status: 403 });
  }

  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: schoolId,
  } as never);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let dataClient;
  try {
    dataClient = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Service role client required for debug",
      },
      { status: 500 }
    );
  }

  const report = await buildPromotionGradeDebugReport(dataClient, {
    schoolId,
    classId,
    academicYear,
    studentNameContains: student,
    maxStudents: 5,
  });

  logPromotionGradeDebugReport(report);

  return NextResponse.json(report);
}
