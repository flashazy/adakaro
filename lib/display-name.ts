import type { User } from "@supabase/supabase-js";

/**
 * Best-effort display name: profile.full_name, then auth metadata, then email local-part.
 */
export function getDisplayName(
  user: User | null | undefined,
  profileFullName: string | null | undefined
): string {
  const fromProfile = profileFullName?.trim();
  if (fromProfile) return fromProfile;

  if (!user) return "User";

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  if (meta) {
    const fn = meta.full_name;
    if (typeof fn === "string" && fn.trim()) return fn.trim();
    const nm = meta.name;
    if (typeof nm === "string" && nm.trim()) return nm.trim();
  }

  const email = user.email?.trim();
  if (email) {
    const local = email.split("@")[0] ?? "";
    if (local) {
      return local
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  return "User";
}

function normalizeDisplayWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** True when every alphabetic character is uppercase (ASCII). */
function isAllUppercaseLetters(s: string): boolean {
  const letters = [...s].filter(
    (c) => /[A-Za-z]/.test(c) && c.toLowerCase() !== c.toUpperCase()
  );
  if (letters.length === 0) return false;
  return letters.every((c) => c === c.toUpperCase());
}

function titleCaseWords(s: string): string {
  return normalizeDisplayWhitespace(
    s
      .split(/\s+/)
      .filter(Boolean)
      .map((word) =>
        word
          .split(/([-'])/)
          .map((part) => {
            if (part === "-" || part === "'") return part;
            if (!part) return "";
            return (
              part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            );
          })
          .join("")
      )
      .join(" ")
  );
}

/**
 * Presentation-only name for the parent dashboard greeting.
 * Does not read or write the database; pass profile `full_name` as stored.
 */
export function formatParentDashboardDisplayName(
  raw: string | null | undefined
): string {
  let s = normalizeDisplayWhitespace(raw ?? "");
  if (!s) return "Parent";

  while (/^test/i.test(s)) {
    s = normalizeDisplayWhitespace(s.replace(/^test/i, ""));
  }
  if (!s) return "Parent";

  if (isAllUppercaseLetters(s)) {
    return titleCaseWords(s);
  }
  return s;
}
