import "server-only";

import { createHash, randomBytes } from "crypto";

export function hashEnrollmentDeskAccessToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function generateEnrollmentDeskAccessRawToken(): string {
  return randomBytes(32).toString("base64url");
}
