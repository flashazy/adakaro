import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import {
  enrichSchoolLifecycle,
  loadSchoolLifecycleMetrics,
} from "@/lib/super-admin/load-school-lifecycle-metrics";
import { normalizeSchoolLifecycleStatus } from "@/lib/super-admin/school-lifecycle";
import type { SuperAdminContactRow } from "@/lib/super-admin/contacts-types";
import {
  normalizeEmail,
  normalizePhoneDisplay,
  normalizeTzPhoneDigits,
} from "@/lib/super-admin/contacts-phone";

type AdminClient = ReturnType<typeof createAdminClient>;

interface SchoolRow {
  id: string;
  name: string;
  plan: string;
  school_status: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
}

function dedupeKey(row: SuperAdminContactRow): string {
  const phoneKey = row.phone ? normalizeTzPhoneDigits(row.phone) : "";
  const email = normalizeEmail(row.email);
  if (phoneKey) return `phone:${phoneKey}:${row.contactType}:${row.schoolId}`;
  if (email) return `email:${email}:${row.contactType}:${row.schoolId}`;
  return row.id;
}

function mergeLinkedStudents(existing: string | null, next: string): string {
  if (!existing) return next;
  const parts = existing.split(", ").filter(Boolean);
  if (parts.includes(next)) return existing;
  return [...parts, next].join(", ");
}

async function loadProfilesByIds(
  admin: AdminClient,
  userIds: string[]
): Promise<Map<string, ProfileRow>> {
  const map = new Map<string, ProfileRow>();
  if (userIds.length === 0) return map;

  const unique = [...new Set(userIds)];
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, email, phone, role")
      .in("id", chunk);
    if (error) {
      throw new Error(`profiles select: ${error.message}`);
    }
    for (const row of (data ?? []) as ProfileRow[]) {
      map.set(row.id, row);
    }
  }
  return map;
}

async function loadSchools(admin: AdminClient): Promise<SchoolRow[]> {
  const schoolsRes = await admin
    .from("schools")
    .select(
      "id, name, plan, school_status, last_activity_at, created_at, updated_at"
    )
    .order("name", { ascending: true })
    .limit(10_000);

  if (!schoolsRes.error) {
    return (schoolsRes.data ?? []) as SchoolRow[];
  }

  if (schoolsRes.error.message?.match(/school_status|last_activity_at/i)) {
    const fallback = await admin
      .from("schools")
      .select("id, name, plan, created_at, updated_at")
      .order("name", { ascending: true })
      .limit(10_000);
    if (fallback.error) {
      throw new Error(`schools select: ${fallback.error.message}`);
    }
    return (
      (fallback.data ?? []) as Omit<
        SchoolRow,
        "school_status" | "last_activity_at"
      >[]
    ).map((s) => ({
      ...s,
      school_status: "setup",
      last_activity_at: null,
    }));
  }

  throw new Error(`schools select: ${schoolsRes.error.message}`);
}

async function loadHealthBySchool(
  admin: AdminClient,
  schools: SchoolRow[]
): Promise<Map<string, number>> {
  const healthBySchool = new Map<string, number>();
  try {
    const schoolIds = schools.map((s) => s.id);
    const metricsMap = await loadSchoolLifecycleMetrics(admin, schoolIds);
    for (const school of schools) {
      const metrics = metricsMap.get(school.id);
      if (!metrics) continue;
      const enriched = enrichSchoolLifecycle(
        normalizeSchoolLifecycleStatus(school.school_status),
        school.last_activity_at,
        metrics,
        { updatedAt: school.updated_at, createdAt: school.created_at }
      );
      healthBySchool.set(school.id, enriched.health.score);
    }
  } catch (e) {
    console.warn(
      "[super-admin/contacts] health scores unavailable:",
      e instanceof Error ? e.message : e
    );
  }
  return healthBySchool;
}

function schoolContactFields(
  school: SchoolRow
): Pick<
  SuperAdminContactRow,
  "schoolId" | "schoolName" | "schoolPlan" | "schoolStatus"
> {
  return {
    schoolId: school.id,
    schoolName: school.name,
    schoolPlan: school.plan,
    schoolStatus: normalizeSchoolLifecycleStatus(school.school_status),
  };
}

