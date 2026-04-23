const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_CODE_REQUESTS_PER_HOUR = 3;

type Entry = {
  count: number;
  clearTimer: ReturnType<typeof setTimeout>;
};

/** phone digits (normalized) → how many recovery codes have been issued in the current window */
const phoneToAttempts = new Map<string, Entry>();

export const PARENT_RECOVERY_RATE_LIMIT_EXCEEDED =
  "Too many requests. Please try again in an hour." as const;

export function isParentRecoveryPhoneRateLimited(phoneDigits: string): boolean {
  const e = phoneToAttempts.get(phoneDigits);
  return e !== undefined && e.count >= MAX_CODE_REQUESTS_PER_HOUR;
}

/** Call only after a recovery code has been stored successfully. */
export function recordParentRecoveryCodeIssued(phoneDigits: string): void {
  let e = phoneToAttempts.get(phoneDigits);
  if (!e) {
    const clearTimer = setTimeout(() => {
      phoneToAttempts.delete(phoneDigits);
    }, ONE_HOUR_MS);
    e = { count: 0, clearTimer };
    phoneToAttempts.set(phoneDigits, e);
  }
  e.count += 1;
}
