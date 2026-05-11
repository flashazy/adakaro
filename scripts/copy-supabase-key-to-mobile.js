#!/usr/bin/env node
/**
 * Copies NEXT_PUBLIC_SUPABASE_ANON_KEY from the repo-root `.env.local`
 * into `mobile/.env` as `SUPABASE_ANON_KEY` (Flutter / flutter_dotenv).
 *
 * Usage (from repo root):
 *   node scripts/copy-supabase-key-to-mobile.js
 *
 * Does not print the key; only confirms length and paths.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const WEB_ENV = path.join(REPO_ROOT, ".env.local");
const MOBILE_ENV = path.join(REPO_ROOT, "mobile", ".env");
const MARKER =
  "# -- synced from root .env.local via scripts/copy-supabase-key-to-mobile.js --";

function readLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

/** Parse KEY=value from dotenv-style content (first match wins). */
function getEnvValue(content, key) {
  if (!content) return null;
  const lines = content.split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    if (k !== key) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return null;
}

/** Replace or append KEY=value; preserves other lines and comments. */
function upsertEnvLine(content, key, value) {
  const lines = (content ?? "").split("\n");
  let replaced = false;
  const out = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return line;
    const eq = t.indexOf("=");
    if (eq <= 0) return line;
    const k = t.slice(0, eq).trim();
    if (k === key) {
      replaced = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!replaced) {
    if (out.length && out[out.length - 1] !== "") out.push("");
    out.push(MARKER);
    out.push(`${key}=${value}`);
  }
  return out.join("\n").replace(/\n+$/, "") + "\n";
}

function main() {
  const webRaw = readLines(WEB_ENV);
  if (webRaw === null) {
    console.error(`Missing file: ${path.relative(REPO_ROOT, WEB_ENV)}`);
    process.exit(1);
  }

  const anon = getEnvValue(webRaw, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!anon || !anon.trim()) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or empty in .env.local"
    );
    process.exit(1);
  }

  const trimmed = anon.trim();
  const mobileRaw = readLines(MOBILE_ENV) ?? "";
  const next = upsertEnvLine(mobileRaw, "SUPABASE_ANON_KEY", trimmed);

  fs.mkdirSync(path.dirname(MOBILE_ENV), { recursive: true });
  fs.writeFileSync(MOBILE_ENV, next, "utf8");

  console.log(
    `Wrote SUPABASE_ANON_KEY to ${path.relative(REPO_ROOT, MOBILE_ENV)} (length ${trimmed.length})`
  );
}

main();