/**
 * Load all platform contacts for Super Admin (service role).
 */
export async function loadSuperAdminContacts(
  admin: AdminClient
): Promise<SuperAdminContactRow[]> {
  const schools = await loadSchools(admin);
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const healthBySchool = await loadHealthBySchool(admin, schools);

  const memberRows = await fetchAllRows<{
    school_id: string;
    user_id: string;
    role: string;
  }>({
    label: "super-admin/contacts/school_members",
    fetchPage: async (from, to) =>
      await admin
        .from("school_members")
        .select("school_id, user_id, role")
        .in("role", ["admin", "teacher"])
        .range(from, to),
  });

  const teacherAssignmentRows = await fetchAllRows<{
    school_id: string;
    teacher_id: string;
  }>({
    label: "super-admin/contacts/teacher_assignments",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_assignments")
        .select("school_id, teacher_id")
        .range(from, to),
  });

  const memberUserIds = memberRows.map((m) => m.user_id);
  const assignmentUserIds = teacherAssignmentRows.map((t) => t.teacher_id);
  const profileById = await loadProfilesByIds(admin, [
    ...memberUserIds,
    ...assignmentUserIds,
  ]);

  const classTeacherMap = new Map<string, string>();
  const classRows = await fetchAllRows<{
    class_teacher_id: string | null;
    name: string;
    school_id: string;
  }>({
    label: "super-admin/contacts/classes",
    fetchPage: async (from, to) =>
      await admin
        .from("classes")
        .select("class_teacher_id, name, school_id")
        .not("class_teacher_id", "is", null)
        .range(from, to),
  });

  for (const cls of classRows) {
    if (!cls.class_teacher_id) continue;
    const key = `${cls.school_id}:${cls.class_teacher_id}`;
    const existing = classTeacherMap.get(key);
    classTeacherMap.set(
      key,
      existing ? `${existing}, ${cls.name}` : cls.name
    );
  }

  const rows: SuperAdminContactRow[] = [];
  const seen = new Set<string>();
  const teacherMemberKeys = new Set<string>();

  const pushRow = (row: SuperAdminContactRow) => {
    const key = dedupeKey(row);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  for (const member of memberRows) {
    const school = schoolById.get(member.school_id);
    if (!school) continue;

    const profile = profileById.get(member.user_id);
    if (profile?.role === "super_admin") continue;

    const contactType = member.role === "admin" ? "admin" : "teacher";
    if (contactType === "teacher") {
      teacherMemberKeys.add(`${member.school_id}:${member.user_id}`);
    }

    const assignedClass =
      contactType === "teacher"
        ? classTeacherMap.get(`${member.school_id}:${member.user_id}`) ?? null
        : null;

    pushRow({
      id: `${contactType}:${member.user_id}:${member.school_id}`,
      contactType,
      name: profile?.full_name?.trim() || "Unknown",
      email: normalizeEmail(profile?.email),
      phone: normalizePhoneDisplay(profile?.phone),
      ...schoolContactFields(school),
      healthScore:
        contactType === "admin"
          ? (healthBySchool.get(school.id) ?? null)
          : null,
      assignedClass,
      linkedStudents: null,
      sourceLabel:
        contactType === "admin"
          ? "School admin"
          : assignedClass
            ? "Class teacher"
            : "Teacher",
    });
  }

  for (const assignment of teacherAssignmentRows) {
    const school = schoolById.get(assignment.school_id);
    if (!school) continue;

    const memberKey = `${assignment.school_id}:${assignment.teacher_id}`;
    if (teacherMemberKeys.has(memberKey)) continue;

    const profile = profileById.get(assignment.teacher_id);
    if (profile?.role === "super_admin") continue;

    const assignedClass =
      classTeacherMap.get(memberKey) ?? null;

    pushRow({
      id: `teacher:${assignment.teacher_id}:${assignment.school_id}`,
      contactType: "teacher",
      name: profile?.full_name?.trim() || "Unknown",
      email: normalizeEmail(profile?.email),
      phone: normalizePhoneDisplay(profile?.phone),
      ...schoolContactFields(school),
      healthScore: null,
      assignedClass,
      linkedStudents: null,
      sourceLabel: assignedClass ? "Class teacher" : "Teacher",
    });
    teacherMemberKeys.add(memberKey);
  }

  const parentLinkRows = await fetchAllRows<{
    parent_id: string;
    student_id: string;
    parent: ProfileRow | ProfileRow[] | null;
    student: {
      full_name: string | null;
      school_id: string;
      parent_name: string | null;
      parent_email: string | null;
      parent_phone: string | null;
    } | null;
  }>({
    label: "super-admin/contacts/parent_students",
    fetchPage: async (from, to) =>
      await admin
        .from("parent_students")
        .select(
          `
          parent_id,
          student_id,
          parent:profiles ( id, full_name, email, phone, role ),
          student:students ( full_name, school_id, parent_name, parent_email, parent_phone )
        `
        )
        .range(from, to),
  });

  const parentBySchool = new Map<string, SuperAdminContactRow>();

  for (const link of parentLinkRows) {
    const studentRaw = link.student;
    const student = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw;
    if (!student?.school_id) continue;

    const school = schoolById.get(student.school_id);
    if (!school) continue;

    const profileRaw = link.parent;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    const parentKey = `${link.parent_id}:${student.school_id}`;
    const studentName = student.full_name?.trim() || "Student";
    const name = profile?.full_name?.trim() || "Parent / Guardian";
    const email =
      normalizeEmail(profile?.email) ?? normalizeEmail(student.parent_email);
    const phone =
      normalizePhoneDisplay(profile?.phone) ??
      normalizePhoneDisplay(student.parent_phone);

    const existing = parentBySchool.get(parentKey);
    if (existing) {
      existing.linkedStudents = mergeLinkedStudents(
        existing.linkedStudents,
        studentName
      );
      if (!existing.email && email) existing.email = email;
      if (!existing.phone && phone) existing.phone = phone;
      continue;
    }

    parentBySchool.set(parentKey, {
      id: `parent:${link.parent_id}:${student.school_id}`,
      contactType: "parent",
      name,
      email,
      phone,
      ...schoolContactFields(school),
      healthScore: null,
      assignedClass: null,
      linkedStudents: studentName,
      sourceLabel: "Parent account",
    });
  }

  for (const parentRow of parentBySchool.values()) {
    pushRow(parentRow);
  }

  const guardianRows = await fetchAllRows<{
    id: string;
    school_id: string;
    full_name: string | null;
    parent_name: string | null;
    parent_email: string | null;
    parent_phone: string | null;
  }>({
    label: "super-admin/contacts/student_guardians",
    fetchPage: async (from, to) =>
      await admin
        .from("students")
        .select(
          "id, school_id, full_name, parent_name, parent_email, parent_phone"
        )
        .or(
          "parent_phone.not.is.null,parent_email.not.is.null,parent_name.not.is.null"
        )
        .range(from, to),
  });

  for (const student of guardianRows) {
    const school = schoolById.get(student.school_id);
    if (!school) continue;

    const name = student.parent_name?.trim() || "Parent / Guardian";
    const email = normalizeEmail(student.parent_email);
    const phone = normalizePhoneDisplay(student.parent_phone);
    if (!email && !phone && !student.parent_name?.trim()) continue;

    pushRow({
      id: `guardian:${student.id}:${student.school_id}`,
      contactType: "parent",
      name,
      email,
      phone,
      ...schoolContactFields(school),
      healthScore: null,
      assignedClass: null,
      linkedStudents: student.full_name?.trim() || "Student",
      sourceLabel: "Guardian on file",
    });
  }

  rows.sort((a, b) => {
    const schoolCmp = a.schoolName.localeCompare(b.schoolName);
    if (schoolCmp !== 0) return schoolCmp;
    const typeOrder = { admin: 0, teacher: 1, parent: 2 };
    if (typeOrder[a.contactType] !== typeOrder[b.contactType]) {
      return typeOrder[a.contactType] - typeOrder[b.contactType];
    }
    return a.name.localeCompare(b.name);
  });

  return rows;
}
