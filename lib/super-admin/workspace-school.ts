import "server-only";

import { cookies } from "next/headers";
import {
  parseWorkspaceSchoolId,
  SUPER_ADMIN_WORKSPACE_SCHOOL_COOKIE,
} from "@/lib/super-admin/workspace-school.constants";

export {
  parseWorkspaceSchoolId,
  SUPER_ADMIN_WORKSPACE_SCHOOL_COOKIE,
};

const COOKIE_MAX_AGE = 60 * 60 * 8;

export async function readSuperAdminWorkspaceSchoolId(): Promise<string | null> {
  const jar = await cookies();
  return parseWorkspaceSchoolId(
    jar.get(SUPER_ADMIN_WORKSPACE_SCHOOL_COOKIE)?.value
  );
}

export function workspaceSchoolCookieOptions() {
  return {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  };
}

export function clearWorkspaceSchoolCookieOptions() {
  return {
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  };
}
