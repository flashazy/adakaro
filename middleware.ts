import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Applied only to paths in `config.matcher` (excludes `/_next/static`, images, favicon). */
const DOCUMENT_CACHE_CONTROL =
  "private, no-cache, no-store, max-age=0, must-revalidate";

function withNoHtmlCache(response: NextResponse) {
  response.headers.set("Cache-Control", DOCUMENT_CACHE_CONTROL);
  return response;
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  return withNoHtmlCache(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
