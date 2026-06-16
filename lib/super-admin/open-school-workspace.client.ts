/**
 * Enter a school workspace as Super Admin (sets httpOnly cookie, then navigates).
 */
export async function enterSuperAdminSchoolWorkspace(
  schoolId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/super-admin/schools/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolId }),
    credentials: "same-origin",
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      error: body.error?.trim() || "Could not open school workspace.",
    };
  }

  window.location.assign("/dashboard");
  return { ok: true };
}
