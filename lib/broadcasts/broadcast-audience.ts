import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { BroadcastTargetType } from "@/lib/broadcasts/broadcast-target-types";
import { getSchoolAdminUserIds } from "@/lib/broadcasts/school-admin-user-ids";

export type BroadcastAudienceScope =
  | "all_schools"
  | "single_school"
  | "selected_schools"
  | "targeted_admins";

export interface BroadcastTargetInput {
  target_type?: BroadcastTargetType | string | null;
  target_user_ids?: string[] | null;
  target_school_id?: string | null;
  target_school_ids?: string[] | null;
}

export interface ResolvedBroadcastAudience {
  scope: BroadcastAudienceScope;
  recipientUserIds: string[];
  targetSchoolId: string | null;
  targetSchoolName: string | null;
  schoolIds: string[];
}

function normalizeUserIds(ids: string[] | null | undefined): string[] {
  if (!ids?.length) return [];
  return [...new Set(ids.map((x) => String(x).trim()).filter(Boolean))];
}

function normalizeSchoolIds(ids: string[] | null | undefined): string[] {
  if (!ids?.length) return [];
  return [...new Set(ids.map((x) => String(x).trim()).filter(Boolean))];
}

function intersectRecipients(
  primary: string[],
  explicitTargets: string[]
): string[] {
  if (explicitTargets.length === 0) return primary;
  const allowed = new Set(primary);
  return explicitTargets.filter((id) => allowed.has(id));
}

/**
 * School admin user ids for one school (school_members.role = admin), excluding super admins.
 */
export async function getSchoolAdminUserIdsForSchool(
  admin: SupabaseClient<Database>,
  schoolId: string
): Promise<string[]> {
  const [{ data: memRows }, { data: superRows }] = await Promise.all([
    admin
      .from("school_members")
      .select("user_id")
      .eq("school_id", schoolId)
      .eq("role", "admin"),
    admin.from("profiles").select("id").eq("role", "super_admin"),
  ]);

  const superSet = new Set(
    (superRows ?? []).map((r) => (r as { id: string }).id)
  );
  const ids = new Set<string>();
  for (const row of memRows ?? []) {
    const uid = (row as { user_id: string }).user_id;
    if (uid && !superSet.has(uid)) ids.add(uid);
  }
  return [...ids];
}

export async function getSchoolAdminUserIdsForSchools(
  admin: SupabaseClient<Database>,
  schoolIds: string[]
): Promise<string[]> {
  const unique = [...new Set(schoolIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const batches = await Promise.all(
    unique.map((schoolId) => getSchoolAdminUserIdsForSchool(admin, schoolId))
  );
  return [...new Set(batches.flat())];
}

async function deriveSchoolIdsForUsers(
  admin: SupabaseClient<Database>,
  userIds: string[]
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data: mem } = await admin
    .from("school_members")
    .select("school_id")
    .in("user_id", userIds)
    .eq("role", "admin");
  return [
    ...new Set(
      (mem ?? []).map((m) => (m as { school_id: string }).school_id).filter(Boolean)
    ),
  ];
}

async function loadSchoolName(
  admin: SupabaseClient<Database>,
  schoolId: string | null
): Promise<string | null> {
  if (!schoolId) return null;
  const { data } = await admin
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();
  const name = (data as { name: string } | null)?.name?.trim();
  return name || null;
}

function inferTargetType(broadcast: BroadcastTargetInput): BroadcastTargetType {
  if (broadcast.target_type) {
    return broadcast.target_type as BroadcastTargetType;
  }
  if (broadcast.target_school_id?.trim()) return "single_school";
  if (broadcast.target_school_ids?.length) return "selected_schools";
  if (broadcast.target_user_ids?.length) return "targeted_admins";
  return "all";
}

/**
 * Resolve the recipient audience for a broadcast (readers analytics + delivery scope).
 */
export async function resolveBroadcastAudience(
  admin: SupabaseClient<Database>,
  broadcast: BroadcastTargetInput
): Promise<ResolvedBroadcastAudience> {
  const explicitTargets = normalizeUserIds(broadcast.target_user_ids);
  const targetType = inferTargetType(broadcast);
  const targetSchoolId = broadcast.target_school_id?.trim() || null;
  const targetSchoolIds = normalizeSchoolIds(broadcast.target_school_ids);

  if (targetType === "single_school" && targetSchoolId) {
    const schoolAdmins = await getSchoolAdminUserIdsForSchool(admin, targetSchoolId);
    const recipientUserIds = intersectRecipients(schoolAdmins, explicitTargets);
    const schoolName = await loadSchoolName(admin, targetSchoolId);
    return {
      scope: "single_school",
      recipientUserIds,
      targetSchoolId,
      targetSchoolName: schoolName,
      schoolIds: [targetSchoolId],
    };
  }

  if (targetType === "selected_schools" && targetSchoolIds.length > 0) {
    const schoolAdmins = await getSchoolAdminUserIdsForSchools(
      admin,
      targetSchoolIds
    );
    const recipientUserIds = intersectRecipients(schoolAdmins, explicitTargets);
    const primarySchoolId =
      targetSchoolIds.length === 1 ? targetSchoolIds[0] : null;
    const schoolName = await loadSchoolName(admin, primarySchoolId);
    return {
      scope: "selected_schools",
      recipientUserIds,
      targetSchoolId: primarySchoolId,
      targetSchoolName: schoolName,
      schoolIds: targetSchoolIds,
    };
  }

  if (
    targetType === "targeted_admins" ||
    (explicitTargets.length > 0 && targetType !== "all")
  ) {
    const allAdmins = new Set(await getSchoolAdminUserIds(admin));
    const recipientUserIds = explicitTargets.filter((id) => allAdmins.has(id));
    const schoolIds = await deriveSchoolIdsForUsers(admin, recipientUserIds);
    const singleSchoolId = schoolIds.length === 1 ? schoolIds[0] : null;
    const schoolName = await loadSchoolName(admin, singleSchoolId);

    return {
      scope:
        schoolIds.length === 1 ? "single_school" : "targeted_admins",
      recipientUserIds,
      targetSchoolId: singleSchoolId,
      targetSchoolName: schoolName,
      schoolIds,
    };
  }

  // target_type = 'all' with no school scope — entire school admin audience.
  if (explicitTargets.length > 0) {
    const allAdmins = new Set(await getSchoolAdminUserIds(admin));
    const recipientUserIds = explicitTargets.filter((id) => allAdmins.has(id));
    const schoolIds = await deriveSchoolIdsForUsers(admin, recipientUserIds);
    const singleSchoolId = schoolIds.length === 1 ? schoolIds[0] : null;
    const schoolName = await loadSchoolName(admin, singleSchoolId);
    return {
      scope:
        schoolIds.length === 1 ? "single_school" : "targeted_admins",
      recipientUserIds,
      targetSchoolId: singleSchoolId,
      targetSchoolName: schoolName,
      schoolIds,
    };
  }

  return {
    scope: "all_schools",
    recipientUserIds: await getSchoolAdminUserIds(admin),
    targetSchoolId: null,
    targetSchoolName: null,
    schoolIds: [],
  };
}

export function audienceScopeLabel(scope: BroadcastAudienceScope): string {
  switch (scope) {
    case "all_schools":
      return "All schools";
    case "single_school":
      return "Single school";
    case "selected_schools":
      return "Selected schools";
    case "targeted_admins":
      return "Selected admins";
  }
}
