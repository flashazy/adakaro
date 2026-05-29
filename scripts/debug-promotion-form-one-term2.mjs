/**
 * One-off debug: Term 2 report cards for FORM ONE (academic year 2026).
 * Run: node scripts/debug-promotion-form-one-term2.mjs
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

const ACADEMIC_YEAR = "2026";
const TERM = "Term 2";
const CLASS_NAME_PATTERN = "form one";

function explainMissingAverage(rc) {
  if (!rc) return "no_report_card_row_for_student";
  if (rc.average_score == null) return "average_score_is_null";
  const n = Number(rc.average_score);
  if (!Number.isFinite(n)) {
    return `average_score_not_finite (raw=${JSON.stringify(rc.average_score)})`;
  }
  return "would_display";
}

async function main() {
  const { data: classes, error: classErr } = await admin
    .from("classes")
    .select("id, name, school_id")
    .ilike("name", `${CLASS_NAME_PATTERN}%`);

  if (classErr) {
    console.error("classes query error:", classErr.message);
    process.exit(1);
  }

  console.log("=== FORM ONE classes ===");
  console.log(JSON.stringify(classes ?? [], null, 2));

  if (!classes?.length) {
    console.log("No class matching FORM ONE found.");
    return;
  }

  for (const cls of classes) {
    const classId = cls.id;
    const schoolId = cls.school_id;

    const { data: students, error: stErr } = await admin
      .from("students")
      .select("id, full_name, admission_number")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .eq("status", "active")
      .eq("approval_status", "approved");

    if (stErr) {
      console.error(`students error (${cls.name}):`, stErr.message);
      continue;
    }

    const studentIds = (students ?? []).map((s) => s.id);

    const { data: reportCards, error: rcErr } = await admin
      .from("report_cards")
      .select(
        "id, student_id, class_id, term, academic_year, status, average_score, subjects_count, completed_subjects_count, is_complete"
      )
      .eq("school_id", schoolId)
      .eq("term", TERM)
      .eq("academic_year", ACADEMIC_YEAR)
      .in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

    if (rcErr) {
      console.error(`report_cards error (${cls.name}):`, rcErr.message);
      continue;
    }

    const rcList = reportCards ?? [];

    console.log(`\n=== ${cls.name} (${classId}) — Term 2, ${ACADEMIC_YEAR} ===`);
    console.log("1. Report cards found:", rcList.length, "of", studentIds.length, "active students");
    console.log("2. average_score values:");
    for (const rc of rcList) {
      const stud = (students ?? []).find((s) => s.id === rc.student_id);
      console.log(
        `   - ${stud?.full_name ?? rc.student_id}: average_score=${JSON.stringify(rc.average_score)} (type ${typeof rc.average_score}), subjects_count=${rc.subjects_count}, status=${rc.status}`
      );
    }

    const reasons = {};
    for (const s of students ?? []) {
      const rc = rcList.find((r) => r.student_id === s.id) ?? null;
      const wouldDisplay =
        rc?.average_score != null && Number.isFinite(Number(rc.average_score))
          ? Math.round(Number(rc.average_score) * 10) / 10
          : null;
      const why =
        wouldDisplay != null ? "displayed" : explainMissingAverage(rc);
      reasons[why] = (reasons[why] ?? 0) + 1;
    }

    console.log("3. Why average would NOT display (promotion modal logic):");
    console.log(JSON.stringify(reasons, null, 2));

    const { data: altYearRows } = await admin
      .from("report_cards")
      .select("academic_year")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .eq("term", TERM);

    const yearVariants = new Map();
    for (const row of altYearRows ?? []) {
      const y = row.academic_year;
      yearVariants.set(y, (yearVariants.get(y) ?? 0) + 1);
    }
    if (yearVariants.size) {
      console.log("   academic_year values on report_cards for this class + Term 2:");
      for (const [y, c] of yearVariants) {
        console.log(`     - "${y}": ${c} card(s)`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
