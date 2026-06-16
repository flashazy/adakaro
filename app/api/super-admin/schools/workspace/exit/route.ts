import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import {
  SUPER_ADMIN_WORKSPACE_SCHOOL_COOKIE,
  clearWorkspaceSchoolCookieOptions,
} from "@/lib/super-admin/workspace-school";

/** Clears Super Admin school workspace cookie and returns to platform dashboard. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const loginUrl = new URL("/login", request.url);
  const superAdminUrl = new URL("/super-admin", request.url);
  const reason = new URL(request.url).searchParams.get("reason");
  if (reason === "unavailable") {
    superAdminUrl.searchParams.set("workspace_unavailable", "1");
  }

  if (!user) {
    return NextResponse.redirect(loginUrl);
  }

  if (!(await checkIsSuperAdmin(supabase, user.id))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.redirect(superAdminUrl);
  response.cookies.set(
    SUPER_ADMIN_WORKSPACE_SCHOOL_COOKIE,
    "",
    clearWorkspaceSchoolCookieOptions()
  );
  return response;
}
