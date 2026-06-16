export const SUPER_ADMIN_WORKSPACE_SCHOOL_COOKIE =
  "super_admin_workspace_school_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseWorkspaceSchoolId(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const v = raw.trim();
  return UUID_RE.test(v) ? v : null;
}
