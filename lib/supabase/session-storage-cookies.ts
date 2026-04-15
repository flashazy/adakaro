/**
 * Cookie adapter for @supabase/ssr createBrowserClient that persists auth
 * chunks in sessionStorage instead of document.cookie.
 *
 * document.cookie (the default browser adapter) is shared across all tabs on
 * the same origin, which causes concurrent sessions to overwrite each other.
 * sessionStorage is scoped per tab/window.
 */

const SESSION_STORAGE_KEY_PREFIX = "__sb_auth_cookie:";

export function createSessionStorageCookieMethods(): {
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookiesToSet: {
      name: string;
      value: string;
      options?: Record<string, unknown>;
    }[]
  ) => void;
} {
  return {
    getAll() {
      if (typeof window === "undefined") return [];
      const out: { name: string; value: string }[] = [];
      for (let i = 0; i < window.sessionStorage.length; i += 1) {
        const key = window.sessionStorage.key(i);
        if (!key || !key.startsWith(SESSION_STORAGE_KEY_PREFIX)) continue;
        out.push({
          name: key.slice(SESSION_STORAGE_KEY_PREFIX.length),
          value: window.sessionStorage.getItem(key) ?? "",
        });
      }
      return out;
    },
    setAll(cookiesToSet) {
      if (typeof window === "undefined") return;
      for (const { name, value } of cookiesToSet) {
        const key = SESSION_STORAGE_KEY_PREFIX + name;
        if (!value) {
          window.sessionStorage.removeItem(key);
        } else {
          window.sessionStorage.setItem(key, value);
        }
      }
    },
  };
}
