import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { isTeacherOnDuty } from "@/lib/teacher-on-duty/teacher-duty";
import type { DutyBookReportPermissions } from "./duty-book-report-types";

type Supabase = SupabaseClient<Database>;

/** Fallback when `can_view_duty_book` RPC is missing (pre-migration) or errors. */
async function canViewDutyBookFallback(
  supabase: Supabase,
  schoolId: string,
  userId: string
): Promise<boolean> {
  const [
    { data: isSuper },
    { data: isAdmin },
    { data: isHeadTeacher },
    onDuty,
  ] = await Promise.all([
    supabase.rpc("is_super_admin", {} as never),
    supabase.rpc("is_school_admin", { p_school_id: schoolId } as never),
    supabase.rpc("is_school_head_teacher", { p_school_id: schoolId } as never),
    isTeacherOnDuty(supabase, schoolId, userId),
  ]);

  if (isSuper || isAdmin) return true;
  if (!isHeadTeacher && onDuty) return true;
  if (isHeadTeacher) return true;

  return false;
}

export async function canViewDutyBook(
  supabase: Supabase,
  schoolId: string,
  userId?: string
): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = userId ?? auth.user?.id;
  if (!uid) return false;

  const { data, error } = await supabase.rpc("can_view_duty_book", {
    p_school_id: schoolId,
  } as never);

  if (!error && data === true) return true;

  if (error) {
    const msg = error.message ?? "";
    const rpcMissing =
      /function.*does not exist|could not find.*can_view_duty_book/i.test(msg);
    if (process.env.NODE_ENV === "development") {
      console.warn("[duty-book] can_view_duty_book RPC:", msg || error);
    }
    if (!rpcMissing && process.env.NODE_ENV === "production") {
      // Unexpected RPC failure — still try legacy checks.
    }
  }

  return canViewDutyBookFallback(supabase, schoolId, uid);
}

export async function getDutyBookReportPermissions(
  supabase: Supabase,
  schoolId: string,
  reportSigned: boolean
): Promise<DutyBookReportPermissions> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) {
    return {
      canView: false,
      canEdit: false,
      canSign: false,
      canExport: false,
      isSchoolAdmin: false,
      isTeacherOnDuty: false,
    };
  }

  const canView = await canViewDutyBook(supabase, schoolId, userId);

  const [
    { data: isAdmin },
    { data: isHeadTeacher },
    { data: canSignRpc, error: signErr },
    onDuty,
  ] = await Promise.all([
    supabase.rpc("is_school_admin", { p_school_id: schoolId } as never),
    supabase.rpc("is_school_head_teacher", { p_school_id: schoolId } as never),
    supabase.rpc("can_sign_duty_book_report", {
      p_school_id: schoolId,
    } as never),
    isTeacherOnDuty(supabase, schoolId, userId),
  ]);

  let canSign = !!canSignRpc;
  if (signErr) {
    if (isHeadTeacher) {
      canSign = true;
    } else if (isAdmin) {
      const { data: schoolRow } = await supabase
        .from("schools")
        .select("head_teacher_id")
        .eq("id", schoolId)
        .maybeSingle();
      const htId = (schoolRow as { head_teacher_id: string | null } | null)
        ?.head_teacher_id;
      canSign = !htId;
    } else {
      canSign = false;
    }
  }

  const admin = !!isAdmin;
  const headTeacher = !!isHeadTeacher;
  const teacherOnDuty = onDuty && !admin && !headTeacher;

  const canEditReport =
    canView &&
    !reportSigned &&
    (admin || headTeacher || teacherOnDuty);

  return {
    canView,
    canEdit: canEditReport,
    canSign: canSign && !reportSigned,
    canExport: admin || headTeacher,
    isSchoolAdmin: admin,
    isTeacherOnDuty: teacherOnDuty,
  };
}

export async function assertCanViewDutyBook(
  supabase: Supabase,
  schoolId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowed = await canViewDutyBook(supabase, schoolId);
  if (!allowed) {
    return {
      ok: false,
      error: "You do not have permission to view the duty book.",
    };
  }
  return { ok: true };
}

export async function canExportDutyBook(
  supabase: Supabase,
  schoolId: string
): Promise<boolean> {
  const [{ data: isAdmin }, { data: isHeadTeacher }] = await Promise.all([
    supabase.rpc("is_school_admin", { p_school_id: schoolId } as never),
    supabase.rpc("is_school_head_teacher", { p_school_id: schoolId } as never),
  ]);
  return Boolean(isAdmin || isHeadTeacher);
}
