import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const CAPTURE_SESSION_COOKIE = "cc_session";

export type CaptureCardSession = {
  ccuId: string;
  schoolId: string;
  username: string | null;
};

type CaptureCookiePayload = {
  v: 1;
  ccu_id: string;
  school_id: string;
  username?: string;
  exp: number; // unix seconds
};

function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlEncodeString(s: string): string {
  return base64UrlEncode(Buffer.from(s, "utf8"));
}

function base64UrlDecodeToString(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, "base64").toString("utf8");
}

function hmacSha256Base64Url(secret: string, data: string): string {
  const crypto = require("crypto") as typeof import("crypto");
  const sig = crypto.createHmac("sha256", secret).update(data).digest();
  return base64UrlEncode(sig);
}

function getCaptureSessionSecret(): string {
  return (
    process.env.CAPTURE_CARD_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    ""
  );
}

function requireCaptureSessionSecret(): string {
  const secret = getCaptureSessionSecret();
  if (!secret) {
    // Avoid leaking env expectations in production UX.
    throw new Error("Server misconfiguration.");
  }
  return secret;
}

function createSignedCaptureSessionCookieValue(payload: CaptureCookiePayload): string {
  const secret = requireCaptureSessionSecret();
  const body = base64UrlEncodeString(JSON.stringify(payload));
  const sig = hmacSha256Base64Url(secret, body);
  return `${body}.${sig}`;
}

const captureSessionCookieBaseOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export function setCaptureCardSessionOnResponse(
  response: NextResponse,
  payload: CaptureCookiePayload
) {
  const value = createSignedCaptureSessionCookieValue(payload);
  const maxAge = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
  response.cookies.set(CAPTURE_SESSION_COOKIE, value, {
    ...captureSessionCookieBaseOptions,
    maxAge,
  });
}

export async function readCaptureCardSession(): Promise<CaptureCardSession | null> {
  const jar = await cookies();
  const cookie = jar.get(CAPTURE_SESSION_COOKIE)?.value ?? "";
  if (!cookie) return null;
  const [body, sig] = cookie.split(".");
  if (!body || !sig) return null;

  const secret = getCaptureSessionSecret();
  if (!secret) return null;

  const expected = hmacSha256Base64Url(secret, body);
  if (expected !== sig) return null;

  let payload: CaptureCookiePayload;
  try {
    payload = JSON.parse(base64UrlDecodeToString(body)) as CaptureCookiePayload;
  } catch {
    return null;
  }
  if (payload?.v !== 1) return null;
  if (!payload.ccu_id || !payload.school_id) return null;
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return {
    ccuId: payload.ccu_id,
    schoolId: payload.school_id,
    username: typeof payload.username === "string" ? payload.username : null,
  };
}

export async function clearCaptureCardSessionCookie() {
  const jar = await cookies();
  jar.set(CAPTURE_SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

export async function setCaptureCardSessionCookie(payload: CaptureCookiePayload) {
  const value = createSignedCaptureSessionCookieValue(payload);
  const jar = await cookies();
  jar.set(CAPTURE_SESSION_COOKIE, value, {
    ...captureSessionCookieBaseOptions,
    maxAge: Math.max(0, payload.exp - Math.floor(Date.now() / 1000)),
  });
}

