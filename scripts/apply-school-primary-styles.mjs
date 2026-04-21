import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const EXTRA_DIRS = [
  path.join(ROOT, "app/(dashboard)"),
  path.join(ROOT, "app/(auth)"),
  path.join(ROOT, "components/layout"),
  path.join(ROOT, "components/auth"),
  path.join(ROOT, "components/ui"),
  path.join(ROOT, "components/payment"),
];

function shouldSkipFile(rel) {
  return (
    rel.includes(`${path.sep}landing${path.sep}`) ||
    rel.includes(`${path.sep}brand${path.sep}`) ||
    rel.endsWith(`${path.sep}MarketingHeader.tsx`) ||
    rel.endsWith(`${path.sep}MarketingFooter.tsx`) ||
    rel.endsWith(`${path.sep}home-landing.tsx`) ||
    rel.endsWith(`${path.sep}landing-scroll.tsx`)
  );
}

/** Longest-first replacement pairs */
const REPLACEMENTS = [
  ["shadow-indigo-600/25", "shadow-[color:rgb(var(--school-primary-rgb)/0.25)]"],
  ["shadow-indigo-600/30", "shadow-[color:rgb(var(--school-primary-rgb)/0.3)]"],
  ["shadow-indigo-900/5", "shadow-slate-900/5"],
  ["from-indigo-600 to-indigo-800", "from-school-primary to-school-primary"],
  ["hover:bg-indigo-700", "hover:brightness-90"],
  ["dark:border-indigo-900/40", "dark:border-[rgb(var(--school-primary-rgb)/0.28)]"],
  ["dark:border-indigo-800", "dark:border-[rgb(var(--school-primary-rgb)/0.45)]"],
  ["dark:border-indigo-800/60", "dark:border-[rgb(var(--school-primary-rgb)/0.4)]"],
  ["border-indigo-900/50", "border-[rgb(var(--school-primary-rgb)/0.32)]"],
  ["border-indigo-200/90", "border-[rgb(var(--school-primary-rgb)/0.28)]"],
  ["bg-indigo-50/90", "bg-[rgb(var(--school-primary-rgb)/0.12)]"],
  ["bg-indigo-50/50", "bg-[rgb(var(--school-primary-rgb)/0.08)]"],
  ["bg-indigo-50/60", "bg-[rgb(var(--school-primary-rgb)/0.12)]"],
  ["dark:bg-indigo-950/35", "dark:bg-[rgb(var(--school-primary-rgb)/0.14)]"],
  ["dark:border-indigo-500/30", "dark:border-[rgb(var(--school-primary-rgb)/0.32)]"],
  ["dark:border-indigo-500/50", "dark:border-[rgb(var(--school-primary-rgb)/0.38)]"],
  ["dark:border-indigo-500/70", "dark:border-[rgb(var(--school-primary-rgb)/0.38)]"],
  ["dark:hover:border-indigo-500/50", "dark:hover:border-[rgb(var(--school-primary-rgb)/0.4)]"],
  ["hover:border-indigo-500/30", "hover:border-[rgb(var(--school-primary-rgb)/0.32)]"],
  ["hover:border-indigo-200", "hover:border-[rgb(var(--school-primary-rgb)/0.28)]"],
  ["hover:border-indigo-300", "hover:border-[rgb(var(--school-primary-rgb)/0.35)]"],
  ["dark:bg-indigo-950/30", "dark:bg-[rgb(var(--school-primary-rgb)/0.14)]"],
  ["dark:bg-indigo-950/80", "dark:bg-[rgb(var(--school-primary-rgb)/0.22)]"],
  ["dark:hover:bg-indigo-500/20", "dark:hover:bg-[rgb(var(--school-primary-rgb)/0.20)]"],
  ["dark:bg-indigo-500/20", "dark:bg-[rgb(var(--school-primary-rgb)/0.18)]"],
  ["dark:bg-indigo-500/10", "dark:bg-[rgb(var(--school-primary-rgb)/0.12)]"],
  ["dark:border-indigo-900/60", "dark:border-[rgb(var(--school-primary-rgb)/0.35)]"],
  ["dark:border-indigo-900/50", "dark:border-[rgb(var(--school-primary-rgb)/0.30)]"],
  ["dark:hover:bg-indigo-900/40", "dark:hover:bg-[rgb(var(--school-primary-rgb)/0.22)]"],
  ["dark:hover:bg-indigo-950/40", "dark:hover:bg-[rgb(var(--school-primary-rgb)/0.18)]"],
  ["dark:bg-indigo-950/60", "dark:bg-[rgb(var(--school-primary-rgb)/0.20)]"],
  ["dark:bg-indigo-950/50", "dark:bg-[rgb(var(--school-primary-rgb)/0.16)]"],
  ["dark:bg-indigo-950/40", "dark:bg-[rgb(var(--school-primary-rgb)/0.18)]"],
  ["dark:bg-indigo-950/20", "dark:bg-[rgb(var(--school-primary-rgb)/0.12)]"],
  ["border-indigo-500/40", "border-[rgb(var(--school-primary-rgb)/0.35)]"],
  ["ring-indigo-500/40", "ring-[rgb(var(--school-primary-rgb)/0.4)]"],
  ["bg-indigo-50/70", "bg-[rgb(var(--school-primary-rgb)/0.10)]"],
  ["bg-indigo-500/85", "bg-school-primary/85"],
  ["dark:hover:bg-indigo-500", "dark:hover:brightness-110"],
  ["hover:bg-indigo-500", "hover:brightness-105"],
  ["hover:text-indigo-500", "hover:opacity-90"],
  ["hover:text-indigo-800", "hover:opacity-90"],
  ["hover:text-indigo-900", "hover:opacity-90"],
  ["group-hover:text-indigo-800", "group-hover:opacity-90"],
  ["text-indigo-800/80", "text-school-primary/80"],
  ["dark:text-indigo-200/80", "dark:text-school-primary/80"],
  ["dark:hover:text-indigo-300", "dark:hover:opacity-90"],
  ["focus-visible:outline-indigo-600", "focus-visible:outline-school-primary"],
  ["focus-visible:ring-indigo-500", "focus-visible:ring-school-primary"],
  ["dark:focus:ring-indigo-400", "dark:focus:ring-school-primary"],
  ["dark:focus:border-indigo-400", "dark:focus:border-school-primary"],
  ["focus:ring-indigo-500", "focus:ring-school-primary"],
  ["focus:border-indigo-500", "focus:border-school-primary"],
  ["focus:ring-indigo-400", "focus:ring-school-primary"],
  ["focus:border-indigo-400", "focus:border-school-primary"],
  ["ring-indigo-500", "ring-school-primary"],
  ["ring-indigo-400", "ring-school-primary"],
  ["dark:border-indigo-400", "dark:border-school-primary"],
  ["dark:border-indigo-500", "dark:border-school-primary"],
  ["border-indigo-600", "border-school-primary"],
  ["border-indigo-500", "border-school-primary"],
  ["border-indigo-400", "border-[rgb(var(--school-primary-rgb)/0.45)]"],
  ["border-indigo-300", "border-[rgb(var(--school-primary-rgb)/0.35)]"],
  ["border-indigo-200", "border-[rgb(var(--school-primary-rgb)/0.25)]"],
  ["border-indigo-100", "border-[rgb(var(--school-primary-rgb)/0.18)]"],
  ["text-indigo-950", "text-school-primary"],
  ["text-indigo-900", "text-school-primary"],
  ["text-indigo-800", "text-school-primary"],
  ["text-indigo-700", "text-school-primary"],
  ["text-indigo-600", "text-school-primary"],
  ["text-indigo-200", "text-school-primary"],
  ["text-indigo-100", "text-school-primary"],
  ["dark:text-indigo-100", "dark:text-school-primary"],
  ["dark:text-indigo-200", "dark:text-school-primary"],
  ["dark:text-indigo-300", "dark:text-school-primary"],
  ["dark:text-indigo-400", "dark:text-school-primary"],
  ["hover:text-indigo-600", "hover:opacity-90"],
  ["dark:hover:text-indigo-400", "dark:hover:opacity-90"],
  /* Solid indigo backgrounds before bg-indigo-50 so "500" is not split by the "50" rule */
  ["dark:bg-indigo-600", "dark:bg-school-primary"],
  ["dark:bg-indigo-500", "dark:bg-school-primary"],
  ["dark:bg-indigo-400", "dark:bg-school-primary"],
  ["bg-indigo-600", "bg-school-primary"],
  ["bg-indigo-500", "bg-school-primary"],
  ["dark:bg-indigo-950", "dark:bg-[rgb(var(--school-primary-rgb)/0.15)]"],
  ["bg-indigo-100", "bg-[rgb(var(--school-primary-rgb)/0.16)]"],
  ["bg-indigo-50", "bg-[rgb(var(--school-primary-rgb)/0.10)]"],
  ["hover:bg-indigo-100", "hover:bg-[rgb(var(--school-primary-rgb)/0.18)]"],
  ["hover:bg-indigo-50", "hover:bg-[rgb(var(--school-primary-rgb)/0.10)]"],
  ["from-indigo-50/80", "from-[rgb(var(--school-primary-rgb)/0.12)]"],
  ["dark:from-indigo-950/40", "dark:from-[rgb(var(--school-primary-rgb)/0.14)]"],
  ["from-indigo-200", "from-[rgb(var(--school-primary-rgb)/0.28)]"],
  ["to-indigo-800", "to-school-primary"],
  ["file:text-indigo-700", "file:text-school-primary"],
  ["file:bg-indigo-50", "file:bg-[rgb(var(--school-primary-rgb)/0.10)]"],
  ["dark:file:bg-indigo-950/50", "dark:file:bg-[rgb(var(--school-primary-rgb)/0.15)]"],
  ["dark:file:text-indigo-200", "dark:file:text-school-primary"],
  ["accent-indigo-600", "accent-school-primary"],
  ["has-[:checked]:ring-indigo-600", "has-[:checked]:ring-school-primary"],
  ["has-[:checked]:border-indigo-600", "has-[:checked]:border-school-primary"],
  ["dark:has-[:checked]:ring-indigo-400", "dark:has-[:checked]:ring-school-primary"],
  ["dark:has-[:checked]:border-indigo-400", "dark:has-[:checked]:border-school-primary"],
  ["has-[:checked]:ring-indigo-400", "has-[:checked]:ring-school-primary"],
  ["has-[:checked]:border-indigo-400", "has-[:checked]:border-school-primary"],
];

function walkTsx(dir, out, relBase) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const rel = path.relative(ROOT, p);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      walkTsx(p, out, relBase);
    } else if (name.endsWith(".tsx") || name.endsWith(".ts")) {
      if (!shouldSkipFile(rel)) out.push(p);
    }
  }
}

const files = [];
for (const d of EXTRA_DIRS) walkTsx(d, files, ROOT);

for (const rel of [
  "components/ClickPesaPayButton.tsx",
  "components/SchoolCurrencySelect.tsx",
  "components/upgrade-modal.tsx",
  "lib/grade-display-format.tsx",
]) {
  const p = path.join(ROOT, rel);
  if (fs.existsSync(p) && !shouldSkipFile(rel)) files.push(p);
}

let changed = 0;
for (const file of files) {
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  for (const [a, b] of REPLACEMENTS) {
    if (s.includes(a)) s = s.split(a).join(b);
  }
  if (s !== orig) {
    fs.writeFileSync(file, s);
    changed++;
  }
}

console.log(`Updated ${changed} files (school primary styles).`);
