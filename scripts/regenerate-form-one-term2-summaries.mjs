/**
 * Backfill report_cards summary fields for FORM ONE Term 2 2026 from comment rows.
 * Run: node scripts/regenerate-form-one-term2-summaries.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CLASS_ID = "eda72666-a95d-4d65-8fbd-0972dc75d056";
const ACADEMIC_YEAR = "2026";
const TERM = "Term 2";

function round1(n) {
  return Math.round(n * 10) / 10;
}

async function persistReportCardSummary(reportCardId) {
  const { data: rows, error: readErr } = await admin
    .from("teacher_report_card_comments")
    .select("subject, calculated_score, score_percent")
    .eq("report_card_id", reportCardId);

  if (readErr) return { error: readErr.message };

  const subjects = new Set();
  let completed = 0;
  let total = 0;

  for (const r of rows ?? []) {
    const subj = (r.subject ?? "").trim();
    if (subj) subjects.add(subj);
    const raw = r.calculated_score ?? r.score_percent ?? null;
    if (raw == null || String(raw).trim() === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    completed += 1;
    total += n;
  }

  const subjectsCount = subjects.size;
  const isComplete = subjectsCount > 0 && completed >= subjectsCount;
  const average =
    subjectsCount > 0 ? round1(total / subjectsCount) : null;

  const { error: updErr } = await admin
    .from("report_cards")
    .update({
      total_score: subjectsCount > 0 ? round1(total) : null,
      average_score: average,
      subjects_count: subjectsCount > 0 ? subjectsCount : null,
      completed_subjects_count: completed > 0 ? completed : null,
      is_complete: isComplete,
      summary_calculated_at: new Date().toISOString(),
    })
    .eq("id", reportCardId);

  if (updErr) return { error: updErr.message };
  return { average, subjectsCount, completed, isComplete };
}

async function main() {
  const { data: cards, error } = await admin
    .from("report_cards")
    .select("id, student_id, students(full_name)")
    .eq("class_id", CLASS_ID)
    .eq("term", TERM)
    .eq("academic_year", ACADEMIC_YEAR);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`FORM ONE — ${TERM} ${ACADEMIC_YEAR}: ${cards?.length ?? 0} report cards`);

  let ok = 0;
  let failed = 0;

  for (const card of cards ?? []) {
    const name =
      card.students?.full_name ?? card.student_id?.slice(0, 8) ?? card.id;
    const result = await persistReportCardSummary(card.id);
    if (result.error) {
      console.log(`FAIL ${name}: ${result.error}`);
      failed += 1;
    } else {
      console.log(
        `OK   ${name}: average_score=${result.average}, subjects=${result.subjectsCount}, completed=${result.completed}, is_complete=${result.isComplete}`
      );
      ok += 1;
    }
  }

  console.log(`\nDone: ${ok} updated, ${failed} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
