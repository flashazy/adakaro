/**
 * Temporary client-side identifiers for entities created while offline.
 *
 * Format: `temp_<base36-ms>_<6-char-rand>`
 *
 * Choice of format:
 *   - `temp_` prefix is unmistakable and won't collide with any real
 *     server id (Postgres UUIDs are 36 chars without underscores; row
 *     numbers in URLs are also pure numerics).
 *   - The base36 timestamp keeps temp ids ordered by creation time when
 *     sorted lexicographically — handy for deterministic conflict
 *     resolution if a teacher manages to add two students with the same
 *     name in the same offline session.
 *   - The 6-char random suffix avoids collisions when two devices on
 *     the same school create entities at the same millisecond.
 *
 * **Never** persist a temp id to the server — it MUST be rewritten to
 * the real id by `lib/offline/rewrite-ids.ts` before the dispatch fires.
 */

const TEMP_PREFIX = "temp_";
const RAND_LEN = 6;
const RAND_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyz";

function randomSuffix(): string {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint8Array(RAND_LEN);
    crypto.getRandomValues(buf);
    let out = "";
    for (let i = 0; i < RAND_LEN; i++) {
      out += RAND_ALPHABET[buf[i]! % RAND_ALPHABET.length];
    }
    return out;
  }
  let out = "";
  for (let i = 0; i < RAND_LEN; i++) {
    out += RAND_ALPHABET[Math.floor(Math.random() * RAND_ALPHABET.length)];
  }
  return out;
}

/** Returns a fresh `temp_…` id. Safe to call from any context. */
export function makeTempStudentId(): string {
  return `${TEMP_PREFIX}${Date.now().toString(36)}_${randomSuffix()}`;
}

/** True for any id produced by `makeTempStudentId`. */
export function isTempId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(TEMP_PREFIX);
}

/**
 * Returns a temp receipt number to display in the UI before the server
 * has issued the real one. Format: `OFFLINE-<base36-ms>-<rand>`.
 */
export function makeTempReceiptNumber(): string {
  return `OFFLINE-${Date.now().toString(36).toUpperCase()}-${randomSuffix().toUpperCase()}`;
}
