import { randomInt } from "crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "@#$%&*!";

/** 8–10 characters; includes upper, lower, digit, and special. */
export function generateTeacherTempPassword(): string {
  const len = randomInt(8, 11);
  const pool = UPPER + LOWER + DIGITS + SPECIAL;
  const chars: string[] = [
    UPPER[randomInt(UPPER.length)]!,
    LOWER[randomInt(LOWER.length)]!,
    DIGITS[randomInt(DIGITS.length)]!,
    SPECIAL[randomInt(SPECIAL.length)]!,
  ];
  for (let i = chars.length; i < len; i++) {
    chars.push(pool[randomInt(pool.length)]!);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
