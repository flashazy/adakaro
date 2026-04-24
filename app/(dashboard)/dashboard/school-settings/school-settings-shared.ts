/**
 * Types and constants for school settings UI + server actions.
 * Kept outside `actions.ts` because `"use server"` modules may only export async functions.
 */

export interface SchoolSettingsState {
  error?: string;
  success?: boolean;
  /** Set on each successful logo action so clients can react to repeat uploads. */
  completedAt?: number;
  /** Public storage URL saved for this upload (client bypasses CDN cache via fetch+blob). */
  publicUrl?: string | null;
  /** From `schools.updated_at` after write — use with `?v=` everywhere the logo is shown. */
  logoVersion?: number;
  /** Busts cache for school stamp image after `schools` row update. */
  stampVersion?: number;
}

export type TermStructureValue = "2_terms" | "3_terms";

export type AccountSettingsState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/** Initial `useActionState` value — no banner until submit. */
export const initialAccountSettingsState: AccountSettingsState = {
  ok: false,
  error: "",
};
