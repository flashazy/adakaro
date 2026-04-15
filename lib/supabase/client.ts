"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/supabase";
import { createSessionStorageCookieMethods } from "./session-storage-cookies";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      /** Per-tab client; avoids a single module-level instance across contexts. */
      isSingleton: false,
      /**
       * Persist auth in sessionStorage (via cookie chunk protocol) instead of
       * document.cookie, which is shared across tabs on the same origin.
       */
      cookies: createSessionStorageCookieMethods(),
    }
  );
}
