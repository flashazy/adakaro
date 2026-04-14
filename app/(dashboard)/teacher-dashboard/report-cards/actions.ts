"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import {
  computeReportCardTermAverage,
  letterGradeFromPercent,
} from "./report-card-grades";
import {
  ensureReportCard,
  loadStudentsReportData,
  loadSubjectsForClass,
} from "./queries";
import type {
  ReportCardCommentRow,
  ReportCardStatus,
} from "./report-card-types";
import { isMissingColumnSchemaError } from "./report-card-schema-compat";

export type { ReportCardStatus } from "./report-card-types";

interface TeacherReportCardCommentSelectRow {
  id: string;
  subject: string;
  comment: string | null;
  score_percent?: number | string | null;
  letter_grade?: string | null;
  exam1_score?: number | string | null;
  exam2_score?: number | string | null;
  calculated_score?: number | string | null;
  calculated_grade?: string | null;
}

function mapReportCardCommentRow(row: TeacherReportCardCommentSelectRow): ReportCardCommentRow {
  const parseNumeric = (
    v: number | string | null | undefined
  ): number | null => {
    if (v == null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    id: row.id,
    subject: row.subject,
    comment: row.comment,
    scorePercent: parseNumeric(row.score_percent),
    letterGrade: row.letter_grade ?? null,
    exam1Score: parseNumeric(row.exam1_score),
    exam2Score: parseNumeric(row.exam2_score),
    calculatedScore: parseNumeric(row.calculated_score),
    calculatedGrade: row.calculated_grade ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = any;

export async function getSubjectsForClass(classId: string) {
  return loadSubjectsForClass(classId);
}

export async function reloadStudentsReportData(
  classId: string,
  term: string,
  academicYear: string
) {
  return loadStudentsReportData(classId, term, academicYear);
}

export async function upsertReportCardComment(input: {
  studentId: string;
  classId: string;
  schoolId: string;
  term: string;
  academicYear: string;
  subject: string;
  comment: string | null;
  exam1Score: number | null;
  exam2Score: number | null;
}): Promise<
  | { ok: true; reportCardId: string; comment: ReportCardCommentRow }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const admin = createAdminClient() as AdminDb;

  const academicYear = input.academicYear.trim();
  const term = input.term.trim();
  const subject = input.subject.trim();

  const rc = await ensureReportCard(
    admin,
    user.id,
    input.studentId,
    input.classId,
    input.schoolId.trim(),
    term,
    academicYear
  );
  if (!rc.ok) return rc;

  const calculated_score = computeReportCardTermAverage(
    input.exam1Score,
    input.exam2Score
  );
  const calculated_grade =
    calculated_score != null
      ? letterGradeFromPercent(calculated_score)
      : null;
  const score_percent = calculated_score;
  const letter_grade = calculated_grade;

  const { data: existing, error: existingLookupErr } = await admin
    .from("teacher_report_card_comments")
    .select("id")
    .eq("teacher_id", user.id)
    .eq("student_id", input.studentId)
    .eq("subject", subject)
    .eq("academic_year", academicYear)
    .eq("term", term)
    .maybeSingle();

  if (existingLookupErr) {
    console.error(
      "[upsertReportCardComment] comment lookup failed",
      existingLookupErr
    );
    return { ok: false, error: existingLookupErr.message };
  }

  const selectColsFull =
    "id, subject, comment, score_percent, letter_grade, exam1_score, exam2_score, calculated_score, calculated_grade";
  const selectColsLegacy =
    "id, subject, comment, score_percent, letter_grade";

  const extendedWrite = {
    comment: input.comment,
    exam1_score: input.exam1Score,
    exam2_score: input.exam2Score,
    calculated_score,
    calculated_grade,
    score_percent,
    letter_grade,
    report_card_id: rc.id,
  };

  const legacyWrite = {
    comment: input.comment,
    score_percent,
    letter_grade,
    report_card_id: rc.id,
  };

  const insertBase = {
    teacher_id: user.id,
    student_id: input.studentId,
    subject,
    academic_year: academicYear,
    term,
    report_card_id: rc.id,
    comment: input.comment,
    status: "draft" as const,
  };

  const insertExtended = {
    ...insertBase,
    exam1_score: input.exam1Score,
    exam2_score: input.exam2Score,
    calculated_score,
    calculated_grade,
    score_percent,
    letter_grade,
  };

  const insertLegacy = {
    ...insertBase,
    score_percent,
    letter_grade,
  };

  if (existing) {
    const commentId = (existing as { id: string }).id;
    let res = await admin
      .from("teacher_report_card_comments")
      .update(extendedWrite)
      .eq("id", commentId)
      .select(selectColsFull)
      .single();

    if (res.error && isMissingColumnSchemaError(res.error)) {
      res = await admin
        .from("teacher_report_card_comments")
        .update(legacyWrite)
        .eq("id", commentId)
        .select(selectColsLegacy)
        .single();
    }

    if (res.error) {
      console.error("[upsertReportCardComment] update failed", res.error);
      return { ok: false, error: res.error.message };
    }
    if (!res.data) {
      return { ok: false, error: "No row returned after update" };
    }
    revalidatePath("/teacher-dashboard/report-cards");
    return {
      ok: true,
      reportCardId: rc.id,
      comment: mapReportCardCommentRow(
        res.data as TeacherReportCardCommentSelectRow
      ),
    };
  }

  let ins = await admin
    .from("teacher_report_card_comments")
    .insert(
      insertExtended as Database["public"]["Tables"]["teacher_report_card_comments"]["Insert"]
    )
    .select(selectColsFull)
    .single();

  if (ins.error && isMissingColumnSchemaError(ins.error)) {
    ins = await admin
      .from("teacher_report_card_comments")
      .insert(
        insertLegacy as Database["public"]["Tables"]["teacher_report_card_comments"]["Insert"]
      )
      .select(selectColsLegacy)
      .single();
  }

  if (ins.error) {
    console.error("[upsertReportCardComment] insert failed", ins.error);
    return { ok: false, error: ins.error.message };
  }
  if (!ins.data) {
    return { ok: false, error: "No row returned after insert" };
  }
  revalidatePath("/teacher-dashboard/report-cards");
  return {
    ok: true,
    reportCardId: rc.id,
    comment: mapReportCardCommentRow(
      ins.data as TeacherReportCardCommentSelectRow
    ),
  };
}

export async function submitReportCardForReview(
  reportCardId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const admin = createAdminClient() as AdminDb;

  const { error } = await admin
    .from("report_cards")
    .update({
      status: "pending_review",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", reportCardId)
    .eq("teacher_id", user.id)
    .in("status", ["draft", "changes_requested"]);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher-dashboard/report-cards");
  return { ok: true };
}

export async function adminApproveReportCard(
  reportCardId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const admin = createAdminClient() as AdminDb;

  const { data: rc } = await admin
    .from("report_cards")
    .select("school_id")
    .eq("id", reportCardId)
    .maybeSingle();
  if (!rc) return { ok: false, error: "Report card not found" };

  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: (rc as { school_id: string }).school_id,
  } as never);
  if (!isAdmin) {
    return { ok: false, error: "Only a school administrator can approve." };
  }

  const { error } = await admin
    .from("report_cards")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", reportCardId)
    .eq("status", "pending_review");

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher-dashboard/report-cards");
  return { ok: true };
}

export async function adminRequestChangesReportCard(
  reportCardId: string,
  note: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const admin = createAdminClient() as AdminDb;

  const { data: rc } = await admin
    .from("report_cards")
    .select("school_id")
    .eq("id", reportCardId)
    .maybeSingle();
  if (!rc) return { ok: false, error: "Report card not found" };

  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: (rc as { school_id: string }).school_id,
  } as never);
  if (!isAdmin) {
    return { ok: false, error: "Only a school administrator can review." };
  }

  const { error } = await admin
    .from("report_cards")
    .update({
      status: "changes_requested",
      admin_note: note.trim() || null,
      reviewed_by: user.id,
    })
    .eq("id", reportCardId)
    .eq("status", "pending_review");

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher-dashboard/report-cards");
  return { ok: true };
}

function getPublicAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function shareReportCardWithParent(input: {
  reportCardId: string;
  parentEmail: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const admin = createAdminClient() as AdminDb;

  const { data: rc } = await admin
    .from("report_cards")
    .select(
      "id, status, student_id, term, academic_year, students(full_name, parent_email)"
    )
    .eq("id", input.reportCardId)
    .maybeSingle();

  if (!rc) return { ok: false, error: "Report card not found" };

  const row = rc as unknown as {
    status: ReportCardStatus;
    student_id: string;
    term: string;
    academic_year: string;
    students: { full_name: string; parent_email: string | null } | null;
  };

  if (row.status !== "approved") {
    return {
      ok: false,
      error: "Only approved report cards can be shared with parents.",
    };
  }

  const email =
    input.parentEmail.trim() || row.students?.parent_email?.trim() || "";
  if (!email) {
    return {
      ok: false,
      error:
        "No parent email on file. Add parent email to the student record first.",
    };
  }

  const base = getPublicAppBaseUrl();
  const link = `${base}/parent-dashboard/report-card?studentId=${encodeURIComponent(row.student_id)}&term=${encodeURIComponent(row.term)}&year=${encodeURIComponent(row.academic_year)}`;

  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? "587");
  const smtpUser = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.GMAIL_APP_PASSWORD;
  const from =
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    (smtpUser ? `"Adakaro" <${smtpUser}>` : null);

  if (!smtpUser || !pass || !from) {
    return {
      ok: false,
      error:
        "Email is not configured (SMTP). Your administrator must set SMTP environment variables.",
    };
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: smtpUser, pass },
  });

  const studentName = row.students?.full_name ?? "your child";
  const subject = `Report card — ${studentName}`;
  const html = `
    <p>Hello,</p>
    <p>The report card for <strong>${escapeHtml(studentName)}</strong> (${escapeHtml(row.term)}, ${escapeHtml(row.academic_year)}) is ready.</p>
    <p><a href="${escapeHtml(link)}">View report card (sign in required)</a></p>
    <p style="color:#64748b;font-size:12px;">If the link does not work, copy:<br/>${escapeHtml(link)}</p>
    <p>— School (via Adakaro)</p>
  `;

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject,
      text: `Report card for ${studentName}: ${link}\n`,
      html,
    });
  } catch (e) {
    console.error("[report-card share]", e);
    return { ok: false, error: "Could not send email. Try again later." };
  }

  return { ok: true };
}
