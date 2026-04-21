"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSchoolAdminForUser } from "../teachers/actions";
import { toUppercase } from "@/lib/utils";
import {
  resolveSubjectCodeForSave,
  subjectCodePrefixFromName,
} from "@/lib/subject-code";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin client update typing
type Db = any;

export type SubjectActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export interface SubjectRow {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  assignmentCount: number;
  /** Comma-separated class names (sorted). */
  assignedClassNames: string;
  assignedClassIds: string[];
}

function parseClassIdsFromForm(formData: FormData): string[] {
  const raw = formData.getAll("class_ids");
  const ids = raw.map((v) => String(v).trim()).filter(Boolean);
  return [...new Set(ids)];
}

function parseSubjectIdsFromForm(formData: FormData): string[] {
  const raw = formData.getAll("subject_ids");
  const ids = raw.map((v) => String(v).trim()).filter(Boolean);
  return [...new Set(ids)];
}

/** Primary school for a user — service role only (no RLS). Mirrors teachers/actions. */
async function getSchoolIdForUserWithAdmin(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: mem } = await admin
      .from("school_members")
      .select("school_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (mem) return (mem as { school_id: string }).school_id;
    const { data: s } = await admin
      .from("schools")
      .select("id")
      .eq("created_by", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (s as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

async function assertClassIdsForSchool(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  classIds: string[]
): Promise<boolean> {
  if (classIds.length === 0) return true;
  const { data: rows } = await admin
    .from("classes")
    .select("id")
    .eq("school_id", schoolId)
    .in("id", classIds);
  const valid = new Set((rows ?? []).map((r) => (r as { id: string }).id));
  return classIds.every((id) => valid.has(id));
}

async function syncSubjectClassLinks(
  admin: ReturnType<typeof createAdminClient>,
  subjectId: string,
  classIds: string[]
): Promise<{ ok: false; error: string } | { ok: true }> {
  const uniqueClassIds = [...new Set(classIds)];

  const { error: delErr } = await admin
    .from("subject_classes")
    .delete()
    .eq("subject_id", subjectId);
  if (delErr) {
    return { ok: false, error: delErr.message || "Could not update class links." };
  }
  if (uniqueClassIds.length === 0) return { ok: true };

  const { error: insErr } = await (admin as Db).from("subject_classes").insert(
    uniqueClassIds.map((class_id) => ({ subject_id: subjectId, class_id }))
  );
  if (insErr) {
    const code = (insErr as { code?: string }).code;
    if (code === "23505") {
      return {
        ok: false,
        error: "This subject is already assigned to this class.",
      };
    }
    return { ok: false, error: insErr.message || "Could not save class links." };
  }
  return { ok: true };
}

/** When insert fails on unique (school_id, name), detect if a class in the form is already linked to that subject. */
async function existingSubjectHasOverlapWithSelectedClasses(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  subjectName: string,
  classIds: string[]
): Promise<boolean> {
  if (classIds.length === 0) return false;
  const { data: row } = await admin
    .from("subjects")
    .select("id")
    .eq("school_id", schoolId)
    .eq("name", subjectName)
    .maybeSingle();
  if (!row) return false;
  const subjectId = (row as { id: string }).id;
  const { data: links } = await admin
    .from("subject_classes")
    .select("class_id")
    .eq("subject_id", subjectId)
    .in("class_id", classIds);
  return (links ?? []).length > 0;
}

export async function fetchSubjectsForSchoolAdmin(
  schoolId: string
): Promise<SubjectRow[]> {
  const admin = createAdminClient();
  const { data: subjects } = await admin
    .from("subjects")
    .select("id, name, code, description")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  const { data: ta } = await admin
    .from("teacher_assignments")
    .select("subject_id")
    .eq("school_id", schoolId);

  const counts = new Map<string, number>();
  for (const r of ta ?? []) {
    const sid = (r as { subject_id: string | null }).subject_id;
    if (!sid) continue;
    counts.set(sid, (counts.get(sid) ?? 0) + 1);
  }

  const subjectIds = (subjects ?? []).map((s) => (s as { id: string }).id);
  const classNamesById = new Map<string, string>();
  const linksBySubject = new Map<string, string[]>();

  if (subjectIds.length > 0) {
    const { data: classRows } = await admin
      .from("classes")
      .select("id, name")
      .eq("school_id", schoolId);
    for (const c of classRows ?? []) {
      const row = c as { id: string; name: string };
      classNamesById.set(row.id, row.name);
    }

    const { data: scRows } = await admin
      .from("subject_classes")
      .select("subject_id, class_id")
      .in("subject_id", subjectIds);

    for (const r of scRows ?? []) {
      const row = r as { subject_id: string; class_id: string };
      const list = linksBySubject.get(row.subject_id) ?? [];
      list.push(row.class_id);
      linksBySubject.set(row.subject_id, list);
    }
  }

  return (subjects ?? []).map((s) => {
    const row = s as {
      id: string;
      name: string;
      code: string | null;
      description: string | null;
    };
    const classIds = linksBySubject.get(row.id) ?? [];
    const names = classIds
      .map((cid) => classNamesById.get(cid))
      .filter((n): n is string => Boolean(n))
      .sort((a, b) => a.localeCompare(b));
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      assignmentCount: counts.get(row.id) ?? 0,
      assignedClassNames: names.join(", "),
      assignedClassIds: classIds,
    };
  });
}

export async function createSubjectAction(
  _prev: SubjectActionState | null,
  formData: FormData
): Promise<SubjectActionState> {
  const name = toUppercase(String(formData.get("name") ?? ""));
  const code = String(formData.get("code") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const classIds = parseClassIdsFromForm(formData);

  if (!name) {
    return { ok: false, error: "Name is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUserWithAdmin(user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return { ok: false, error: "Only school administrators can manage subjects." };
  }

  const admin = createAdminClient();
  if (!(await assertClassIdsForSchool(admin, schoolId, classIds))) {
    return { ok: false, error: "One or more selected classes are invalid for your school." };
  }

  const resolvedCode = await resolveSubjectCodeForSave(
    admin,
    schoolId,
    name,
    code
  );

  const { data: inserted, error } = await admin
    .from("subjects")
    .insert({
      school_id: schoolId,
      name,
      code: resolvedCode,
      description,
    } as never)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      const overlap = await existingSubjectHasOverlapWithSelectedClasses(
        admin,
        schoolId,
        name,
        classIds
      );
      return {
        ok: false,
        error: overlap
          ? "This subject is already assigned to this class."
          : "A subject with this name already exists for your school.",
      };
    }
    return { ok: false, error: error.message || "Could not create subject." };
  }

  const newId = (inserted as { id: string } | null)?.id;
  if (!newId) {
    return { ok: false, error: "Could not create subject." };
  }

  const sync = await syncSubjectClassLinks(admin, newId, classIds);
  if (!sync.ok) {
    await admin.from("subjects").delete().eq("id", newId);
    return { ok: false, error: sync.error };
  }

  revalidatePath("/dashboard/subjects");
  revalidatePath("/dashboard/teachers");
  return { ok: true, message: "Subject added." };
}

/**
 * Update `subject_classes` for one or more existing subjects (no change to
 * name/code/description). Form sends `subject_ids` (one or many); each id
 * receives the same `class_ids` set.
 */
export async function assignSubjectClassesAction(
  _prev: SubjectActionState | null,
  formData: FormData
): Promise<SubjectActionState> {
  const subjectIds = parseSubjectIdsFromForm(formData);
  const classIds = parseClassIdsFromForm(formData);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUserWithAdmin(user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return { ok: false, error: "Only school administrators can manage subjects." };
  }

  if (subjectIds.length === 0) {
    return { ok: false, error: "Select at least one subject." };
  }

  const admin = createAdminClient();

  if (!(await assertClassIdsForSchool(admin, schoolId, classIds))) {
    return { ok: false, error: "One or more selected classes are invalid for your school." };
  }

  const { data: subjRows } = await admin
    .from("subjects")
    .select("id")
    .eq("school_id", schoolId)
    .in("id", subjectIds);

  const found = new Set(
    (subjRows ?? []).map((r) => (r as { id: string }).id)
  );
  if (subjectIds.some((id) => !found.has(id))) {
    return { ok: false, error: "One or more subjects are invalid for your school." };
  }

  for (const subjectId of subjectIds) {
    const sync = await syncSubjectClassLinks(admin, subjectId, classIds);
    if (!sync.ok) {
      return { ok: false, error: sync.error };
    }
  }

  revalidatePath("/dashboard/subjects");
  revalidatePath("/dashboard/teachers");
  return { ok: true, message: "Assignments saved successfully." };
}

export async function updateSubjectAction(
  _prev: SubjectActionState | null,
  formData: FormData
): Promise<SubjectActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const name = toUppercase(String(formData.get("name") ?? ""));
  const code = String(formData.get("code") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const classIds = parseClassIdsFromForm(formData);

  if (!id || !name) {
    return { ok: false, error: "Name is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUserWithAdmin(user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return { ok: false, error: "Only school administrators can manage subjects." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("subjects")
    .select("id, school_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || (existing as { school_id: string }).school_id !== schoolId) {
    return { ok: false, error: "Subject not found." };
  }

  if (!(await assertClassIdsForSchool(admin, schoolId, classIds))) {
    return { ok: false, error: "One or more selected classes are invalid for your school." };
  }

  const resolvedCode = await resolveSubjectCodeForSave(
    admin,
    schoolId,
    name,
    code,
    new Set(),
    id
  );

  const { error } = await admin
    .from("subjects")
    .update({
      name,
      code: resolvedCode,
      description,
    } as never)
    .eq("id", id)
    .eq("school_id", schoolId);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "A subject with this name already exists for your school.",
      };
    }
    return { ok: false, error: error.message || "Could not update subject." };
  }

  const sync = await syncSubjectClassLinks(admin, id, classIds);
  if (!sync.ok) {
    return { ok: false, error: sync.error };
  }

  const { data: row } = await admin
    .from("subjects")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const newName = (row as { name: string } | null)?.name?.trim() ?? name;

  await (admin as Db).from("teacher_assignments").update({ subject: newName }).eq("school_id", schoolId).eq("subject_id", id);

  revalidatePath("/dashboard/subjects");
  revalidatePath("/dashboard/teachers");
  revalidatePath("/teacher-dashboard");
  return { ok: true, message: "Subject updated." };
}

export async function bulkCreateSubjectsAction(
  _prev: SubjectActionState | null,
  formData: FormData
): Promise<SubjectActionState> {
  const namesRaw = String(formData.get("names_raw") ?? "");
  const codePrefix = toUppercase(String(formData.get("code_prefix") ?? "")).replace(
    /[^A-Z0-9]/g,
    ""
  );
  const description = String(formData.get("description") ?? "").trim() || null;
  const classIds = parseClassIdsFromForm(formData);

  const parsed = namesRaw
    .split(/[\n,]+/)
    .map((s) => toUppercase(s))
    .filter(Boolean);
  const uniqueNames: string[] = [];
  const seen = new Set<string>();
  for (const n of parsed) {
    if (!seen.has(n)) {
      seen.add(n);
      uniqueNames.push(n);
    }
  }

  if (uniqueNames.length === 0) {
    return { ok: false, error: "Enter at least one subject name." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUserWithAdmin(user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return { ok: false, error: "Only school administrators can manage subjects." };
  }

  const admin = createAdminClient();
  if (!(await assertClassIdsForSchool(admin, schoolId, classIds))) {
    return {
      ok: false,
      error: "One or more selected classes are invalid for your school.",
    };
  }

  let added = 0;
  let skippedDuplicates = 0;
  const failed: string[] = [];
  const reservedCodes = new Set<string>();

  for (let i = 0; i < uniqueNames.length; i++) {
    const name = uniqueNames[i];
    const code = codePrefix
      ? `${codePrefix}-${101 + i}`
      : await resolveSubjectCodeForSave(
          admin,
          schoolId,
          name,
          `${subjectCodePrefixFromName(name)}-101`,
          reservedCodes
        );
    if (!codePrefix) {
      reservedCodes.add(code);
    }

    const { data: inserted, error } = await admin
      .from("subjects")
      .insert({
        school_id: schoolId,
        name,
        code,
        description,
      } as never)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        skippedDuplicates++;
        continue;
      }
      failed.push(name);
      continue;
    }

    const newId = (inserted as { id: string } | null)?.id;
    if (!newId) {
      failed.push(name);
      continue;
    }

    if (classIds.length > 0) {
      const sync = await syncSubjectClassLinks(admin, newId, classIds);
      if (!sync.ok) {
        await admin.from("subjects").delete().eq("id", newId);
        failed.push(name);
        continue;
      }
    }

    added++;
  }

  if (added > 0) {
    revalidatePath("/dashboard/subjects");
    revalidatePath("/dashboard/teachers");
  }

  if (added === 0) {
    if (failed.length > 0) {
      return {
        ok: false,
        error: `Could not add: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? "…" : ""}.`,
      };
    }
    return {
      ok: false,
      error: `All ${skippedDuplicates} subject${skippedDuplicates === 1 ? "" : "s"} already exist for your school.`,
    };
  }

  const parts = [
    `Added ${added} subject${added === 1 ? "" : "s"} successfully.`,
  ];
  if (skippedDuplicates > 0) {
    parts.push(
      `Skipped ${skippedDuplicates} (already exist${skippedDuplicates === 1 ? "s" : ""}).`
    );
  }
  if (failed.length > 0) {
    parts.push(
      `Failed: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? "…" : ""}.`
    );
  }
  return { ok: true, message: parts.join(" ") };
}

export async function deleteSubjectAction(
  _prev: SubjectActionState | null,
  formData: FormData
): Promise<SubjectActionState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing subject." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUserWithAdmin(user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return { ok: false, error: "Only school administrators can manage subjects." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("subjects")
    .select("id, school_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || (existing as { school_id: string }).school_id !== schoolId) {
    return { ok: false, error: "Subject not found." };
  }

  const { count } = await admin
    .from("teacher_assignments")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("subject_id", id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error:
        "This subject is assigned to one or more teachers. Remove those assignments first.",
    };
  }

  const { error } = await admin
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("school_id", schoolId);

  if (error) {
    return { ok: false, error: error.message || "Could not delete subject." };
  }

  revalidatePath("/dashboard/subjects");
  revalidatePath("/dashboard/teachers");
  return { ok: true, message: "Subject removed." };
}
