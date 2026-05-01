import type { KeyboardEvent } from "react";

export const HINT_ONLY_NUMBERS = "Only numbers allowed.";
export const HINT_LETTERS_AND_SPACES = "Only letters and spaces allowed.";
export const HINT_ALPHANUM_HYPHEN =
  "Letters, numbers, hyphens, and underscores allowed.";

/** Keeps ASCII digits only (e.g. phone numbers). */
export function onlyNumbers(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Unicode letters, whitespace, apostrophes, hyphens — for person names.
 */
export function onlyLettersAndSpaces(value: string): string {
  return value.replace(/[^\p{L}\s'\-]/gu, "");
}

/** Letters, digits, underscore, hyphen — e.g. admission codes. */
export function onlyAlphanumericHyphen(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Digits and at most one decimal point — for currency amounts typed as text.
 */
export function onlyNumericAmount(value: string): string {
  let s = value.replace(/[^\d.]/g, "");
  const first = s.indexOf(".");
  if (first === -1) return s;
  return s.slice(0, first + 1) + s.slice(first + 1).replace(/\./g, "");
}

/**
 * Removes characters that do not match `allowedPattern` when tested
 * against a single character (reset `lastIndex` each time).
 */
export function sanitizeInput(value: string, allowedPattern: RegExp): string {
  return Array.from(value)
    .filter((ch) => {
      allowedPattern.lastIndex = 0;
      return allowedPattern.test(ch);
    })
    .join("");
}

const NAV_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

/** Block printable keys that fail `allowedPattern.test(key)`. */
export function blockInvalidKeyDown(
  e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  allowedPattern: RegExp
): void {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (NAV_KEYS.has(e.key)) return;
  if (e.key.length !== 1) return;
  allowedPattern.lastIndex = 0;
  if (!allowedPattern.test(e.key)) {
    e.preventDefault();
  }
}

const RE_ONE_LETTER_OR_SPACE = /^[\p{L}\s'\-]$/u;
const RE_ALNUM_HYPHEN = /^[a-zA-Z0-9_-]$/;
export function blockInvalidKeyDownLettersName(
  e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
): void {
  blockInvalidKeyDown(e, RE_ONE_LETTER_OR_SPACE);
}

export function blockInvalidKeyDownAdmission(
  e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
): void {
  blockInvalidKeyDown(e, RE_ALNUM_HYPHEN);
}

export function blockInvalidKeyDownPhone(
  e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
): void {
  blockInvalidKeyDown(e, /^\d$/);
}

/** Amount field: digits and a single dot. */
export function blockInvalidKeyDownAmount(
  e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
): void {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (NAV_KEYS.has(e.key)) return;
  if (e.key.length !== 1) return;
  if (e.key === ".") {
    const v = e.currentTarget.value;
    if (v.includes(".")) {
      e.preventDefault();
    }
    return;
  }
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
}

export function isValidNumericAmountInput(value: string): boolean {
  const t = value.trim();
  if (t === "") return false;
  const n = Number(t);
  return Number.isFinite(n) && n > 0;
}

/** True when non-empty `value` contains characters stripped by `onlyLettersAndSpaces`. */
export function hasInvalidLettersNameInput(value: string): boolean {
  return value.length > 0 && value !== onlyLettersAndSpaces(value);
}

/** True when non-empty `value` contains characters stripped by `onlyAlphanumericHyphen`. */
export function hasInvalidAdmissionInput(value: string): boolean {
  return value.length > 0 && value !== onlyAlphanumericHyphen(value);
}

/** True when non-empty `value` contains characters stripped by `onlyNumbers`. */
export function hasInvalidPhoneInput(value: string): boolean {
  return value.length > 0 && value !== onlyNumbers(value);
}

/** True when non-empty `value` contains characters stripped by `onlyNumericAmount`. */
export function hasInvalidAmountInput(value: string): boolean {
  return value.length > 0 && value !== onlyNumericAmount(value);
}
