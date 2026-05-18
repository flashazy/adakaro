"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import {
  assertCanViewDutyBook,
  getDutyBookReportPermissions,
} from "@/lib/duty-book/duty-book-access";
import { validateDutyBookEvents } from "@/lib/duty-book/duty-book-report-events";
import { loadDutyBookReport } from "@/lib/duty-book/load-duty-book-report";
import { persistDutyBookReport } from "@/lib/duty-book/persist-duty-book-report";
import type {
  DutyBookEvent,
  DutyBookReportPayload,
  DutyBookReportPermissions,
} from "@/lib/duty-book/duty-book-report-types";
import { resolveUserDisplayName } from "@/lib/users/resolve-user-display-name";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REMARKS = 10000;
const MAX_HEAD_TEACHER_COMMENT = 10000;

function parseDate(raw: string): string | null {
  const d = raw.trim();
  if (!DATE_RE.test(d)) return null;
  return d;
}

async function gate(
  reportDate: string
): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      schoolId: string;
      userId: string;
      date: string;
    }
  | { ok: false; error: string }
> {
  const date = parseDate(reportDate);
  if (!date) return { ok: false, error: "Invalid date." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  const view = await assertCanViewDutyBook(supabase, schoolId);
  if (!view.ok) return view;

  return { ok: true, supabase, schoolId, userId: user.id, date };
}

async function buildPayload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  reportDate: string,
  report: Awaited<ReturnType<typeof persistDutyBookReport>> | null
): Promise<DutyBookReportPayload> {
  if (!report) {
    return loadDutyBookReport(supabase, schoolId, reportDate);
  }

  let signer: DutyBookReportPayload["signer"] = null;
  if (report.headTeacherId) {
    const fullName = await resolveUserDisplayName(
      report.headTeacherId,
      report.headTeacherSignature?.trim() || "Head teacher"
    );
    signer = { id: report.headTeacherId, fullName };
  }

  return { report, signer };
}

export async function loadDutyBookReportAction(
  reportDate: string
): Promise<
  | {
      ok: true;
      data: DutyBookReportPayload;
      permissions: DutyBookReportPermissions;
    }
  | { ok: false; error: string }
> {
  const ctx = await gate(reportDate);
  if (!ctx.ok) return ctx;

  try {
    const data = await loadDutyBookReport(
      ctx.supabase,
      ctx.schoolId,
      ctx.date
    );
    const permissions = await getDutyBookReportPermissions(
      ctx.supabase,
      ctx.schoolId,
      !!data.report?.signedAt
    );
    return { ok: true, data, permissions };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load report.";
    return { ok: false, error: msg };
  }
}

export async function saveDutyBookReportAction(input: {
  reportDate: string;
  events: DutyBookEvent[];
  remarks: string;
}): Promise<
  | {
      ok: true;
      data: DutyBookReportPayload;
      permissions: DutyBookReportPermissions;
    }
  | { ok: false; error: string }
> {
  const ctx = await gate(input.reportDate);
  if (!ctx.ok) return ctx;

  const events = input.events;
  const eventsErr = validateDutyBookEvents(events);
  if (eventsErr) return { ok: false, error: eventsErr };

  const remarks = input.remarks.trim();
  if (remarks.length > MAX_REMARKS) {
    return { ok: false, error: "Remarks must be 10,000 characters or fewer." };
  }

  const existing = await loadDutyBookReport(
    ctx.supabase,
    ctx.schoolId,
    ctx.date
  );
  if (existing.report?.signedAt) {
    return {
      ok: false,
      error: "This report is signed and can no longer be edited.",
    };
  }

  const permissions = await getDutyBookReportPermissions(
    ctx.supabase,
    ctx.schoolId,
    false
  );
  if (!permissions.canEdit) {
    return {
      ok: false,
      error: "You do not have permission to edit this report.",
    };
  }

  try {
    const saved = await persistDutyBookReport({
      schoolId: ctx.schoolId,
      reportDate: ctx.date,
      userId: ctx.userId,
      events,
      remarks: remarks || null,
    });

    const data = await buildPayload(ctx.supabase, ctx.schoolId, ctx.date, saved);
    const nextPermissions = await getDutyBookReportPermissions(
      ctx.supabase,
      ctx.schoolId,
      !!data.report?.signedAt
    );

    revalidatePath("/dashboard/duty-book");
    return { ok: true, data, permissions: nextPermissions };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save report.";
    return { ok: false, error: msg };
  }
}

export async function signDutyBookReportAction(input: {
  reportDate: string;
  headTeacherComment?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await gate(input.reportDate);
  if (!ctx.ok) return ctx;

  const permissions = await getDutyBookReportPermissions(
    ctx.supabase,
    ctx.schoolId,
    false
  );
  if (!permissions.canSign) {
    return {
      ok: false,
      error: "Only the designated head teacher can sign this report.",
    };
  }

  const commentRaw = (input.headTeacherComment ?? "").trim();
  if (commentRaw.length > MAX_HEAD_TEACHER_COMMENT) {
    return {
      ok: false,
      error: "Head teacher comment must be 10,000 characters or fewer.",
    };
  }
  const headTeacherComment = commentRaw || null;

  const existing = await loadDutyBookReport(
    ctx.supabase,
    ctx.schoolId,
    ctx.date
  );
  if (existing.report?.signedAt) {
    return { ok: false, error: "This report is already signed." };
  }

  const signatureLabel = await resolveUserDisplayName(
    ctx.userId,
    "Head Teacher"
  );

  const signedAt = new Date().toISOString();

  if (existing.report) {
    const { error } = await ctx.supabase
      .from("duty_book_reports")
      .update({
        signed_at: signedAt,
        head_teacher_id: ctx.userId,
        head_teacher_signature: signatureLabel,
        head_teacher_comment: headTeacherComment,
      } as never)
      .eq("id", existing.report.id)
      .eq("school_id", ctx.schoolId)
      .is("signed_at", null);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await ctx.supabase.from("duty_book_reports").insert({
      school_id: ctx.schoolId,
      report_date: ctx.date,
      events: [],
      remarks: null,
      head_teacher_comment: headTeacherComment,
      created_by: ctx.userId,
      signed_at: signedAt,
      head_teacher_id: ctx.userId,
      head_teacher_signature: signatureLabel,
    } as never);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/duty-book");
  return { ok: true };
}
