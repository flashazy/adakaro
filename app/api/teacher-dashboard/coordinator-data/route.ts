import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import {
  defaultCoordinatorAcademicYear,
  defaultCoordinatorTerm,
  loadCoordinatorOverview,
} from "@/app/(dashboard)/teacher-dashboard/coordinator/data";

function parseTermParam(raw: unknown): "Term 1" | "Term 2" {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "Term 2") return "Term 2";
  if (v === "Term 1") return "Term 1";
  return defaultCoordinatorTerm();
}

function parseYearParam(raw: unknown): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v === "string" && /^\d{4}$/.test(v.trim())) return v.trim();
  return defaultCoordinatorAcademicYear();
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await checkIsTeacher(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const term = parseTermParam(url.searchParams.get("term"));
    const academicYear = parseYearParam(url.searchParams.get("year"));

    const overview = await loadCoordinatorOverview({
      userId: user.id,
      term,
      academicYear,
    });

    console.log("[api/coordinator-data]", {
      teacherName: overview.teacherName,
      term,
      academicYear,
      classCount: overview.classes.length,
      reportCardCounts: overview.classes.map((c) => ({
        classId: c.classId,
        reportCards: c.reportCards.length,
        roster: c.classRoster.length,
        subjects: c.subjects.length,
      })),
    });

    const overviewSafe = {
      teacherName: overview.teacherName,
      coordinatorSignatureUrl: overview.coordinatorSignatureUrl,
      coordinatorSignatureVersion: overview.coordinatorSignatureVersion,
      classes: overview.classes.map((k) => ({
        classId: k.classId,
        className: k.className,
        schoolId: k.schoolId,
        schoolName: k.schoolName,
        schoolMotto: k.schoolMotto ?? null,
        schoolLogoUrl: k.schoolLogoUrl ?? null,
        schoolLevel: k.schoolLevel,
        academicYear: k.academicYear,
        studentCount: k.studentCount,
        subjects: k.subjects.map((s) => ({
          subjectId: s.subjectId ?? null,
          name: s.name,
          examStatus: s.examStatus,
        })),
        reportCards: k.reportCards.map((r) => ({
          reportCardId: r.reportCardId,
          studentId: r.studentId,
          studentName: r.studentName,
          parentEmail: r.parentEmail ?? null,
          admissionNumber: r.admissionNumber ?? null,
          gender: r.gender ?? null,
          status: r.status,
          preview: r.preview,
        })),
        classRoster: k.classRoster.map((row) => ({
          studentId: row.studentId,
          fullName: row.fullName,
          item: row.item
            ? {
                reportCardId: row.item.reportCardId,
                studentId: row.item.studentId,
                studentName: row.item.studentName,
                parentEmail: row.item.parentEmail ?? null,
                admissionNumber: row.item.admissionNumber ?? null,
                gender: row.item.gender ?? null,
                status: row.item.status,
                preview: row.item.preview,
              }
            : null,
        })),
      })),
    } satisfies typeof overview;

    return NextResponse.json({ overview: overviewSafe, term, academicYear });
  } catch (error) {
    console.error("[api/coordinator-data] failed", error);
    return NextResponse.json(
      { error: "Failed to load coordinator dashboard data." },
      { status: 500 }
    );
  }
}
