import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildParentReportCardPreviewData } from "@/app/(dashboard)/parent-dashboard/build-parent-report-card-preview";
import { sortParentReportCardsByRecency } from "@/lib/parent-report-card-order";
import { reportCardIsOnOrAfterEnrollment } from "@/lib/parent-academic-from-enrollment";

export type ParentReportCardTabRow =
  | {
      id: string;
      term: string;
      academic_year: string;
      status: string;
      previewData: unknown;
      feeBlocked: false;
    }
  | {
      id: string;
      term: string;
      academic_year: string;
      status: string;
      feeBlocked: true;
      feeEligibility: unknown;
    };

export interface ParentReportCardsLoadDebug {
  studentId: string;
  parentUserId: string;
  enrollmentDate: string | null;
  query: {
    table: string;
    filters: Record<string, string>;
  };
  rawApprovedCount: number;
  rawApproved: Array<{
    id: string;
    term: string;
    academic_year: string;
    status: string;
    approved_at: string | null;
  }>;
  afterEnrollmentFilterCount: number;
  excludedByEnrollment: Array<{
    id: string;
    term: string;
    academic_year: string;
    releaseDate: string | null;
    enrollmentBoundary: string | null;
  }>;
  buildOutcomes: Array<{
    id: string;
    term: string;
    academic_year: string;
    outcome: string;
  }>;
  finalRowCount: number;
  queryError: string | null;
  loadError: string | null;
}

function logParentReportCardsDebug(debug: ParentReportCardsLoadDebug): void {
  console.log("[parent-dashboard/report-cards]", JSON.stringify(debug, null, 2));
}

/**
 * Loads approved report cards for a parent-linked student (preview rows for the tab).
 * Uses the service role after verifying `parent_students` so RLS on joins cannot
 * hide approved cards.
 */
export async function loadParentReportCardsForStudentWithDebug(
  supabase: SupabaseClient,
  params: {
    parentUserId: string;
    studentId: string;
    enrollmentDate: string | null;
  }
): Promise<{ rows: ParentReportCardTabRow[]; debug: ParentReportCardsLoadDebug }> {
  const debug: ParentReportCardsLoadDebug = {
    studentId: params.studentId,
    parentUserId: params.parentUserId,
    enrollmentDate: params.enrollmentDate,
    query: {
      table: "report_cards",
      filters: {
        student_id: params.studentId,
        status: "approved",
      },
    },
    rawApprovedCount: 0,
    rawApproved: [],
    afterEnrollmentFilterCount: 0,
    excludedByEnrollment: [],
    buildOutcomes: [],
    finalRowCount: 0,
    queryError: null,
    loadError: null,
  };

  try {
    const { data: link, error: linkErr } = await supabase
      .from("parent_students")
      .select("student_id")
      .eq("parent_id", params.parentUserId)
      .eq("student_id", params.studentId)
      .maybeSingle();

    if (linkErr) {
      debug.loadError = linkErr.message;
      logParentReportCardsDebug(debug);
      return { rows: [], debug };
    }
    if (!link) {
      debug.loadError = "not_linked";
      logParentReportCardsDebug(debug);
      return { rows: [], debug };
    }

    const admin = createAdminClient();
    const { data: rawRows, error: qErr } = await admin
      .from("report_cards")
      .select(
        "id, student_id, term, academic_year, status, approved_at, updated_at, created_at"
      )
      .eq("student_id", params.studentId)
      .eq("status", "approved")
      .order("academic_year", { ascending: false })
      .limit(200);

    if (qErr) {
      debug.queryError = qErr.message;
      logParentReportCardsDebug(debug);
      return { rows: [], debug };
    }

    const raw = (rawRows ?? []) as {
      id: string;
      student_id: string;
      term: string;
      academic_year: string;
      status: string;
      approved_at: string | null;
      updated_at: string;
      created_at: string;
    }[];

    debug.rawApprovedCount = raw.length;
    debug.rawApproved = raw.map((r) => ({
      id: r.id,
      term: r.term,
      academic_year: r.academic_year,
      status: r.status,
      approved_at: r.approved_at,
    }));

    const enrollmentBoundary =
      params.enrollmentDate?.trim().slice(0, 10) ?? null;

    const filtered: typeof raw = [];
    for (const r of raw) {
      if (
        reportCardIsOnOrAfterEnrollment(
          {
            approved_at: r.approved_at,
            updated_at: r.updated_at,
            created_at: r.created_at,
          },
          params.enrollmentDate
        )
      ) {
        filtered.push(r);
      } else {
        debug.excludedByEnrollment.push({
          id: r.id,
          term: r.term,
          academic_year: r.academic_year,
          releaseDate: r.approved_at ?? r.updated_at ?? r.created_at,
          enrollmentBoundary,
        });
      }
    }

    debug.afterEnrollmentFilterCount = filtered.length;

    if (filtered.length === 0) {
      logParentReportCardsDebug(debug);
      return { rows: [], debug };
    }

    const rawSorted = sortParentReportCardsByRecency(filtered);
    const out: ParentReportCardTabRow[] = [];

    for (const r of rawSorted) {
      const term = r.term.trim();
      const academicYear = r.academic_year.trim();
      try {
        const built = await buildParentReportCardPreviewData(supabase, {
          parentUserId: params.parentUserId,
          studentId: params.studentId,
          term,
          academicYear,
        });
        if (built.ok) {
          debug.buildOutcomes.push({
            id: r.id,
            term,
            academic_year: academicYear,
            outcome: "ok",
          });
          out.push({
            id: r.id,
            term: r.term,
            academic_year: r.academic_year,
            status: r.status,
            previewData: built.data,
            feeBlocked: false,
          });
        } else if (built.error === "fee_blocked" && "eligibility" in built) {
          debug.buildOutcomes.push({
            id: r.id,
            term,
            academic_year: academicYear,
            outcome: "fee_blocked",
          });
          out.push({
            id: r.id,
            term: r.term,
            academic_year: r.academic_year,
            status: r.status,
            feeBlocked: true,
            feeEligibility: built.eligibility,
          });
        } else {
          debug.buildOutcomes.push({
            id: r.id,
            term,
            academic_year: academicYear,
            outcome: built.error,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "build_preview_threw";
        debug.buildOutcomes.push({
          id: r.id,
          term,
          academic_year: academicYear,
          outcome: `error:${message}`,
        });
      }
    }

    debug.finalRowCount = out.length;
    logParentReportCardsDebug(debug);
    return { rows: out, debug };
  } catch (err) {
    debug.loadError =
      err instanceof Error ? err.message : "loadParentReportCardsForStudent";
    logParentReportCardsDebug(debug);
    return { rows: [], debug };
  }
}
