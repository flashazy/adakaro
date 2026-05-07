/**
 * Absolute login URL for parent portal slips and copy-to-clipboard.
 * Falls back to empty string when no public base is configured (client may use `window.location.origin`).
 */
export function buildParentPortalLoginUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL.trim()
      ? `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "")}`
      : "");
  return base ? `${base}/login` : "";
}
