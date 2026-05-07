/**
 * Plain-text helpers for storing and displaying structured rejection guidance
 * in `students.rejection_reason` (no JSON / separate table).
 */

export const REJECTION_GUIDANCE_FALLBACK =
  "The admin requested corrections before approval.";

/** Admin-selectable correction templates (stored exactly as shown). */
export const COMMON_REJECTION_ISSUE_LABELS = [
  "Missing parent phone",
  "Missing parent name",
  "Wrong class selected",
  "Missing subjects",
  "Duplicate student",
  "Wrong date of birth",
  "Incomplete health information",
  "Unclear student photo",
  "Incorrect admission details",
  "Incomplete enrollment data",
] as const;

export type CommonRejectionIssueLabel =
  (typeof COMMON_REJECTION_ISSUE_LABELS)[number];

export const ADMIN_NOTE_BLOCK_PREFIX = "\n\nAdmin note:\n";

export interface ParsedRejectionGuidance {
  /** Use {@link REJECTION_GUIDANCE_FALLBACK} in UI. */
  useFallback: boolean;
  /** Issue lines / template lines (excluding admin note block). */
  issues: string[];
  adminNote: string | null;
}

/**
 * Build `rejection_reason` from selected templates (order preserved) and optional note.
 * Returns `null` when empty so the DB can stay null and UIs show the fallback.
 */
export function composeRejectionReason(
  selectedTemplatesInOrder: string[],
  adminNote: string
): string | null {
  const allowed = new Set<string>(COMMON_REJECTION_ISSUE_LABELS);
  const lines = selectedTemplatesInOrder
    .map((t) => t.trim())
    .filter((t) => allowed.has(t));
  const note = adminNote.trim();
  let out = "";
  if (lines.length > 0) {
    out = lines.join("\n");
  }
  if (note) {
    out = lines.length > 0 ? `${out}${ADMIN_NOTE_BLOCK_PREFIX}${note}` : `Admin note:\n${note}`;
  }
  return out.trim() || null;
}

/**
 * Parse stored `rejection_reason` for display (supports newer blocked format + older free text).
 */
export function parseRejectionReasonForDisplay(
  raw: string | null | undefined
): ParsedRejectionGuidance {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { useFallback: true, issues: [], adminNote: null };
  }

  if (trimmed.startsWith("Admin note:\n")) {
    const note = trimmed.slice("Admin note:\n".length).trim();
    return {
      useFallback: false,
      issues: [],
      adminNote: note || null,
    };
  }

  const idx = trimmed.indexOf(ADMIN_NOTE_BLOCK_PREFIX);
  if (idx >= 0) {
    const issuePart = trimmed.slice(0, idx).trim();
    const notePart = trimmed.slice(idx + ADMIN_NOTE_BLOCK_PREFIX.length).trim();
    const issues = issuePart
      ? issuePart.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];
    return {
      useFallback: false,
      issues,
      adminNote: notePart || null,
    };
  }

  const issues = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return { useFallback: false, issues, adminNote: null };
}

/** One-line summary for search previews / clamped snippets. */
export function rejectionGuidancePlainSummary(
  raw: string | null | undefined,
  maxLen: number
): string {
  const p = parseRejectionReasonForDisplay(raw);
  if (p.useFallback) return REJECTION_GUIDANCE_FALLBACK;
  const chunks: string[] = [];
  if (p.issues.length) chunks.push(...p.issues);
  if (p.adminNote) chunks.push(p.adminNote);
  if (chunks.length === 0) return REJECTION_GUIDANCE_FALLBACK;
  const joined = chunks.join(" · ");
  if (joined.length <= maxLen) return joined;
  return `${joined.slice(0, Math.max(0, maxLen - 1))}…`;
}

/** Short list for correction queue rows: up to `maxIssues` issue lines, optional suffix. */
export function getRejectionQueuePreviewDisplay(
  raw: string | null | undefined,
  maxIssues = 2
): { lines: string[]; suffix?: string } {
  const p = parseRejectionReasonForDisplay(raw);
  if (p.useFallback) {
    return { lines: [REJECTION_GUIDANCE_FALLBACK] };
  }
  if (p.issues.length > 0) {
    const lines = p.issues.slice(0, maxIssues);
    const more = p.issues.length - maxIssues;
    if (more > 0) {
      return {
        lines,
        suffix: `+${more} more issue${more === 1 ? "" : "s"}`,
      };
    }
    if (p.adminNote?.trim()) {
      return { lines, suffix: "Includes admin instructions" };
    }
    return { lines };
  }
  if (p.adminNote?.trim()) {
    const n = p.adminNote.trim();
    return {
      lines: n.length > 120 ? [`${n.slice(0, 117)}…`] : [n],
    };
  }
  return { lines: [REJECTION_GUIDANCE_FALLBACK] };
}
