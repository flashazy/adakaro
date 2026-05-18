import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserDisplayNames } from "@/lib/users/resolve-user-display-name";
import type {
  ActiveDutyTeacher,
  TeacherDutyAssignment,
  TeacherDutyAssignmentStatus,
  TeacherDutyContext,
} from "./types";

type Supabase = SupabaseClient<Database>;

type AssignmentDbRow = {
  id: string;
  school_id: string;
  teacher_id: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  notes: string | null;
  revoked_at: string | null;
  created_at: string;
};

const ASSIGNMENT_SELECT =
  "id, school_id, teacher_id, start_date, end_date, is_active, notes, revoked_at, created_at";

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [ys, ms, ds] = isoDate.split("-").map(Number);
  const d = new Date(Date.UTC(ys, ms - 1, ds));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** End date from start + duration (inclusive). Duration 7 from May 10 → May 16. */
export function computeDutyEndDate(startDate: string, durationDays: number): string {
  if (durationDays < 1) return startDate;
  return addDaysToIsoDate(startDate, durationDays - 1);
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDutyAssignmentStatus(
  row: Pick<
    AssignmentDbRow,
    "start_date" | "end_date" | "revoked_at" | "is_active"
  >,
  onDate: string = todayIsoUtc()
): TeacherDutyAssignmentStatus {
  if (row.revoked_at || !row.is_active) return "revoked";
  const start = parseIsoDate(row.start_date);
  const end = parseIsoDate(row.end_date);
  const current = parseIsoDate(onDate);
  if (current < start) return "upcoming";
  if (current > end) return "completed";
  return "active";
}

export function getRemainingDutyDays(
  endDate: string,
  onDate: string = todayIsoUtc()
): number | null {
  const end = parseIsoDate(endDate);
  const current = parseIsoDate(onDate);
  if (current > end) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - current.getTime()) / msPerDay);
}

export async function isTeacherOnDuty(
  supabase: Supabase,
  schoolId: string,
  teacherId: string,
  onDate?: string
): Promise<boolean> {
  const date = onDate ?? todayIsoUtc();
  const { data, error } = await supabase.rpc("is_teacher_on_duty", {
    p_school_id: schoolId,
    p_teacher_id: teacherId,
    p_on_date: date,
  } as never);

  if (!error && data === true) return true;

  if (error) {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("teacher_duty_assignments")
      .select("id")
      .eq("school_id", schoolId)
      .eq("teacher_id", teacherId)
      .eq("is_active", true)
      .is("revoked_at", null)
      .lte("start_date", date)
      .gte("end_date", date)
      .limit(1)
      .maybeSingle();
    return Boolean(row);
  }

  return false;
}

export async function getTeacherDutyAssignment(
  supabase: Supabase,
  schoolId: string,
  teacherId: string,
  onDate?: string
): Promise<TeacherDutyContext> {
  const date = onDate ?? todayIsoUtc();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_duty_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .eq("is_active", true)
    .is("revoked_at", null)
    .lte("start_date", date)
    .gte("end_date", date)
    .order("end_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    const onDuty = await isTeacherOnDuty(supabase, schoolId, teacherId, date);
    return { isOnDuty: onDuty, assignment: null };
  }

  const row = data as AssignmentDbRow;
  return {
    isOnDuty: true,
    assignment: { startDate: row.start_date, endDate: row.end_date },
  };
}

export async function getActiveDutyTeachersForSchool(
  schoolId: string,
  onDate?: string
): Promise<ActiveDutyTeacher[]> {
  const date = onDate ?? todayIsoUtc();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_duty_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .is("revoked_at", null)
    .lte("start_date", date)
    .gte("end_date", date)
    .order("end_date", { ascending: true });

  if (error || !data?.length) return [];

  const rows = data as AssignmentDbRow[];
  const names = await resolveUserDisplayNames(
    rows.map((r) => r.teacher_id),
    "Teacher"
  );

  return rows.map((r) => ({
    teacherId: r.teacher_id,
    fullName: names.get(r.teacher_id) ?? "Teacher",
    endDate: r.end_date,
  }));
}

export async function listTeacherDutyAssignmentsForSchool(
  schoolId: string,
  options?: { includeCompletedDays?: number }
): Promise<TeacherDutyAssignment[]> {
  const admin = createAdminClient();
  const includeCompletedDays = options?.includeCompletedDays ?? 60;
  const cutoff = addDaysToIsoDate(todayIsoUtc(), -includeCompletedDays);

  const { data, error } = await admin
    .from("teacher_duty_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("school_id", schoolId)
    .gte("end_date", cutoff)
    .order("start_date", { ascending: false });

  if (error || !data?.length) return [];

  const rows = data as AssignmentDbRow[];
  const names = await resolveUserDisplayNames(
    rows.map((r) => r.teacher_id),
    "Teacher"
  );
  const today = todayIsoUtc();

  return rows.map((r) => {
    const status = getDutyAssignmentStatus(r, today);
    return {
      id: r.id,
      schoolId: r.school_id,
      teacherId: r.teacher_id,
      teacherName: names.get(r.teacher_id) ?? "Teacher",
      startDate: r.start_date,
      endDate: r.end_date,
      isActive: r.is_active,
      notes: r.notes,
      revokedAt: r.revoked_at,
      createdAt: r.created_at,
      status,
      remainingDays:
        status === "active" || status === "upcoming"
          ? getRemainingDutyDays(r.end_date, today)
          : null,
    };
  });
}
