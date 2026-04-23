/** Emails minted by the product for login (not “real” contact emails). */
export function isSyntheticSchoolAccountEmail(email: string | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return (
    e.includes("@teachers.adakaro.app") ||
    e.includes("@admins.adakaro.app")
  );
}

/**
 * Show a real contact address: prefer `auth.users` email, then `profiles.email`.
 * Never return Adakaro-generated login addresses.
 */
export function resolveTeamAdminDisplayEmail(
  authEmail: string | null,
  profileEmail: string | null
): string | null {
  const firstReal = (e: string | null) => {
    if (!e) return null;
    const t = e.trim();
    if (t.length === 0) return null;
    if (isSyntheticSchoolAccountEmail(t)) return null;
    return t;
  };
  return firstReal(authEmail) ?? firstReal(profileEmail) ?? null;
}

export function canRemoveSchoolTeamAdmin(opts: {
  viewerUserId: string;
  schoolCreatorUserId: string;
  targetUserId: string;
  membershipCreatedBy: string | null;
}): boolean {
  if (opts.targetUserId === opts.schoolCreatorUserId) return false;
  if (opts.viewerUserId === opts.schoolCreatorUserId) return true;
  if (
    opts.membershipCreatedBy != null &&
    opts.viewerUserId === opts.membershipCreatedBy
  ) {
    return true;
  }
  return false;
}
